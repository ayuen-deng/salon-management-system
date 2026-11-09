import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.PERF_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const RUNS = Number.parseInt(process.env.PERF_RUNS || '20', 10);
const OUTPUT = path.resolve(process.env.PERF_OUTPUT || 'artifacts/performance/baseline.json');
const ALL_PROFILES = [
  { name: 'uganda-4g', latency: 175, download: 625_000, upload: 125_000, cpu: 4, viewport: { width: 390, height: 844 } },
  { name: 'slow-3g', latency: 400, download: 50_000, upload: 25_000, cpu: 4, viewport: { width: 390, height: 844 } },
  { name: 'desktop', latency: 0, download: 12_500_000, upload: 2_500_000, cpu: 1, viewport: { width: 1365, height: 900 } },
];
const requestedProfiles = process.env.PERF_PROFILE_NAMES?.split(',').map((value) => value.trim()).filter(Boolean);
const PROFILES = requestedProfiles
  ? ALL_PROFILES.filter((profile) => requestedProfiles.includes(profile.name))
  : ALL_PROFILES;
const PERFORMANCE_BUDGETS = {
  'customer-kiosk-shell': {
    'uganda-4g': { contentMsP95: 2000 },
    'slow-3g': { contentMsP95: 2000 },
  },
};
const DEFAULT_JOURNEYS = [
  { name: 'customer-kiosk-shell', path: '/desk' },
  { name: 'queue-screen-first-load', path: '/display/queue' },
  { name: 'sign-in-screen', path: '/login' },
  { name: 'reception-check-in-shell', path: '/reception', role: 'receptionist' },
  { name: 'manager-today-shell', path: '/manager', role: 'manager' },
  { name: 'hr-attendance-shell', path: '/hr/attendance', role: 'hr' },
  { name: 'staff-phone-shell', path: '/staff', role: 'staff' },
  { name: 'visit-search-shell', path: '/reception/visits', role: 'receptionist' },
  { name: 'owner-dashboard-shell', path: '/owner', role: 'owner' },
];

function readJourneys() {
  if (!process.env.PERF_JOURNEYS_JSON) return DEFAULT_JOURNEYS;
  const journeys = JSON.parse(process.env.PERF_JOURNEYS_JSON);
  if (!Array.isArray(journeys) || journeys.some((journey) => !journey.name || !journey.path)) {
    throw new Error('PERF_JOURNEYS_JSON must be an array of {name, path, storageState?}.');
  }
  if (journeys.some((journey) => Boolean(journey.revisitSelector) !== Boolean(journey.revisitContentSelector))) {
    throw new Error('Journeys with revisitSelector must also provide revisitContentSelector to verify the revisited content.');
  }
  return journeys;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] : null;
}

function summarize(samples) {
  const metrics = ['firstVisualMs', 'lcpMs', 'documentResponseEndMs', 'cssResponseEndMs', 'cssTransferBytes', 'fontResponseEndMs', 'fontTransferBytes', 'scriptResponseEndMs', 'scriptResourceCount', 'skeletonMs', 'contentMs', 'revisitMs', 'requestCount', 'supabaseCallCount', 'serverActionCount', 'serverActionMs', 'transferBytes', 'jsTransferBytes', 'longTaskCount'];
  return Object.fromEntries(metrics.map((metric) => {
    const values = samples.map((sample) => sample[metric]).filter(Number.isFinite);
    return [metric, { p50: percentile(values, 0.5), p95: percentile(values, 0.95) }];
  }));
}

async function measure(browser, profile, journey, run, checkOnly) {
  const contextOptions = { viewport: profile.viewport };
  if (journey.storageState) contextOptions.storageState = journey.storageState;
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: profile.latency,
    downloadThroughput: profile.download,
    uploadThroughput: profile.upload,
    connectionType: profile.name === 'slow-3g' ? 'cellular3g' : 'cellular4g',
  });
  await session.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });

  const requests = new Set();
  const supabaseRequests = new Set();
  const scriptRequestIds = new Set();
  const serverActionStartedAt = new WeakMap();
  const serverActionDurations = [];
  let transferBytes = 0;
  let jsTransferBytes = 0;
  session.on('Network.responseReceived', (event) => {
    if (event.type === 'Script') scriptRequestIds.add(event.requestId);
  });
  session.on('Network.loadingFinished', (event) => {
    transferBytes += event.encodedDataLength;
    if (scriptRequestIds.delete(event.requestId)) jsTransferBytes += event.encodedDataLength;
  });
  page.on('request', (request) => {
    requests.add(request);
    if (request.method() === 'POST' && request.headers()['next-action']) serverActionStartedAt.set(request, Date.now());
    if (/supabase\.(co|in)|localhost:(?:54321|15421)/i.test(request.url())) supabaseRequests.add(request);
  });
  page.on('requestfinished', (request) => {
    const startedAt = serverActionStartedAt.get(request);
    if (startedAt !== undefined) serverActionDurations.push(Date.now() - startedAt);
  });
  await page.addInitScript(() => {
    const startedAt = performance.now();
    window.__perfLongTasks = [];
    window.__perfSkeletonAt = null;
    window.__perfContentAt = null;
    window.__perfLcp = null;
    const scan = () => {
      const main = document.querySelector('main, [role="main"]') || document.body;
      const skeleton = main?.querySelector('[aria-busy="true"], [data-loading="true"], .animate-pulse');
      if (skeleton && window.__perfSkeletonAt === null) window.__perfSkeletonAt = performance.now() - startedAt;
      const text = (main?.innerText || '').trim();
      if (!skeleton && text.length >= 60 && window.__perfContentAt === null) window.__perfContentAt = performance.now() - startedAt;
    };
    new MutationObserver(scan).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
    document.addEventListener('DOMContentLoaded', scan, { once: true });
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__perfLongTasks.push(entry.duration);
      }).observe({ type: 'longtask', buffered: true });
    } catch { /* Long Task API is not available in every browser build. */ }
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__perfLcp = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch { /* LCP is unavailable in some browser builds. */ }
  });

  const sample = { profile: profile.name, journey: journey.name, run };
  const navigate = async () => {
    const bytesBefore = transferBytes;
    const jsBytesBefore = jsTransferBytes;
    const actionResponsePromise = journey.captureServerAction
      ? page.waitForResponse((candidate) => candidate.request().method() === 'POST' && Boolean(candidate.request().headers()['next-action']), { timeout: 60_000 }).catch(() => null)
      : null;
    const response = await page.goto(new URL(journey.path, BASE_URL).toString(), { waitUntil: 'commit', timeout: 60_000 });
    if (!response) throw new Error(`No document response for ${journey.name}`);
    await page.waitForLoadState('domcontentloaded', { timeout: 60_000 });
    await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
    await page.locator('body').waitFor({ state: 'visible', timeout: 60_000 });
    await page.waitForFunction(() => window.__perfContentAt !== null, { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(25);
    if (actionResponsePromise) {
      const actionResponse = await actionResponsePromise;
      if (actionResponse) await actionResponse.finished();
    }
    const browserMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const paints = performance.getEntriesByType('paint');
      const resources = performance.getEntriesByType('resource');
      const css = resources.filter((entry) => entry.name.includes('.css'));
      const fonts = resources.filter((entry) => /\.(woff2?|ttf|otf)(?:\?|$)/i.test(entry.name));
      const scripts = resources.filter((entry) => entry.initiatorType === 'script' || /\.js(?:\?|$)/.test(entry.name));
      const latestResponseEnd = (entries) => entries.length ? Math.max(...entries.map((entry) => entry.responseEnd)) : null;
      const fcp = paints.find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? null;
      return {
        firstVisualMs: fcp ?? navigation?.domContentLoadedEventEnd ?? null,
        lcpMs: window.__perfLcp,
        documentResponseEndMs: navigation?.responseEnd ?? null,
        cssResponseEndMs: latestResponseEnd(css),
        cssTransferBytes: css.reduce((total, entry) => total + entry.transferSize, 0),
        fontResponseEndMs: latestResponseEnd(fonts),
        fontTransferBytes: fonts.reduce((total, entry) => total + entry.transferSize, 0),
        scriptResponseEndMs: latestResponseEnd(scripts),
        scriptResourceCount: scripts.length,
        skeletonMs: window.__perfSkeletonAt,
        contentMs: window.__perfContentAt,
        longTaskCount: window.__perfLongTasks?.length ?? 0,
      };
    });
    return {
      ...browserMetrics,
      transferBytes: transferBytes - bytesBefore,
      jsTransferBytes: jsTransferBytes - jsBytesBefore,
      serverTiming: response.headers()['server-timing'] || null,
      serverActionCount: serverActionDurations.length,
      serverActionMs: serverActionDurations.length ? Math.max(...serverActionDurations) : null,
    };
  };

  const first = await navigate();
  if (checkOnly && journey.path !== '/login' && journey.storageState && !page.url().includes(journey.path)) {
    throw new Error(`Protected journey did not stay on ${journey.path}; check the supplied review session.`);
  }
  sample.firstVisualMs = first.firstVisualMs;
  for (const metric of ['lcpMs', 'documentResponseEndMs', 'cssResponseEndMs', 'cssTransferBytes', 'fontResponseEndMs', 'fontTransferBytes', 'scriptResponseEndMs', 'scriptResourceCount']) {
    sample[metric] = first[metric];
  }
  sample.skeletonMs = first.skeletonMs;
  sample.contentMs = first.contentMs;
  sample.jsTransferBytes = first.jsTransferBytes;
  sample.longTaskCount = first.longTaskCount;
  sample.serverTiming = first.serverTiming;
  sample.requestCount = requests.size;
  sample.supabaseCallCount = supabaseRequests.size;
  sample.serverActionCount = first.serverActionCount;
  sample.serverActionMs = first.serverActionMs;
  sample.transferBytes = first.transferBytes;

  if (journey.revisitSelector) {
    const returnUrl = page.url();
    const link = page.locator(journey.revisitSelector).first();
    await link.waitFor({ state: 'visible', timeout: 10_000 });
    const href = await link.getAttribute('href');
    if (!href) throw new Error(`${journey.name}: revisitSelector must identify a link with an href.`);
    const targetUrl = new URL(href, returnUrl).toString();
    const revisitStart = performance.now();
    await Promise.all([
      page.waitForURL(targetUrl, { timeout: 15_000 }),
      link.click(),
    ]);
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
    await Promise.all([
      page.waitForURL(returnUrl, { timeout: 15_000 }),
      page.goBack({ waitUntil: 'commit', timeout: 15_000 }),
    ]);
    await page.locator(journey.revisitContentSelector).waitFor({ state: 'visible', timeout: 15_000 });
    sample.revisitMs = performance.now() - revisitStart;
  } else {
    sample.revisitMs = null;
  }
  await context.close();
  return sample;
}

async function main() {
  if (!Number.isInteger(RUNS) || RUNS < 1 || RUNS > 100) throw new Error('PERF_RUNS must be between 1 and 100.');
  if (requestedProfiles && PROFILES.length !== new Set(requestedProfiles).size) throw new Error('PERF_PROFILE_NAMES contains an unknown or duplicate profile.');
  const journeys = readJourneys();
  const checkOnly = process.argv.includes('--check');
  const origin = new URL(BASE_URL);
  if (!['localhost', '127.0.0.1', '::1'].includes(origin.hostname) && process.env.PERF_ALLOW_PREVIEW !== '1') {
    throw new Error('Use a local production build by default. Set PERF_ALLOW_PREVIEW=1 only for an approved, read-only preview deployment.');
  }
  if (process.env.PERF_MUTATIONS_ALLOWED === '1') {
    throw new Error('This browser harness is read-only. Use a dedicated scratch database test for mutating journeys.');
  }

  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PERF_BROWSER_CHANNEL ? { channel: process.env.PERF_BROWSER_CHANNEL } : {}),
  });
  const results = [];
  try {
    for (const profile of PROFILES) {
      for (const journey of journeys) {
        const state = journey.storageState || (journey.role ? process.env[`PERF_STATE_${journey.role.toUpperCase()}`] : undefined);
        if (journey.role && !state) {
          console.log(`Skipped ${journey.name}: PERF_STATE_${journey.role.toUpperCase()} was not supplied.`);
          continue;
        }
        const configuredJourney = { ...journey, storageState: state };
        const samples = [];
        for (let run = 1; run <= RUNS; run += 1) {
          const sample = await measure(browser, profile, configuredJourney, run, checkOnly);
          samples.push(sample);
          if (run % 5 === 0 || run === RUNS) console.log(`${profile.name} / ${journey.name}: completed ${run}/${RUNS} runs.`);
        }
        results.push({ profile: profile.name, journey: journey.name, runs: samples.length, summary: summarize(samples), samples });
        console.log(`${profile.name} / ${journey.name}: ${JSON.stringify(summarize(samples))}`);
      }
    }
  } finally {
    await browser.close();
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify({ baseUrl: BASE_URL, generatedAt: new Date().toISOString(), runsPerJourney: RUNS, results }, null, 2));
  console.log(`Wrote read-only performance results to ${OUTPUT}`);

  if (checkOnly) {
    const failures = [];
    for (const result of results) {
      const budgets = PERFORMANCE_BUDGETS[result.journey]?.[result.profile];
      if (!budgets) continue;
      for (const [metric, limit] of Object.entries(budgets)) {
        const key = metric.replace(/P\d+$/, '');
        const percentileName = metric.match(/P(\d+)$/)?.[1];
        const measured = percentileName ? result.summary[key]?.[`p${percentileName}`] : null;
        if (!Number.isFinite(measured)) {
          failures.push(`${result.profile}/${result.journey}: ${key} p${percentileName} was not measured`);
        } else if (measured > limit) {
          failures.push(`${result.profile}/${result.journey}: ${key} p${percentileName} ${Math.round(measured)} ms exceeds ${limit} ms`);
        }
      }
    }
    if (failures.length) {
      console.error(`Performance budget failed:\n- ${failures.join('\n- ')}`);
      process.exitCode = 1;
    } else {
      console.log('Performance budget checks passed.');
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
