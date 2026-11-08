# AUDIT REPORT: REVISIONS TO THE OWNER WORKSPACE

**Project:** Salon Management System (Kembabazi Unisex Salon, Mbarara)  
**Spec of Record:** `docs/salon_operations_walkthrough.pdf` & prompt override specifications.

---

## 1. Findings by Audit Area

### 1.1 Third-Party Integrations Status Panel
- **Found in code:**
  - `src/modules/dashboard-owner/views/owner-dashboard.view.tsx` (line 381)
  - `src/modules/dashboard-owner/views/owner-settings.view.tsx` (line 127)
  - `src/modules/manager/views/manager-portal.view.tsx` (line 172)
  - Component defined in `src/shared/views/ui/integration-status-panel.tsx`
- **Action for Phase 1:** Remove `<IntegrationStatusPanel />` and unused imports from Owner Dashboard, Owner Settings, and Manager Portal. Delete `integration-status-panel.tsx`. Ensure dishonest/misleading integration claims are removed while keeping honest copy (e.g., "Payment recorded, not yet verified") in payment and reconciliation views.

### 1.2 SMS Usage Across the Product
- **Database / Schema:**
  - `customer.sms_consent` (boolean) & `customer.consent_at` (timestamptz) in `supabase/migrations/20261004000001_initial_schema.sql`.
- **Backend / Repositories:**
  - `CustomerProfile` type & `createCustomer` method in `src/modules/customers/models/customer.repository.ts`.
  - `createCustomerAction` in `src/modules/customers/controllers/customer.actions.ts`.
  - `OwnerCustomerProfile` & repository query in `src/modules/dashboard-owner/models/owner-operations.repository.ts`.
- **Frontend / UI:**
  - `src/modules/desk/views/desk-tablet.view.tsx`: Checkbox and state for `Send me a free SMS notification...` (lines 14, 129–135).
  - `src/modules/dashboard-owner/views/owner-customers.view.tsx`: `SMS Consent` table column, 'Opted In' / 'No SMS' badge.
  - `src/modules/visits/views/reception.view.tsx`: Customer registration flow references.
- **Seeds & Tests:**
  - `scripts/demo-scenario.mjs` sets `sms_consent: true/false`.
- **Action for Phase 1:**
  - Create migration dropping `sms_consent` and `consent_at` from `customer`.
  - Strip SMS arguments from customer repositories, actions, and schemas.
  - Remove SMS checkbox on tablet Confirm screen and replace with clean privacy notice line: *"We keep your phone number for your visit history."*
  - Remove SMS columns from Owner Customers view.
  - Retain `src/shared/integrations/sms.provider.ts` as a dormant stub. Document in `docs/INTEGRATIONS.md`.

### 1.3 Attendance for Non-Service Roles (Manager, Receptionist, HR)
- **Current State:**
  - Rota table and attendance schema exist (`supabase/migrations/20261004000001_initial_schema.sql`).
  - Attendance RLS in `20261004000002_rls_policies.sql`:
    - `attendance_select` allows `owner`, `manager`, `hr` or `staff_user_id = auth.uid()`.
    - `attendance_staff_manage` allows insert with `staff_user_id = auth.uid()`.
    - `attendance_hr_manager` allows update for `manager` and `hr`.
  - **Gaps:**
    - Non-service roles (`manager`, `receptionist`, `hr`) do not have an active clock-in widget in their portals (`manager-portal.view.tsx`, `reception.view.tsx`, `hr-portal.view.tsx` lack the I'm In / Break / Out control). Only `staff-portal.view.tsx` had a prototype mockup.
    - Rota seed currently focuses on stylists/barbers; manager, receptionist, and HR lack comprehensive rota rows with start times and grace periods.
    - Owner dashboard attendance card only looked at `role IN ('staff', 'receptionist')` instead of all scheduled roles, and showed "Absent" even before expected start + grace time instead of "Not in yet".

### 1.4 Data Volumes & Inconsistencies (Visits, Staff, Customers)
- **Current Database Counts:**
  - `business_day`: 37 rows (36 closed, 1 open today `2026-10-04`).
  - `customer`: 3 rows only (Aisha, Faith, Ronald).
  - `visit`: 37 visits total (36 assigned to Aisha, 1 to Faith, **0 to Ronald** - causing Ronald to appear in customer list with 0 visits!).
  - `visit_service`: only 2 lines total in the entire database (assigned to Grace and Rose). All other staff show 0 services!
  - `payment`: 71 payments total.
  - **Why pages looked empty/inconsistent:**
    - Today has only 2 active visits (`in_service: 1`, `queued: 1`, `ready_for_checkout: 0`, `unpaid: 0`).
    - Staff metrics query `visit_service` which had almost no seeded rows, so every stylist displayed 0 completed services and 0 chair time.
    - Customer lifetime spend and visit counts were statically or sparsely populated rather than dynamically computed from real visit rows.

### 1.5 "For Your Review" Feed & Categories
- **Current Categorization:**
  - `owner-dashboard.repository.ts` used string heuristics (`action.includes('...')`) defaulting to `'Action'`.
  - Catalogue import was not mapped to `'Price change'`.
  - Items were not opening a detail modal; clicking only triggered direct `markSeen`.
  - No "Seen" tab existed (items either showed strikethrough or disappeared).
  - Acknowledgements were stored in `owner_review_seen`, but lacked audit logs and rich before/after payload display.
- **PDF Category Standard:**
  - Price change, Discount, Refund, Void, Complimentary, Write-off, Reopened day, Correction, Export, HR.

### 1.6 HR Appoint / Revoke Control
- **Current State:**
  - In `owner-settings.view.tsx`, the card displayed text: `"Active HR Administrator: David Kato (+256772000003)"` and a static badge `"HR Active"`.
  - **There were no buttons** to Revoke access or Appoint / Replace HR.
  - No database RPC or backend logic existed to atomically swap or deactivate HR credentials and invalidate sessions.

---

## 2. Implementation Plan

### Phase 1: Cleanup, Review Modal, SMS Removal, HR Control
1. **Remove Third-Party Integrations Panel:**
   - Remove `<IntegrationStatusPanel />` from Owner Dashboard, Owner Settings, and Manager Portal. Remove component file.
   - Update `docs/INTEGRATIONS.md` and `docs/WHAT_NOT_TO_CLAIM.md`.
2. **"For Your Review" Modal & Dual Tabs:**
   - Add `review_ack` table with RLS and audit trigger.
   - Refactor repository and controller to categorize strictly into the 10 PDF categories (mapping CSV import to `Price change`).
   - Create Review Detail Modal (bottom sheet on mobile) displaying actor, role, full ISO date/time (Kampala), amounts, reason, and before/after diffs from `audit_log`.
   - Add "To review" and "Seen" tabs with live count badge. Add quiet footer line: *"Marking as seen only records that you looked at this. To act on it, contact the manager."*
3. **SMS Removal:**
   - Create migration `20261007000006_drop_sms_columns.sql` to drop `sms_consent` and `consent_at`.
   - Update `customer.repository.ts`, `customer.actions.ts`, and `owner-operations.repository.ts`.
   - Update `desk-tablet.view.tsx`: replace SMS checkbox with privacy notice line: *"We keep your phone number for your visit history."*
   - Update `owner-customers.view.tsx`: remove SMS column, display Name, Phone, Visits, Lifetime spend, Last visit, PDF export.
   - Mark `sms.provider.ts` as dormant in `docs/INTEGRATIONS.md`.
4. **Root HR Control in Owner Settings:**
   - Create migration with RPC `owner_appoint_hr`, `owner_revoke_hr`, and partial unique index ensuring exactly 1 active HR.
   - Implement Owner Settings HR Account card with `Revoke access` (modal with warning) and `Appoint HR` / `Replace HR` (modal for full name, phone, username, PIN).
   - Write audit rows under category `access`. Ensure owner's own HR actions do not show in his own "For your review".
5. **Phase 1 Verification:**
   - Architecture check, Next.js build, Vitest unit tests, Playwright tests.

### Phase 2: Realistic Data, Staff Metrics, Self Check-in, Receipt Printing
1. **Deterministic 5-Week + Today Realistic Seed Script (`seed:demo`):**
   - 120 fictional customers with varied visit histories.
   - 5 weeks of realistic business days (25-45 visits on weekdays, up to 60 on Fri/Sat; 85-90% MoMo, 10-15% cash; discounts, voids, refunds, left queue, multi-line wash/blow-dry).
   - Today's live state with rows across all Visits tabs (Waiting, In service, Ready for checkout, Wash-to-blow-dry bottleneck, Unpaid).
   - Full service lines mapped to service staff, populating realistic chair times and completed counts.
2. **Staff Metrics by Role & Shared Attendance Control:**
   - Restrict service metrics to `role = 'staff'`.
   - Support roles (`manager`, `receptionist`, `hr`) show days present, hours, average arrival time, late count/minutes, absences.
   - Build reusable `<AttendancePill />` control for top bar / user card across Manager, Receptionist, and HR portals.
   - Seed rota for all employees with grace period calculation. Display "Not in yet" before start+grace, "Late" / "Absent" after.
3. **Receipt Printing:**
   - Create `receipt` table with gapless `receipt_no`, `snapshot` JSONB, `print_count`, `last_printed_at`.
   - Create print route `/print/receipt/[visitId]` (80mm receipt roll & A5 stylesheet, `window.print()`, monochrome).
   - Display customer first name only, ticket code, items, discounts, total, MoMo reference, server timestamp (Africa/Kampala), and *"This is not a fiscal tax receipt"*.
   - Labels for "DUPLICATE", "VOID", "REFUNDED". Read-only for owner, disabled for staff.
4. **Documentation:**
   - Update `docs/CHANGES_AFTER_PDF.md`, `docs/PDF_TRACEABILITY.md`, `docs/VERIFICATION.md`.

---

## 3. Assumptions & Open Questions
- **Assumption:** In the prototype environment, HR credentials appointment can create/update the `app_user` row directly with hashed PIN and authentication record, securely via database RPC and server actions.
- **Assumption:** Customer lifetime spend and visit counts will be computed on-the-fly or synced from completed/paid visits to guarantee mathematical consistency.
