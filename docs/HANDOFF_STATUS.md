# Handoff Status

## Current state (2026-11-09)

The dedicated Supabase project `mzuri-staging` (`afruqwkujvweojbuqjeq`) is provisioned separately from the salon production project. All 34 local migrations are present in its remote migration ledger, and the three PIN Edge Functions are active there. Staging configuration and database credentials are kept in the ignored `.env.staging.local` file.

The staging database passed all 58 pgTAP assertions across nine SQL files. Supabase's remote test container cannot access the `extensions` schema, so the same rollback-only files were executed directly against the explicitly selected staging database; no public grants were added. A multi-role browser login/isolation test passed, as did the manager pairing and synthetic unpaid kiosk-order flow. The staging business day and test order/device are deliberate test data.

The app built successfully with all 73 routes and `/api/health` reported a connected staging database. Lint, TypeScript, architecture, loading-boundary, audit-registry, and design-token checks passed. Vitest passed all 46 tests when run outside the Windows sandbox; the sandbox itself blocks the Vitest worker's `realpath` call with `EPERM`.

## Remaining performance work

The five-phase performance effort is not fully complete. A 20-run authenticated manager desktop sample against the local app and staging database measured content p95 at 3.20 seconds, above the 2.0-second target. Its server-action p95 was 1.84 seconds. The sample is saved at `artifacts/performance/staging-manager-desktop.json`; it needs a query/action trace and an optimization pass before this journey meets the target.

Still outstanding: the full dependency audit of broad Realtime listeners, authenticated revisit and cache-isolation measurements, reliable staging/production query-plan and latency observations, a Vercel preview-to-staging environment, production telemetry, and a successful GitHub Actions run. No production database migrations, test records, payments, or kiosk orders were changed in this continuation.

## Local review server

The temporary staging-backed server used for this validation has been stopped. Start it with the staging environment only when a review session is needed; never load `.env.staging.local` into a production deployment.
