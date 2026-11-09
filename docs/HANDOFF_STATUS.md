# Handoff Status

## Current state (2026-11-09)

The dedicated Supabase project `mzuri-staging` (`afruqwkujvweojbuqjeq`) is provisioned separately from the salon production project. All 34 local migrations are present in its remote migration ledger, and the three PIN Edge Functions are active there. Staging configuration and database credentials are kept in the ignored `.env.staging.local` file.

The staging database passed all 58 pgTAP assertions across nine SQL files. Supabase's remote test container cannot access the `extensions` schema, so the same rollback-only files were executed directly against the explicitly selected staging database; no public grants were added. A multi-role browser login/isolation test passed, as did the manager pairing and synthetic unpaid kiosk-order flow. The staging business day and test order/device are deliberate test data.

The app built successfully with all 73 routes and `/api/health` reported a connected staging database. Lint, TypeScript, architecture, loading-boundary, audit-registry, and design-token checks passed. Vitest passed all 46 tests when run with staging selected.

## Remaining performance work

The five-phase performance effort is not fully complete. A 20-run authenticated five-role desktop sample is saved at `artifacts/performance/staging-authenticated-desktop.json`. It showed content p95 misses for manager (3.92 s), HR (10.40 s), receptionist visits (9.83 s), and staff (2.74 s); owner readiness was initially misdetected because its live status dot pulses continuously. The baseline also showed long action tails for reception (4.29 s) and manager (2.33 s).

The owner repository now fetches independent dashboard sections together and batches its seven-day revenue reads. Across two 20-run samples, owner action p50 improved from 6.22 s to 1.26–1.58 s; the final sample's action p95 was 5.44 s and content p95 was 6.87 s, so the tail remains unstable and misses the 2.0 s content target. The raw final sample is `artifacts/performance/staging-owner-final.json`; the harness now ignores small animated indicators when identifying loading skeletons. The unscoped manager portal Realtime refresh now filters to its actual repository tables.

Still outstanding: authenticated revisit/cache-isolation checks, acceptable p95 across protected journeys, Vercel preview-to-staging validation, production telemetry/observability, production query plans, the development-versus-production memory/hot-reload comparison, and confirmation of GitHub Actions. The app/server was stopped after measurements. No production database migrations, test records, payments, or kiosk orders were changed in this continuation.

## Local review server

The temporary staging-backed server used for this validation has been stopped. Start it with the staging environment only when a review session is needed; never load `.env.staging.local` into a production deployment.
