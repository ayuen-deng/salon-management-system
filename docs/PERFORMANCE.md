# Performance audit and Phase 1 baseline

Audit date: 8 November 2026 (Africa/Kampala)  
Application: Next.js 15.5.27, one Mbarara location  
Baseline environment: local optimized production build, cold browser cache, Chromium, Playwright, 20 runs per route and profile.

## Phase 0: audit findings

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
| Shared | 102 KB |
| Reception | 251 KB |
| Manager | 455 KB |
| HR | 420 KB |
| Owner | 225 KB |
| Staff | 216 KB |
| Customer kiosk | 201 KB |
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
3. **Workspace JavaScript payloads are large.** The build reports 455 KB for manager and 420 KB for HR; the queue and kiosk public screens transmit 253.9 KB and 223.7 KB of script respectively in this cold-load baseline. Long-task counts are visible, but duration and INP are not yet measured.
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

The measured catalogue action and bundle reductions are complete, and repeated identity lookups are removed from the middleware-to-server-component/action path. Phase 2 is **code-complete for the evidenced kiosk and request-identity bottlenecks**, but it does **not** meet every system-wide performance target: the unpaired kiosk content p95 remains 3.15 s on Uganda 4G and 7.48 s on slow 3G, above the 2.0 s content goal. Identity before/after values are call-count and RTT estimates rather than authenticated browser p50/p95. The other protected-role journeys, remote Vercel-to-Supabase placement, live query plans, and real authenticated write path were not safely measurable here.

Final code checks: `npm run lint`, `npm run check:architecture`, `npm run check:loading`, `npm run check:audit`, all 44 Vitest tests, and a clean optimized production build passed. Read-only public-screen Playwright checks passed 4 tests (login styling, queue display, unpaired kiosk gate, and kiosk pre-payment behavior); the paired kiosk submission test was skipped because it needs a paired live test device. `check:data`/pgTAP and mutating Playwright/`qa:run` remain unrun because no local Supabase/Docker scratch instance is available; using the only linked salon database for synthetic or mutation tests could alter live salon data. The existing remote DB integration test is read-only. No DB migration or production action was made. This initial project snapshot was committed locally on 2026-11-08 at the user's request.

Outside-code follow-up: confirm the production Supabase region and configure the Vercel function region to match where available. This cannot be established from this checkout. A test role session and local scratch Supabase are also needed to collect authenticated journey p50/p95 and run pgTAP plus the full mutation correctness suite safely.

## Remaining phase status

- **Phase 3 (data layer): not complete.** The required production query plans, `pg_stat_statements`, advisors, and authenticated RLS plans are unavailable, and no local scratch database is installed. No speculative indexes, policies, or RPC migrations were added.
- **Phase 4 (client speed and caching): partially complete.** The kiosk pairing boundary defers the larger flow; the shared realtime shell forwards changes to the in-page invalidation event and the kiosk badge listens to that existing event instead of opening a second salon channel. That removes one duplicate channel for manager/receptionist shells. When a mounted client view handles an invalidation, the shell now skips the redundant `router.refresh()`; routes without a local listener keep the Server Component refresh fallback. An 80 ms coalescer collapses a 50-event burst into one local invalidation batch and cancels pending work on unmount; unit tests cover burst and cleanup behavior. The system still has broad table invalidation and no verified Router Cache, prefetch, cache-isolation, or revisitation measurements. No protected data is placed in a shared cache.
- **Phase 5 (development speed and guardrails): partially complete.** `npm run dev` now opts into Turbopack and `npm run perf:check` runs the repeatable baseline harness with a kiosk Uganda 4G/slow 3G content p95 gate at 2 seconds. A 20-run check on each profile measured content p95 at **3,751 ms on Uganda 4G** and **6,749 ms on slow 3G**; the gate failed as intended. The raw samples are in `artifacts/performance/phase5-perf-check.json`. Production telemetry, route transition reporting, CI workflow integration, Defender exclusions, and dev-versus-production memory/hot-reload comparisons remain open.

Accordingly, **the five-phase performance project is not finished**. Phase 2’s scoped optimizations are implemented, but Phase 3–5 still need database/hosting evidence and additional measured fixes. No claim of system-wide budget compliance is made.

### Local database prerequisite check (2026-11-08)

Docker Desktop installation and the Phase 3 scratch database are blocked by this development machine. Windows reports Windows 10 Pro, `CurrentBuild=21996`, `DisplayVersion=Dev` (an early Windows 11 Insider build), while Docker Desktop's current Windows requirements list Windows 11 23H2/build 22631 or later. The WSL command is present, but `wsl.exe --status` returns `Access is denied`; `winget` is also present as an app execution alias but cannot be launched in this environment. Docker Desktop was not installed, and no OS features or production data were changed. Revisit after moving to a supported Windows build and enabling a working WSL 2 backend; then run migrations, pgTAP, and performance query-plan work only against the local Supabase stack.
