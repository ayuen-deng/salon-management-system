# PDF Traceability Matrix: Salon Operations Walkthrough vs. Implemented System

## Kiosk order handoff amendment
- Phase 1 kiosk flow stores a pending draft visit and service lines under a per-day `K` order code. `ticket_code` remains null; customers are not queued before payment.
- The kiosk requires a paired reception tablet session, validates name/phone/catalogue and business-day status on the server, uses an idempotency key, and expires unpaid orders after the configured interval (default 20 minutes).
- Expired and cancelled kiosk orders remain read-only in Manager → Visits → Abandoned and retain their K order number for reference.
- Phase 2 adds the reception panel, claim/read-back, and atomic payment/receipt/A-ticket conversion. The production migration is applied; the full multi-role payment flow is pending isolated Playwright data.

**Spec of Record:** `docs/salon_operations_walkthrough.pdf`  
**System:** Mzuri Unisex Salon (Mbarara, Uganda) — V1 Operational Prototype  
**Branch:** Mbarara High Street Branch  

---

## 1. Owner Workspace Traceability (Prompt Complete: 100% Live DB Parity)

| Owner Subpage | Route | Model / Repo | Controller Action | View Component | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dashboard** | `/owner` | `OwnerDashboardRepository` | `fetchOwnerDashboardAction` | `OwnerDashboardView` | **DONE** | 100% live from Supabase. 4 stat cards, 4-wk same-day avg, MoMo vs Cash split, staff attendance, queue snapshot, "For your review" with modal, dual tabs (To review / Seen), and mark-as-seen. |
| **Visits** | `/owner/visits` | `OwnerOperationsRepository` | `fetchOwnerVisitsAction` | `OwnerVisitsView` | **DONE** | Filter tabs (Today, All, Left queue, Unpaid), detailed service line drawer with assigned stylists and payment breakdowns. Read-only. |
| **Payments** | `/owner/payments` | `OwnerOperationsRepository` | `fetchOwnerPaymentsAction` | `OwnerPaymentsView` | **DONE** | MoMo & Cash audit trail, confirmation levels (`attested`, `confirmed`, `reconciled`), unverified >24h alert banner. Read-only. |
| **Staff** | `/owner/staff` | `OwnerOperationsRepository` | `fetchOwnerStaffAction` | `OwnerStaffView` | **DONE** | Measured lines completed, measured chair minutes, attendance days, and recorded lateness count. Read-only. |
| **Waits and services** | `/owner/waits` | `OwnerOperationsRepository` | `fetchOwnerWaitsAction` | `OwnerWaitsView` | **DONE** | Multi-stage wait tracking (wash to dryer, blow-dry to braid), worst-case analysis. Excludes paper/manual lines. |
| **Daily summaries** | `/owner/summaries` | `OwnerOperationsRepository` | `fetchOwnerSummariesAction` | `OwnerSummariesView` | **DONE** | 5-week historical archives, full EOD report matching PDF (served, left queue, no-shows, revenue splits, operating hours). |
| **Audit log** | `/owner/audit` | `OwnerOperationsRepository` | `fetchOwnerAuditAction` | `OwnerAuditView` | **DONE** | Dual-tab view: full immutable audit ledger with category filters (`financial`, `reception`, `access`, etc.) vs friendly activity timeline. |
| **Customers** | `/owner/customers` | `OwnerOperationsRepository` | `fetchOwnerCustomersAction` | `OwnerCustomersView` | **DONE** | Search by name or phone, visits count, lifetime spend in UGX, last visit, and PDF export audit logging. Zero SMS columns. Read-only. |
| **Catalogue** | `/owner/catalogue` | `SharedCatalogueRepository` | `getCatalogueAction`, `addServiceAction`, `addVariantAction`, `updatePriceAction`, `importCsvAction` | `SharedCatalogueBoardView` | **DONE** | Complete catalogue and prices write portal (Change 8). Add service, add variant, price bounds adjustment (reason required), disable/enable, price history, CSV import/export. |
| **Settings** | `/owner/settings` | `OwnerOperationsRepository` | `fetchOwnerSettingsAction`, `updateOwnerThresholdsAction`, `appointOrReplaceHrAction`, `revokeHrAction` | `OwnerSettingsView` | **DONE** | Review thresholds editor with audit logging, root HR account card with atomic Appoint/Replace and Revoke safeguards. Zero third-party integration panels. |

---

## 2. Global Role Navigation Status

| Role | Sidebar Items Configured | Route Type | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Owner** | 9 items (Dashboard, Visits, Payments, Staff, Waits, Summaries, Audit, Customers, Settings) | Real Dedicated Routes | **DONE** | Full operational views built; mobile bottom bar configured. |
| **Manager** | 14 items (Today, Approvals, Queue, Visits, Appointments, Catalogue, Import, Discounts, Reconciliation, Day Close, Attendance, Devices, Customers, Print) | Real Dedicated Routes | **PLACEHOLDER SHELLS** | Thin route shells render `NeutralPlaceholderView` until manager build prompt. |
| **Receptionist** | 8 items (Check-in, Checkout, Appointments, Customers, Customer tablet, Enter from paper, Close prep, Paper forms) | Real Dedicated Routes | **DONE** | Complete workspace for Mary Namubiru across all 8 routes. Check-in desk with Uganda phone normalizer, live queue with sequence/concurrent line logic, between-services alerts (7m warn / 15m escalate), preferred stylist wait range estimation, shared phone selection, tablet category pusher & mirror, checkout with cash & MoMo transaction verification (duplicate stamp & zero phone thermal receipt), appointments schedule with 15-min grace period and manager escalation, customer list with first-name correction and audited PDF export, close prep with active/unpaid ticket checklist and drawer count handover, shared paper entry with duplicate serial rejection, and printable backup form templates (Appendices A & B). |
| **HR** | 8 items (Overview, Staff, Access, Attendance, Leave, Rota, Performance, Audit) | Real Dedicated Routes | **DONE** | Complete workspace for David Kato across all 8 routes. Overview with live people stat cards, attention items (manager revocations, leave, corrections), recent changes; Staff Directory with filters, profile edit, role changes (manager warning), immediate session deactivation, onboarding/offboarding checklists, and people CSV export; Access & Security with PIN reset (one-time PIN display), manager revocation confirmation/reversal review queue, and hardware device revocation; Attendance with full multi-role attendance logs, punctuality metrics, non-medical supervisor corrections, and CSV export; Leave Management with approved, off-duty, and unapproved absence tracking and approval workflow; Weekly Rota matrix driving expected staffing counts and lateness rules; Performance with measured stylist service times and attendance summaries (zero financial data); Audit Ledger restricted strictly to `people` and `access` categories with state diffs. Zero customer or money data across all screens. |
| **Staff** | 2 items (My Queue, My Attendance) | Real Dedicated Routes | **DONE** | Complete mobile-first phone portal for service staff (Grace, Rose, Sarah, Peter). 3-tier scrolling queue (Now with 2-tap Done, Next with atomic pool claiming, Coming up with expected ready countdown), 10s undo window, 90m forgotten-Done reminder, offline paper fallback banner, single shared top-bar attendance control and 7-day personal history. Zero phone numbers, prices, or performance metrics. |

---

## 3. Integrity Verification Status
- **Architecture Integrity:** Verified with `npm run check:architecture` (0 layer leaks).
- **Compilation & Bundling:** Verified with `npm run build` (All 44 routes generated and bundled cleanly).
- **Unit Test Coverage:** Verified with `npm run test` (9/9 tests pass, including live remote truth test for Owner metrics).
- **Remote Latency:** Verified with `npm run latency:check` (~617ms to remote Supabase instance).

## Receipt Printing (Phase 1)

| Requirement | Implementation | Verification |
| --- | --- | --- |
| One isolated print path | `src/shared/lib/receipt-printing.ts`, `src/modules/payments/views/receipt-printing.view.ts`, `/print/receipt/[visitId]` | Hidden frame loads the print route and calls `print()` on the frame window. |
| Shared receipt content | `src/modules/payments/views/printable-receipt.tsx` (`ReceiptDocument`) | Original and duplicate preview paths use the same component. |
| Snapshot, date, privacy, footer and status | `src/modules/payments/models/receipt.repository.ts` | `src/modules/payments/views/receipt-document.test.ts`; run result recorded in `docs/VERIFICATION.md`. |
| Duplicate audit and counter | `src/modules/payments/controllers/receipt.actions.ts`, `ReceiptRepository.markDuplicatePrint` | Reprints record actor, receipt number, timestamp and print count. |
| Owner-configured receipt fields | `OwnerSettingsView`, `OwnerOperationsRepository.updateReceiptSettings` | Migration `20261104000001_receipt_print_defaults.sql` leaves contact/footer blank and enables disclaimer by default. |

## HR and Attendance Improvements (Phase 1)

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Shared current-day staff status | `staff_presence_today` view and `src/shared/lib/attendance-presence.ts` | `supabase/tests/hr_presence_audit.sql`; migration not yet applied remotely. |
| Unified status chips and staff history | `AttendanceStatusChip`, Manager/Owner/Reception views, staff attendance history | TypeScript/build and Vitest status tests. |
| People/access audit isolation | `audit_action_category`, `hr_people_access_audit`, HR audit repository and detail panel | RLS plus canonical category trigger; pgTAP file added but unavailable locally. |
| Signed-in identity in shell | `src/shared/views/layout/app-shell.tsx` | Production build; authenticated browser session verification pending. |

## HR Attendance and Leave Policy (Phase 3)

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Effective-dated work rules, grace periods, role defaults, rota precedence | `work_hours_policy`, HR Working Hours form, rota effective dates | `supabase/tests/hr_attendance_leave_policy.sql`; local database runtime unavailable. |
| Clock-based attendance metrics and no guessed clock-outs | `hr_attendance_daily`, HR Attendance Overview and Daily Records | TypeScript and production build pass; live view awaits migration application. |
| Break minutes and work hours | `attendance_break_period`, attendance trigger, daily view | pgTAP test added; local Docker/Postgres unavailable. |
| Annual leave balances and policy | `annual_leave_policy`, per-person overrides, `hr_leave_balance`, HR Leave policy editor | TypeScript and production build pass; role entitlements remain blank pending owner policy confirmation. |
| Metric definitions and scope limits | `docs/HR_METRICS.md` | Reviewed against daily and balance view formulas. |

## Staff Leave Requests and Notifications (Phase 4)

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Staff-only leave page, balance, requests and cancellation | `src/modules/staff-portal/views/staff-leave.view.tsx`, staff actions/repository, `/staff/leave` | `e2e/staff-leave.spec.ts`; authenticated flow awaits migration application. |
| Database date/overlap/workday/balance checks | `preview_my_leave_request`, `request_my_leave`, `cancel_my_leave_request` in `20261106000003_staff_leave_notifications.sql` | `supabase/tests/staff_leave_notifications.sql`; local database runtime unavailable. |
| Per-user in-app notifications with realtime and read state | notification table extension, RLS, trigger, `src/modules/notifications` | pgTAP coverage added; realtime not live-tested because the migration remains unapplied. |
| Staff phone navigation | shared `AppShell` and role navigation configuration | TypeScript/build and architecture checks. |

## Shared Staff Performance (Phase 5)

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Identical HR and Owner Staff numbers | `get_staff_performance_report`, `src/modules/staff-performance` | `supabase/tests/hr_staff_performance.sql`; execution pending database runtime. |
| People-only measured service report and detail | `HrPerformanceView`, server-only report action, Phase 5 SQL migration | TypeScript/build and pgTAP; live migration/application pending review. |
| Role/date/person filters and CSV/PDF | HR Performance filters and shared `HrExportMenu` | Existing export path records HR export audit; browser-authenticated review pending. |
| Shared owner staff summaries | `OwnerStaffView` uses the same report action and RPC | TypeScript/build; live data check pending migration application. |
| Metric definitions, exclusions, and limits | `docs/HR_METRICS.md` | Documented against SQL eligibility and attendance view calculations. |

## Kiosk order reception handoff (Phase 2)

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Unpaid kiosk order is visible to receptionist/manager only | `list_reception_kiosk_orders`, `ReceptionWorkspaceView`, Manager/Reception Visits | Production RPC grants and role boundary verified with read-only SQL; authenticated browser test pending. |
| One receptionist owns an order at a time; two-minute inactivity release | `claim_reception_kiosk_order`, `touch_reception_kiosk_claim`, release action and Check-in builder | Production RPC installed; database and two-session Playwright tests pending isolated data. |
| Payment, A ticket, queue status, immutable receipt in one transaction | `confirm_reception_kiosk_order` and dedicated receipt print route | Production migration installed; live payment/receipt flow not exercised to avoid writing permanent test financial/audit data. |
| Day close expires unpaid drafts | `confirm_close_day`, reception Close Prep list | Production RPC replaced; local pgTAP blocked by unavailable Docker/Postgres and pgTAP is not installed on production. |

## Kiosk Reliability and Day Status (2026-11-07)

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Register all kiosk audit actions and detect drift/conflicts | `20261107000003_kiosk_audit_registry.sql`, `scripts/check-audit.mjs` | Production registry confirms six actions; audit scan and both self-tests pass; production pgTAP transaction ran. |
| Avoid native dialogs and stuck action spinners | Shared toast/dialog host; kiosk claim `try/catch/finally` | Source scan and lint pass; Vitest 30/30. |
| Reception and manager can find unpaid kiosk orders | Dedicated paginated order views and compact Check-in card | Production list RPC installed; build succeeds; 4 read-only Playwright checks pass. |
| Hide kiosk menu while day is closed/offline | Paired status RPC, tablet state gate, queue display closed state | Production RPC installed; day is currently open. No production close/open cycle was forced for review. |

Phase 1 migrations `20261107000003` and `20261107000004` were applied directly to production. `supabase migration list --remote` reports no remote migration history for the existing project, so these targeted SQL applications do not alter that pre-existing ledger state.
