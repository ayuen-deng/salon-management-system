import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE_URL = 'http://localhost:3000';
const OUT_DIR = 'test-results';

async function run() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Context (1280x800)
  const desktopCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await desktopCtx.newPage();

  console.log('Logging in as HR (David Kato)...');
  await page.goto(`${BASE_URL}/login?role=hr`);
  await page.fill('input[type="text"]', 'hr');
  await page.fill('input[type="password"]', '333333');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/hr', { timeout: 30000 });
  await page.waitForTimeout(1000);

  console.log('Capturing HR Overview (Desktop)...');
  await page.screenshot({ path: `${OUT_DIR}/hr-overview-desktop.png`, fullPage: true });

  console.log('Navigating to HR Staff Directory...');
  await page.click('a[href="/hr/staff"]');
  await page.waitForURL('**/hr/staff', { timeout: 15000 });
  await page.waitForTimeout(1500);
  console.log('Capturing HR Staff Directory (Desktop)...');
  await page.screenshot({ path: `${OUT_DIR}/hr-staff-desktop.png`, fullPage: true });

  console.log('Navigating to HR Access...');
  await page.click('a[href="/hr/access"]');
  await page.waitForURL('**/hr/access', { timeout: 15000 });
  await page.waitForTimeout(1500);
  console.log('Capturing HR Access (Desktop)...');
  await page.screenshot({ path: `${OUT_DIR}/hr-access-desktop.png`, fullPage: true });

  await desktopCtx.close();

  // 2. Tablet Context (1024x768)
  const tabletCtx = await browser.newContext({
    viewport: { width: 1024, height: 768 },
  });
  const tabletPage = await tabletCtx.newPage();

  console.log('Logging in as HR on Tablet (1024px)...');
  await tabletPage.goto(`${BASE_URL}/login?role=hr`);
  await tabletPage.fill('input[type="text"]', 'hr');
  await tabletPage.fill('input[type="password"]', '333333');
  await tabletPage.click('button[type="submit"]');
  await tabletPage.waitForURL('**/hr', { timeout: 30000 });
  await tabletPage.waitForTimeout(1500);

  console.log('Capturing HR Overview (Tablet 1024px)...');
  await tabletPage.screenshot({ path: `${OUT_DIR}/hr-overview-tablet-1024.png`, fullPage: true });

  await tabletPage.goto(`${BASE_URL}/hr/staff`);
  await tabletPage.waitForTimeout(1500);
  console.log('Capturing HR Staff Directory (Tablet 1024px)...');
  await tabletPage.screenshot({ path: `${OUT_DIR}/hr-staff-tablet-1024.png`, fullPage: true });

  await tabletPage.goto(`${BASE_URL}/hr/access`);
  await tabletPage.waitForTimeout(1500);
  console.log('Capturing HR Access (Tablet 1024px)...');
  await tabletPage.screenshot({ path: `${OUT_DIR}/hr-access-tablet-1024.png`, fullPage: true });

  // Isolation Text Scan check: assert NO financial or customer words on pages
  console.log('Running Isolation privacy text scan across HR pages...');
  const pagesToScan = ['/hr', '/hr/staff', '/hr/access'];
  const forbiddenTerms = ['UGX', 'revenue', 'receipt', 'payment', 'total_final'];

  for (const p of pagesToScan) {
    await tabletPage.goto(`${BASE_URL}${p}`);
    await tabletPage.waitForTimeout(1000);
    const content = await tabletPage.content();
    for (const term of forbiddenTerms) {
      if (content.toLowerCase().includes(term.toLowerCase())) {
        console.error(`🚨 LEAK DETECTED on ${p}: Found forbidden term "${term}"!`);
        process.exit(1);
      }
    }
  }

  console.log('✅ Isolation privacy text scan passed with 0 leaks.');
  await tabletCtx.close();
  await browser.close();
  console.log('✅ Screenshots and test completed.');
}

run().catch((err) => {
  console.error('Error during test:', err);
  process.exit(1);
});
