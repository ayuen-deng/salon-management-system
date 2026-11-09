# Performance audit and Phase 1 baseline

Audit date: 8 November 2026 (Africa/Kampala)  
Application: Next.js 15.5.27, one Mbarara location  
Baseline environment: local optimized production build, cold browser cache, Chromium, Playwright, 20 runs per route and profile.

## Phase 0: audit findings

This section records the original 8 November audit before the later phase work. Its environment and implementation notes are a historical baseline; dated follow-up sections below are the current source of truth where they differ.

### Runtime, regions, and data access

- The app is deployed as a Next.js/Vercel project, but this checkout contains no `.vercel` project metadata and `vercel.json` does not set a function region. The Vercel function region and whether it is co-located with Supabase could not be verified from the repository.
- The Supabase project reference is linked in `supabase/.temp/linked-project.json`; its region could not be read because the CLI tried to write telemetry under the user profile, outside this workspace's write access. Docker is not installed in this environment, so a local Supabase stack is not available.
- App Router route handlers and server components use the default Node.js runtime. `src/middleware.ts` runs in Next.js middleware's Edge runtime. No route overrides a runtime.
- Runtime database access uses `supabase-js` / PostgREST over HTTP. There is no `pg`, `postgres`, or other direct PostgreSQL driver in the dependency tree or application imports. The local Supabase pooler is disabled in `supabase/config.toml`; a hosted Postgres pooler is not used by the app's Data API path.
- Versions installed: `@supabase/supabase-js` 2.117.2 and `@supabase/ssr` 0.5.2. The package manifest declares compatible ranges, so the lockfile determines these installed versions.

### Identity and role gate

- Every matched protected navigation runs `supabase.auth.getUser()` in middleware, then a service-role `app_user` profile query. Non-owner requests also call `is_user_clocked_in`. These are sequential network calls in the current middleware path: up to three round trips before rendering for a non-owner protected navigation.
- The `AppShell` client effect calls `getCurrentUserAction()` on mount. That resolves the user again with `getUser()` and reads `app_user`. Some server pages and actions also call `getAuthUser()`. The exact count per authenticated route/action was not captured because the safe browser baseline had no authenticated storage states.
- Local configuration does not set `signing_keys_path`. Whether the hosted project's JWT signing keys are asymmetric was not verifiable without project Auth settings; current app code does not use local JWT claim verification.
- Identity calls have not been deduplicated. The app remains protected by middleware, role checks, attendance gate, and RLS; this audit made no authorization changes.

### Rendering, fetches, and caching

- The production build reported 73 generated route entries. Many workspace pages are statically prerendered shells that import client views; those views commonly fetch in `useEffect`. The route page files are generally Server Components, while `AppShell`, the workspace views, and interactive forms are Client Components. The root layout stays server rendered and mounts client providers.
- There is no `Server-Timing` instrumentation before this phase. Multiple workspace views fetch after mount, so their route shell can render before data; whether each route has a serial fetch waterfall needs authenticated traces.
- For installed Next.js 15.5.27, the documented defaults are uncached `fetch` and `GET` Route Handlers, and page segments are not reused on ordinary client navigation by default. Shared layouts and loading states are reused; `experimental.staleTimes` can opt page segments into the Router Cache. No shared server cache or `staleTimes` setting is configured here. See the [Next.js 15 caching guide](https://nextjs.org/docs/15/app/guides/caching) and [Next.js 15 upgrade notes](https://nextjs.org/docs/15/app/guides/upgrading/version-15).
- No service worker is registered in `src` or `public`. The public images include `salon_hero.jpg` (194,583 bytes) and `test-owner-direct.png` (42,064 bytes). `next/font` uses Inter with `display: swap`.

### Database and realtime

- `pg_stat_statements`, Supabase Performance/Index Advisors, authenticated `EXPLAIN (ANALYZE, BUFFERS)`, sequential-scan counts, and RLS helper costs could not be read in this environment. There is no local database or scratch database connection. No production data was seeded or mutated.
- The migration set defines indexes, but this audit did not compare them with production query plans. No index change is proposed from this incomplete evidence.
- There are three realtime subscription helpers: app-wide salon broadcasts, user notifications, and staff-skill changes. AppShell calls the salon subscription helper in two separate effects; the receptionist/manager effect also loads the kiosk badge and issues a count request after visit events. The global effect coalesces bursts for 80 ms and calls `router.refresh()`. Each helper removes its channel on cleanup. Subscription counts, event bursts, and refetch totals remain to be measured on authenticated screens.

### Build and bundle

The optimized production build completed. Its route report showed these first-load JavaScript sizes:

| Route group | Next build first-load JS |
|---|---:|
| Shared | 103 KB |
| Reception | 252 KB |
| Manager | 279 KB |
| HR | 244 KB |
| Owner | 225 KB |
| Staff | 217 KB |
| Customer kiosk | 106 KB |
| Queue screen | 237 KB |
| Sign-in | 180 KB |

These are Next.js build-report values, not a claim about JavaScript execution time. The browser baseline separately measured encoded script transfer bytes. No route bundle analyzer or production-source-map inspection was performed, and the report does not show whether a server-only module entered a client bundle.

The warmed build compiled in 28.4 seconds; an earlier initial compilation before the instrumentation changes took 87 seconds. The production server reported ready in 3.5 seconds. `npm run dev`, hot reload, memory, Turbopack, and Windows Defender effects were not measured, so this does not establish a dev-versus-production comparison.

## Phase 1: repeatable baseline harness

Added `npm run perf:baseline`, which uses Playwright/CDP with cold cache, 4x CPU throttling and 390×844 viewport for Uganda 4G (175 ms RTT, 5 Mbps) and slow 3G (400 ms RTT, 400 Kbps), plus an unthrottled 1365×900 desktop profile. It records FCP, a main-content readiness heuristic, requests, Supabase requests, encoded bytes, script bytes, long-task counts, and p50/p95 for 20 runs. It writes the raw sample set to `artifacts/performance/baseline.json`.

Default protected-role journeys are skipped unless explicit Playwright storage-state files are supplied as `PERF_STATE_OWNER`, `PERF_STATE_MANAGER`, `PERF_STATE_HR`, `PERF_STATE_RECEPTIONIST`, and `PERF_STATE_STAFF`. The harness refuses non-local targets unless preview mode is explicitly enabled and refuses mutating flows. This run used only the public kiosk shell, queue display, and sign-in screen; no payment, order, or attendance state was changed.

`contentMs` is the time when the main region first contains at least 60 characters and no recognized loading marker. `skeletonMs` is null when no `[aria-busy]`, `[data-loading]`, or `.animate-pulse` marker appears. FCP is used for first visual response. `revisitMs` is not measured unless a journey supplies an explicit revisit selector. Long-task values are counts, not durations. These definitions keep the numbers reproducible and are not substitutes for LCP/INP/CLS or an authenticated user-flow trace.

### Public-screen cold-load results

Each cell is **p50 / p95**. The three listed routes each had 20 runs per profile. Request and byte counts are effectively per-load counts, so p50 and p95 are the same where shown.

| Profile / route | First visual (ms) | Main content (ms) | Requests | Supabase calls | Transferred bytes | Script bytes | Long tasks |
|---|---:|---:|---:|---:|---:|---:|---:|
| Uganda 4G · kiosk `/desk` | 548 / 608 | 2,659 / 2,825 | 23 / 23 | 0 / 0 | 289,810 / 289,810 | 223,725 / 223,725 | 4 / 4 |
| Uganda 4G · queue `/display/queue` | 648 / 688 | 118 / 129 | 26 / 26 | 0 / 0 | 319,461 / 319,461 | 253,911 / 253,911 | 4 / 5 |
| Uganda 4G · sign-in `/login` | 528 / 556 | 1,297 / 1,335 | 22 / 22 | 0 / 0 | 276,835 / 276,835 | 211,862 / 211,862 | 4 / 4 |
| Slow 3G · kiosk `/desk` | 2,264 / 2,308 | 8,185 / 8,772 | 23 / 23 | 0 / 0 | 289,810 / 289,810 | 223,725 / 223,725 | 3 / 4 |
| Slow 3G · queue `/display/queue` | 2,368 / 2,572 | 138 / 188 | 26 / 26 | 0 / 0 | 319,461 / 319,461 | 253,911 / 253,911 | 3 / 4 |
| Slow 3G · sign-in `/login` | 2,280 / 2,436 | 6,871 / 8,055 | 22 / 22 | 0 / 0 | 276,835 / 310,890 | 211,862 / 211,862 | 4 / 4 |
| Desktop · kiosk `/desk` | 72 / 388 | 1,537 / 2,171 | 23 / 23 | 0 / 0 | 289,810 / 289,810 | 223,725 / 223,725 | 0 / 2 |
| Desktop · queue `/display/queue` | 128 / 140 | 30 / 52 | 26 / 26 | 0 / 0 | 319,461 / 319,461 | 253,911 / 253,911 | 0 / 1 |
| Desktop · sign-in `/login` | 60 / 76 | 162 / 197 | 22 / 22 | 0 / 0 | 363,468 / 363,468 | 211,862 / 211,862 | 0 / 1 |

The Supabase request counts and transfer bytes in the table are browser-originated network requests only. Server-side PostgREST fetches are not included in those browser totals. With opt-in query timing enabled, the local production server logged server-side GETs during the run; some returned slowly and one `visit` request returned HTTP 300. These were reads only. Their results are not attributed to individual browser samples here, so authenticated/data-backed route traces are still required before ranking their cost. The browser-originated count of 0 does not mean the app made no server-side Supabase requests.

### Initial bottleneck ranking

This is a provisional ranking from the limited Phase 1 evidence; the prompt's requested ranking across all authenticated journeys and database plans is not yet possible.

1. **Kiosk first content is late.** On Uganda 4G its p95 main-content time is 2.83 s; under slow 3G it is 8.77 s. FCP appears sooner, indicating that the delay is after first paint. The harness currently records page readiness rather than the kiosk's specific menu/catalogue fetch stages, so the next audit must trace that route before selecting a fix.
2. **Protected navigation makes serial identity and gate calls.** Static code confirms three sequential calls in middleware for a non-owner (Auth, profile, attendance), before any page-specific data. Using the project brief's 150–250 ms round-trip estimate implies 450–750 ms before route data; this estimate is inferred, not measured against a signed-in session.
3. **Workspace JavaScript payloads are still substantial.** The current build reports 279 KB for manager and 244 KB for HR; the queue screen transmits 253.9 KB of script in the cold-load baseline. Long-task counts are visible, but duration and INP are not yet measured.
4. **Client views fetch after the server shell.** Many client views start `useEffect` data loads after page mount. The kiosk's FCP-to-content gap provides measured evidence of late completion, but authenticated waterfall traces are still needed to identify the specific round trips.
5. **Realtime invalidation may fan out into extra work.** AppShell has two salon-broadcast subscriptions and the global handler calls `router.refresh()` after an 80 ms debounce; the receptionist/manager subscription also reloads a badge count. This is a code-based hypothesis; burst/refetch counts were not measured.

## Phase 2: first measured kiosk optimization

The initial catalogue action queried five independent endpoints in series. The kiosk uses only service/variant data and shared service metadata; staff assignments and owner-audit labels are unused there. The change runs the full catalogue reads concurrently, adds a kiosk-specific path that reads only service/variant data plus metadata, and defers that action until a kiosk session is paired. The initial pairing check now server-renders a branded busy shell instead of a spinner-only message.

The table below measures the catalogue Server Action from a fresh unpaired `/desk` page where the action ran in the before and action-after measurement builds. The final build now defers that same action until pairing succeeds. `serverActionMs` is the browser-observed request/response time under the named network and CPU profile. It includes the browser-to-application round trip and the server work. Before used five serial Supabase GETs; action-after used two concurrent GETs. Both used 20 runs.

| Profile | Before p50 / p95 (ms) | After p50 / p95 (ms) | p95 change |
|---|---:|---:|---:|
| Uganda 4G | 1,434 / 2,792 | 320 / 750 | −73% |
| Slow 3G | 1,745 / 1,869 | 578 / 899 | −52% |

The page shell is a separate measurement. The final unpaired kiosk no longer makes a catalogue request; it made zero Server Actions and zero browser-originated Supabase requests. The DOM busy marker appeared at p95 57 ms on Uganda 4G and 56 ms on slow 3G. This is the marker's DOM time, not proof that it was painted then. Actual first paint was p95 2.34 s and 2.35 s respectively; main content was p95 3.15 s and 7.04 s. The main-content budget is still missed, especially on slow 3G. The 201 KB build-reported first-load JS and the hydration delay remain candidates, but this pass did not yet isolate them, so no bundle change is proposed.

| Final unpaired shell | First visual p50 / p95 | Busy marker DOM p50 / p95 | Main content p50 / p95 | Requests p50 / p95 |
|---|---:|---:|---:|---:|
| Uganda 4G | 640 / 2,340 ms | 25 / 57 ms | 1,409 / 3,151 ms | 22 / 22 |
| Slow 3G | 2,332 / 2,352 ms | 41 / 56 ms | 6,426 / 7,045 ms | 22 / 22 |

The kiosk-specific result preserves the fields used by the kiosk (service, category/audience, image metadata, variants, prices and durations). Two repository tests verify that the shared catalogue inputs still overlap and the mapped output is preserved, and that the kiosk path skips staff/audit reads. No schema or business-rule change was made. Query latency was measured against the configured Supabase Data API with GET requests; no records were written. A paired-device menu interaction was not benchmarked because no safe local/scratch Supabase session was available.

### Phase 2: kiosk bootstrap and hydration trace

The follow-up trace measured the unpaired `/desk` shell in 20 cold runs per profile. Before the code split, slow 3G reached CSS response end at 2.16 s, first contentful paint at 2.32 s, and main-content marker at 6.63 s p95. Script transfer was 223,924 bytes across 19 script resources; no server action or browser Supabase request ran.

The kiosk route now begins at a small entry component. It checks the tablet session and renders the pairing form there; only a device with a saved session loads the full kiosk workflow. The optimized build reports `/desk` first-load JavaScript at 106 KB, down from 201 KB before the split. In the browser trace, unpaired script transfer fell from 223,924 to 201,770 bytes (−9.9%) and script resources from 19 to 16. No requests or data writes were added.

The code split has **not yet met the navigation-content budget**. On slow 3G, first contentful paint stayed at 2.32 s p50 / 2.43 s p95, and the main-content marker was 6.44 s p50 / 7.48 s p95. The result suggests remaining delay in shared startup resources and hydration; the split only reduced the route-specific payload. LCP p95 varied substantially in the new run (7.74 s versus 2.42 s in the prior trace), so that metric needs a stable repeat before drawing a conclusion. The 13.2 KB CSS response still ended at about 2.20 s p95 and the 48.7 KB Inter font response at about 6.41 s p95.

| Unpaired `/desk` | Before p50 / p95 | After p50 / p95 |
|---|---:|---:|
| Uganda 4G · FCP | 604 / 640 ms | 636 / 944 ms |
| Uganda 4G · content marker | 1,252 / 1,322 ms | 1,501 / 2,717 ms |
| Uganda 4G · JS transfer | 223,924 B | 201,770 B |
| Slow 3G · FCP | 2,316 / 2,420 ms | 2,316 / 2,432 ms |
| Slow 3G · content marker | 6,383 / 6,629 ms | 6,442 / 7,475 ms |
| Slow 3G · JS transfer | 223,924 B | 201,770 B |

These are cold-load samples with browser cache disabled. The 4G content p95 is noisy, and the LCP observer results are not stable enough to treat as a regression or improvement. The route-specific bundle reduction is repeatable; the main-content budget still fails on both profiles. The next optimization must target shared resources or hydration and be measured against these same journeys.

The kiosk subtask above reduces bundle transfer but does not meet its content budget. The final Phase 2 closeout below records the additional identity work and distinguishes code-path evidence from authenticated browser measurements.

### Relevant budgets

| Interaction | Goal |
|---|---:|
| Click acknowledgement | ≤100 ms |
| Navigation shell and skeleton | ≤150 ms |
| Navigation content p75 / p95 | ≤1.0 s / ≤2.0 s |
| Revisit within 30 seconds | ≤100 ms |
| Kiosk order to reception | ≤500 ms |
| LCP / INP / CLS | ≤2.5 s / ≤200 ms / ≤0.1 |

## Verification and remaining measurement limits

- Phase 1 passed: `npm run check:architecture`, `npm run check:loading`, `npm run check:audit`, the optimized production build, and the baseline/seed script syntax checks. At the kiosk split checkpoint, architecture/loading/audit checks, lint, 32 Vitest tests, and the optimized production build passed. The final Phase 2 verification is recorded below. The design-token check still reports five pre-existing forbidden classes in the untouched manager staff and credential-slip views.
- The performance dataset SQL and guard are added as `supabase/perf/seed.sql` and `scripts/perf-seed.mjs`. The command requires an explicit localhost PostgreSQL URL and confirmation, and rejects remote hosts. It has not been executed because no local database/Docker is available.
- `check:data`/pgTAP could not be run without the local Supabase/Docker runtime. The Supabase CLI also failed when attempting to write its telemetry file outside this workspace.
- The full `qa:run` suite was not run because it reads `.env.local`, uses the linked Supabase service-role key, and creates business records. Running it against the linked production project would contaminate live salon data. Authenticated Playwright flows were not run for the same live-data/lockout safety reason.
- The existing owner-dashboard Vitest integration test made a read-only GET to the linked Supabase project (it is named “Live Remote DB Integration”). It passed; no test wrote records.
- `npm run check:data` and full mutating Playwright/QA flows remain unrun: this environment has no Docker-backed local Supabase instance, and the only linked database is the live salon project.
- No database mutations, migrations, indexes, or production actions were performed. `pg_stat_statements`, performance advisors, authenticated RLS query plans, route revisit timing, web-vitals, authenticated journeys, and deployed preview measurements remain open.

## Phase 1 and Phase 2 files

- `scripts/perf-baseline.mjs`: repeatable read-only browser baseline.
- `scripts/perf-seed.mjs`, `supabase/perf/seed.sql`: localhost-only synthetic volume fixture and guard.
- `src/middleware.ts`: development/preview-only `Server-Timing` for middleware Auth, profile, and attendance stages.
- `src/shared/lib/perf-timing.ts`, `src/shared/lib/supabase-server.ts`, `src/shared/lib/supabase.ts`: opt-in, path-only Supabase request timing logs; no query values or credentials are logged.
- `package.json`: `perf:baseline` and `perf:seed` scripts.
- `artifacts/performance/baseline.json`: raw 20-run samples.
- `artifacts/performance/phase2-catalogue-before.json`, `phase2-catalogue-after.json`, and `phase2-kiosk-shell-after.json`: raw Phase 2 samples.
- `artifacts/performance/phase2-kiosk-resource-before.json` and `phase2-kiosk-resource-after.json`: raw 20-run CSS, font, script, FCP, LCP, and content-marker traces.
- `src/modules/catalogue/models/catalogue.repository.test.ts`: mocked output-equivalence and parallel-query tests.
- `src/modules/desk/views/desk-tablet-entry.view.tsx`: lightweight kiosk pairing entry that defers the paired workflow module.
- `src/middleware.ts`, `src/modules/auth/models/middleware-user-context.ts`, and `src/shared/views/layout/app-shell.tsx` / `app-shell-client.tsx`: verified identity context, request-scoped reuse, and server-provided shell identity.
- `src/middleware.test.ts` and `src/modules/auth/models/middleware-user-context.test.ts`: header-spoofing, API, role, attendance-gate, and request-context tests.

### Phase 2 closeout: request-scoped identity reuse

The original protected non-owner navigation path performed `auth.getUser()`, an `app_user` profile read, and an attendance RPC serially in middleware. The updated path uses Supabase `auth.getClaims()` to verify the signed JWT locally when the project uses an asymmetric signing key, then runs the minimal active-profile read and attendance RPC concurrently. Supabase documents that `getClaims()` verifies asymmetric JWTs locally with a cached JWKS, while symmetric signing keys require an Auth-server verification request; this project’s public JWKS returned an ES256 key during this audit. The JWKS endpoint is public and contains verification keys only. See [Supabase getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims) and [JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys).

After middleware verifies the JWT and active profile, it stamps a request-only identity context onto forwarded headers. Incoming copies of those headers are removed first. Server components and actions read the validated context through React `cache()` and no longer repeat `getUser()` plus the `app_user` lookup. `AppShell` now receives the display name from its server wrapper instead of calling `getCurrentUserAction()` after hydration. Notification API routes reuse the same verified identity but retain their existing JSON 401 behavior and do not inherit the workspace attendance gate. No shared or cross-request identity cache is used.

| Request path | Before | After | Evidence |
|---|---|---|---|
| Protected non-owner page | Auth, profile, then attendance, serial | Locally verified claim, profile and attendance overlapped | Middleware code and mocked timing hooks |
| Authenticated Server Action/page identity lookup | Additional Auth call plus profile read at each `getAuthUser()` call | Reuses the middleware request context | Request context unit tests and middleware tests |
| App shell mount | One `getCurrentUserAction()` plus its Auth and profile reads | No post-hydration identity request | Removed shell effect; server wrapper supplies name |
| Notification API | Handler Auth lookup plus profile read | Middleware claim/profile validation reused in handler | Added middleware test; attendance RPC is not called |

The protected page path now has one cross-region database wave for profile and attendance rather than two sequential waves. Using the project brief’s 150–250 ms round-trip estimate, that removes roughly one database RTT (about 150–250 ms) from the middleware critical path; this is an inference from call ordering, not a signed-in browser timing. Asymmetric `getClaims()` avoids a separate Auth-server RTT after the JWKS is cached. The app still performs two independent PostgREST calls for profile and attendance; they were not combined into a new RPC because no scratch database was available to validate such a migration. No query plan, RLS policy, or authorization rule was changed.

Mocked middleware tests verify exactly one claim verification, one profile read, and one attendance call for protected navigation; profile and attendance are started together; forged identity headers are stripped; an unclocked Server Action remains a 403; notification API calls skip attendance; and login’s current-user action is not incorrectly forced through the workspace attendance gate. These tests validate the execution path, not real network latency.

### Phase 2 status and verification

The measured catalogue action and bundle reductions are complete, and repeated identity lookups are removed from the middleware-to-server-component/action path. The initial pairing-page implementation missed the 2.0 s content target. It now renders the pairing form in the first response and checks the saved device session after hydration. A 20-run cold-cache retest measured kiosk content p95 at **348 ms on Uganda 4G** and **306 ms on slow 3G**, passing the content budget on both profiles. FCP/LCP p95 was 2.128 s on Uganda 4G and 2.588 s on slow 3G; the slow-3G LCP remains 88 ms over the 2.5 s target. Identity before/after values are call-count and RTT estimates rather than authenticated browser p50/p95. Other protected-role journeys, remote Vercel-to-Supabase placement, live query plans, revisit and interaction timings remain unmeasured.

At the initial Phase 2 checkpoint, lint, architecture/loading/audit checks, 44 Vitest tests, a production build, and four read-only public-screen Playwright checks passed. The paired kiosk submission was skipped because it needs a paired test device. The later local Docker/pgTAP verification and current Windows Vitest issue are recorded in the dated Phase 3 checkpoint below. No hosted production migration or mutation was performed. This initial project snapshot was committed locally on 2026-11-08 at the user's request.

Outside-code follow-up: confirm the production Supabase region and configure the Vercel function region to match where available. This cannot be established from this checkout. A test role session and local scratch Supabase are also needed to collect authenticated journey p50/p95 and run pgTAP plus the full mutation correctness suite safely.

## Remaining phase status

- **Phase 3 (data layer): local work complete; production validation remains open.** The local Docker Supabase stack was reset from migrations, loaded with isolated synthetic fixtures, and used to validate 58 pgTAP assertions, RLS role isolation, and evidence-backed indexes/view changes. A function-scoped custom-plan migration brought the local PostgREST report sample under the 1-second p95 budget. Hosted production query plans, advisor output, and production p95 remain unavailable.
- **Phase 4 (client speed and caching): partially complete.** The kiosk pairing boundary defers the larger flow; one private salon Realtime channel feeds a coalescer, and the kiosk badge shares the existing event instead of opening a second channel. When a mounted client view handles an invalidation, the shell skips the redundant `router.refresh()`. The latest work preserves the exact coalesced table names and adds dependency filters to the reception live queue, manager queue screen, kiosk catalogue, kiosk order list, check-in workspace and global attendance state. Unrelated table changes no longer trigger those local fetches; routes without a local listener keep the Server Component fallback. The check-in workspace refreshes catalogue, stylist list, business-day state, queue/draft and kiosk-order data through distinct listeners tied to their source tables. The 80 ms coalescer still collapses bursts and cancels on unmount. Revisit measurement now waits for browser Back and an explicit visible-content selector; previous samples did not provide a valid revisit timing. The HR PDF exporter loads `pdf-lib` only after PDF export is selected. On the production build, the HR performance route is 244,970 bytes gzip first-load JS; its deferred PDF chunks total 423,324 bytes raw / 176,203 bytes gzip and are absent from the initial chunk list. This is a build-manifest measurement, not a browser network trace. A dependency map for every client view, revisit samples, cache isolation and Router Cache/prefetch measurements remain open. No protected data is placed in a shared cache.
- **Phase 5 (development speed and guardrails): partially complete.** `npm run dev` opts into Turbopack. `npm run perf:local-check` starts a local optimized server, runs the repeatable 20-run cold kiosk check on Uganda 4G/slow 3G, applies the 2-second content p95 budget, then stops the server. The earlier 20-run check measured 3,751 ms and 6,749 ms p95 and failed. After first-response pairing content, the retest measured 348 ms and 306 ms and passed. Five pre-existing design-token exceptions were removed from manager PIN and credential-slip styling; the token check now runs with lint, architecture/loading/audit checks, Vitest, production build and the kiosk performance gate in GitHub Actions for pull requests and main pushes. Production telemetry, route transition reporting, Defender exclusions, and dev-versus-production memory/hot-reload comparisons remain open. The local Vitest runner currently fails before collecting tests with Windows `EPERM` resolving `node_modules/vitest/dist/spy.js`; the path resolves in the main process, but the worker failure still needs a Windows-specific fix or CI result.

Accordingly, **the five-phase performance project is not finished**. Phase 2’s scoped optimizations are implemented. Phase 3 local verification is complete but production evidence is still unavailable; Phase 4 and Phase 5 retain the specific follow-ups above. No claim of system-wide budget compliance is made.

### Phase 3 local database checkpoint (2026-11-08)

The preceding prerequisite note records the earlier blocked attempt. Docker Desktop is now installed and running. Phase 3 work below used only the local Supabase stack on Docker; the linked hosted salon project was not pushed to, seeded, or mutated.

- Remapped local Supabase ports in `supabase/config.toml` to ports available on this Windows installation, disabled the stale seed-file path (baseline demo data is already created by migrations), and repaired a historical migration declaration that prevented a clean local reset.
- Reset the local database from migrations, including the new attendance indexes and HR attendance view optimization. The clean migration replay succeeded.
- Added an explicit localhost-only benchmark seeder with an opt-in confirmation and Docker/`psql` fallback for Windows. Seeded synthetic local data only: 30,000 customers, 150,000 visits, visit lines and payments, 20,000 appointments, 58,400 attendance rows, and 100,000 audit rows. The seed uses a registered audit action and unique staff/day attendance fixtures.
- Evidence-backed index: the HR attendance lookup changed from a sequential scan over 60,000 rows (4,000 shared buffers, 32.807 ms) to an index scan (102 buffers, 0.186 ms), about 176x faster in this local fixture. The same lookup on the clean 58,400-row replay measured 0.198 ms.
- Evidence-backed report indexes: the per-staff target-count query changed from full scans of `visit` and `visit_service` (347.616 ms for one staff member) to index-only service-line lookups plus indexed visit checks (29.278 ms, about 12x faster). The full HR report’s first recorded call was 8.309 s before these indexes; after indexing, three repeated calls measured 1.178 s, 2.242 s, and 0.739 s (median 1.178 s). Shared-buffer hits fell from about 508k to 268k and temp blocks from 11.5k to 917. These are local synthetic-data measurements, not production p95. A set-based rewrite was tested and discarded because it increased temp I/O and was slower end to end.
- Evidence-backed view change: materializing date bounds in `hr_attendance_daily` reduced the comparable local view query from 822.181 ms to 638.328 ms (22.4%) with identical rows. An `EXCEPT ALL` comparison returned no differences. After clean reset/seed, the optimized view returned 13,903 rows in 544.830 ms; the remaining cost is still high and the result set is large.
- The initial large synthetic-data pgTAP run exposed slow report execution and was stopped after seven minutes. After the report indexes were applied, the complete pgTAP suite passed against the synthetic fixture: 58 assertions across 9 files in 8 wallclock seconds. Direct SQL timings from the earlier run were 0.7–2.2 seconds, but they did not represent the app's PostgREST request path.
- Repaired the authenticated `app_user` policy recursion with `current_app_user_role()`, a `SECURITY DEFINER` helper that reads only the caller's own role. Under local `authenticated` role, the HR fixture sees the same 8 seeded profiles as before; a staff fixture sees only its own profile (1). Authenticated `EXPLAIN (ANALYZE, BUFFERS)` now succeeds and uses `attendance_location_business_date_idx`. On the clean baseline fixture it returned no matching attendance rows in 0.096 ms; this timing is only a policy/index smoke check, not representative performance data. RLS remains enabled and unchanged in scope.
- `npm run check:architecture`, `npm run check:loading`, and `npm run check:audit` passed. `npm run build` passed and generated 73 pages. Vitest could not collect tests because Windows returned `EPERM` when Vite resolved `node_modules/vitest/dist/spy.js` (14 unhandled resolver errors; zero tests collected). `qa:run` was not used because it reads service-role configuration and mutates business data; the available linked project is hosted, not a test target.

### Phase 3 follow-up measurement (2026-11-09)

- Used the local Docker Supabase API (`127.0.0.1:15421`) and the seeded HR actor to call the same `get_staff_performance_report` RPC used by the app, for the default month-to-date range (2026-11-01 through 2026-11-09). No hosted project was used or changed.
- Before the latest index trial, three successful PostgREST calls measured 3.2 s, 5.0 s, and 5.5 s (p50 5.0 s; n=3, not a reliable p95). The cold first call took 10.6 s. A direct warm SQL call measured 2.6–3.2 s, confirming that SQL-only timings understate the app's PostgREST request path.
- The nested report statement's local `pg_stat_statements` entry recorded 504,136 shared-buffer hits and about 11.5k temp blocks read / 11.2k written. A local-only trial added a partial covering index on measured completed service lines by `visit_id`; it is now migration `20261108000005_hr_measured_service_index.sql`. Afterward, four measured PostgREST calls were 0.35 s, 0.61 s, 1.61 s, and 5.19 s (nearest-rank p50 0.61 s, observed max 5.19 s). A later 20-run attempt still hit the local 8-second PostgREST statement timeout, so a reliable passing p95 has not been established and the tail-latency issue is not resolved.
- `supabase test db` timed out on the local mapped PostgreSQL port. For verification, all nine rollback-based pgTAP files were streamed directly into the healthy local database container; all 58 assertions passed. No hosted database was targeted.
- The local synthetic results miss the 1.0 s navigation-content p75 budget at the tail and cannot establish production p95. The authenticated browser journey remains unmeasured because local dev sign-in stalled; the temporary dev server was stopped after the attempt.

**Historical checkpoint superseded by the 2026-11-09 plan-cache follow-up below.** At this point, the measured-service index alone had not removed the report's multi-second outliers. The follow-up isolates a cached generic plan as the remaining local bottleneck and records the local mitigation and retest. Hosted query plans, production latency, and the authenticated browser journey remain open; the local synthetic fixture is not evidence of production performance.

### Staging verification and authenticated performance sample (2026-11-09)

- Provisioned a dedicated Supabase project, `mzuri-staging`, without changing the existing salon production project. The staging migration ledger matches all 34 local migrations, and `change-temporary-pin`, `provision-staff-account`, and `reset-staff-pin` are active.
- Ran the nine rollback-only pgTAP files directly against the staging project after the CLI's remote test container failed with restricted access to the `extensions` schema. All 58 assertions passed; no grants were broadened.
- The concurrent multi-role login/identity-isolation browser test passed. A staging manager opened a synthetic business day, paired a reception tablet, and submitted one unpaid test order. No payment was entered. These staging-only records are retained for QA and will follow the normal order-expiry policy.
- Built the app against staging (73 routes) and `/api/health` reported a connected database. Architecture, loading, audit, design-token, lint, and TypeScript checks passed. Vitest passed 46 tests outside the Windows sandbox; inside the sandbox its worker fails resolving `vitest/dist/spy.js` with `EPERM`.
- A 20-run authenticated manager desktop sample (`artifacts/performance/staging-manager-desktop.json`) measured content p50/p95 **1.17/3.20 s**, first visual p50/p95 **0.47/2.30 s**, and server-action p50/p95 **0.56/1.84 s**. Content p95 misses the 2.0-second target. This is the local app talking to hosted staging, not a Vercel route or production measurement; investigate the dashboard action/query path before claiming the target passes.
- Remaining phase work: finish broad-listener dependency inventory, authenticated revisit and cache-isolation measurement, optimize and retest the authenticated manager navigation, measure on a Vercel preview configured for staging, and collect production telemetry/query evidence in an approved observation window. A preview environment and production observation are not configured in this checkout.

### Phase 4/5 checkpoint (2026-11-09)

- The unpaired kiosk now renders its pairing form in the first response. A repeated cold-cache Chromium check (`artifacts/performance/phase2-kiosk-ssr-after.json`, 20 runs per profile) measured main-content p95 at 348 ms on Uganda 4G and 306 ms on slow 3G, passing the 2.0 s budget. FCP/LCP p95 was 2.128 s and 2.588 s respectively; slow-3G LCP misses the 2.5 s target by 88 ms. The measurement was local and read-only; it used zero Supabase calls and zero Server Actions. This is content readiness, not proof that the PIN pairing interaction is hydrated or acknowledged within 100 ms.
- Realtime invalidation retains its coalesced table list instead of rewriting it as `*`. Dependency-aware refresh is in place for several high-traffic client areas and the global attendance state. The salon event still contains table names only. Other client views retain broad invalidation until their exact read dependencies can be audited safely.
- The baseline harness’s optional revisitation timing now requires a visible-content selector and waits for the Back navigation plus content visibility. No authenticated revisit result was collected because no dedicated safe role-state file is available.
- `npm run build`, `npm run lint`, `npm run check:architecture`, `npm run check:loading`, `npm run check:audit`, and `npm run check:tokens` passed after these changes. The Windows sandbox’s Vitest worker raises `EPERM` resolving `vitest/dist/spy.js`; outside the sandbox, all 45 local tests across 13 files passed with the existing live-DB integration test excluded. No hosted Supabase test ran. The GitHub Actions workflow now includes Vitest and the cold kiosk performance budget; it has not yet run on GitHub.
- The local performance server was stopped after measurement. The downloaded Playwright browser cache was removed. The Docker-backed Supabase database was not changed by this checkpoint, and the hosted database was not contacted.

### Phase 4/5 continuation (2026-11-09)

- Audited the Reception Visits view query: it reads `visit`, `visit_service`, `payment`, `receipt`, `business_day`, `customer`, `app_user`, `service_variant`, and `service`, and its preview also reads kiosk orders. Its live refresh now listens only to those tables plus `kiosk_order_request`; the previous five-second full data polling loop was removed. This avoids duplicate reads while preserving immediate updates through the shared Realtime invalidation channel.
- Narrowed the manager customer directory to `customer` and `app_setting` changes, and the owner customer directory to `customer` and `visit`, based on their repository queries and tier-setting source. This continues the per-view dependency audit; other server-action-backed screens still need the same source review before filtering.
- Audited the owner visits, payments, waits, daily summaries, audit ledger, and settings repositories and added their exact data-source dependency lists to live refresh. This prevents unrelated salon writes from re-running these protected owner queries; the broader owner dashboard and other server-action-backed views still need their own source review.
- Added source-scoped refreshes for manager catalogue/prices (`service`, `service_variant`), discount rules (`discount_reason`), paired devices (`device`, `app_user`), and approval requests (`approval_request`, `app_user`). The remaining manager, HR, and staff views are still pending repository-level dependency review.
- Continued that audit for manager paper entry, appointments (with separate appointment-list and option refreshes), reports, staff directory, and queue control, using their repository read sets instead of one broad page refresh.
- Scoped manager visits, payments, reconciliation, and day operations to the visit/payment/business-day/statement sources they aggregate, including the audit/history sources consumed by closeout.
- Scoped the HR and owner staff performance reports to the actual report function's underlying tables, narrowed the HR staff, access, leave, and overview feeds to their repository/view sources, and narrowed the owner overview to its dashboard reads. The owner overview no longer repeats its full server/database aggregation every 15 seconds just to advance displayed wait timers; it advances those labels locally and uses realtime events for data changes.
- Scoped the remaining receptionist customer, tablet, close-prep, appointment, and checkout refreshes to their query sources. Removed the three-second tablet-session and five-second appointment/checkout database polling loops; the shared salon realtime invalidation channel now drives those updates. Paper-entry catalogue and staff metadata refresh independently from service and user changes.
- Removed the one-second staff queue, three-second queue-display, and five-second reception queue/draft polling loops; those screens now rely on their source-scoped realtime invalidation hooks. Separated reception workspace initialization from active kiosk-order claim renewal, so opening or changing an order no longer re-fetches the page's initial catalogue/stylist/business-day data.
- Removed the legacy reception queue's 15-second polling fallback as well; its existing `visit` / `visit_service` invalidation listener handles queue changes without periodic reads.
- Kiosk day-state checks now use a dedicated public Realtime signal containing no row contents, with a 30-second connectivity fallback and immediate checks on reconnect/tab return; this replaces the 900 ms RPC polling loop. The new `20261109000002_public_kiosk_business_day_signal.sql` migration was applied and recorded in local Docker Postgres only; the hosted database was not contacted.
- Validated this continuation with the optimized Next.js build (73 routes), targeted ESLint, and the architecture, loading, audit-registry, and design-token checks. The existing Next.js ESLint-plugin advisory remains; no type or compile errors were reported.
- Re-ran 20 read-only kiosk-shell samples per mobile profile against the local optimized server (results: `artifacts/performance/kiosk-local-2026-11-09.json`). Main-content p95 was **871 ms on Uganda 4G** and **275 ms on slow 3G**, with zero Supabase calls. On slow 3G, a second 20-run sample measured content p95 **241 ms** and LCP p95 **2,436 ms** (`artifacts/performance/kiosk-slow3g-repeat-2026-11-09.json`). Across the two slow-3G runs, pooled content p95 was **275 ms** and pooled LCP p95 was **2,532 ms** (maximum **3,368 ms**). The 2-second content budget passes; LCP is marginal and not a robust 2.5-second pass. Both route-only runs made zero Supabase calls, and their temporary local servers were stopped afterward.
- Scoped HR audit and rota refreshes to their audit, user, rota, and policy sources. Fixed HR attendance live updates so record changes refresh the attendance rows as well as policy/balance data. Staff attendance, leave, history, target, appointments, and queue views now filter invalidations to their repository dependencies; this reduces refetches and closes stale attendance rows when HR corrects them.
- Verified the production build completes (73 routes generated) and ran ESLint successfully for the changed Reception Visits view. The optimized build completed with the existing Next.js ESLint-plugin advisory; no type or compile errors were reported.
- Marked the three `CREATE INDEX CONCURRENTLY` migrations with Supabase's `-- pg-delta: transaction=false` directive, so CLI migration runs do not wrap them in a transaction. Supabase documents that the GitHub database branching integration ignores this directive, so these online-index migrations must be applied through the CLI or an appropriate nontransactional SQL session rather than that integration.
- Docker Desktop is installed under the per-user Programs directory, so its CLI is not on this shell's `PATH`. The local Supabase DB, Studio, PostgREST, Realtime, Auth, Storage, and supporting services were running; the Vector container was restarting. This continuation initially did not query or mutate a database; the separately documented plan-cache follow-up below ran read-only report queries and applied a migration only to local Docker Postgres. The hosted project was not contacted.
- Remaining Phase 4 work: inventory dependencies for the other broad client refresh listeners, collect authenticated navigation/revisit traces, verify Router Cache isolation and route transitions, and measure production web vitals. Remaining Phase 5 work: run the new GitHub Actions workflow remotely, add production telemetry, and compare development memory/hot-reload behavior. Phase 3's local database tests remain verified by the prior 58-assertion pgTAP run; hosted query plans and reliable production report p95 still require a safe production observation window.

### Phase 3 report plan-cache follow-up (2026-11-09)

- On the isolated Docker database with synthetic fixtures, the HR performance report exceeded a 6-second statement timeout when its caller used PostgreSQL's generic plan. In a rollback-only comparison, forcing a custom plan for the report completed in approximately 0.1–0.2 seconds.
- Added `20261109000001_hr_report_custom_plan.sql`, which scopes `plan_cache_mode = force_custom_plan` to `get_staff_performance_report(uuid, date, date, text, uuid)`. This per-function setting avoids changing pooled caller sessions. The migration was applied and recorded only in local Docker Postgres; the Supabase CLI's local mapped-port connection terminated unexpectedly, so direct `psql` through the local DB container was used. The hosted database was not contacted.
- With the migration, 20 same-session local SQL executions measured p50 **199 ms**, p95 **424 ms**, max **762 ms**. After restarting only the local PostgREST container to clear old connection plans, 20 local API requests after two warmups measured p50 **220 ms**, p95 **503 ms**, max **2,403 ms**. The sample meets the local 1-second p95 request budget, but its max remains an outlier. It uses synthetic local data and does not include an authenticated browser journey or Vercel network path.
- **Phase 3 local work is complete; production validation remains open.** No staging database is available, so no hosted load test or production plan inspection was run. A production-only advisor review, query plans, report p95 and slow-3G/browser validation must wait for an approved observation window or staging environment. Do not extrapolate these local measurements to production.
