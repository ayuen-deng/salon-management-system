# Kiosk order operations

- A kiosk `K` number identifies a pending order, not a queue position. Reception assigns the `A`/`P` queue ticket only after successful payment in the reception workflow.
- Unpaid kiosk orders expire after `kiosk_order_expiry_minutes` (20 minutes by default). If a customer returns after expiry, ask reception to create a new visit; do not reuse the expired K number or take payment against it.
- Expiry runs once per minute, marks the draft `expired`, and writes a system activity event. The row is retained for reference.
- Managers can review expired or cancelled orders under **Manager → Visits → Abandoned**. These entries are read-only.
- If the tablet reports that orders are not being taken, confirm that the business day is open and the tablet is paired and not revoked. Continue with the normal reception visit sheet if the kiosk is unavailable.
- Reception Check-in shows new K-code orders in **Kiosk orders**. Open the order, verify the phone number aloud, review any changed prices and staffing warnings, then record payment. The system assigns an A-code and prints the receipt only after payment succeeds.
- At day close, confirm the Close Prep checklist’s pending kiosk orders with the customer if they are still present. Remaining unpaid kiosk drafts are marked expired and logged when the manager confirms closing; they are not included in queue or sales totals.
- Use **Didn’t come** only with one of the recorded reasons: Customer left, Changed mind, or Duplicate order. This cancels the unpaid order and records the activity; there is no payment to reverse.

## Day status and attendance gate
- If the paired kiosk displays the closed state, check Manager → Day and open the current Kampala business day. The kiosk polls status and returns to its welcome screen after opening. If it says it cannot connect, restore the network/server; it retries automatically. Do not expose or enter the pairing session token manually.
- A kiosk order can only be submitted while the business day is open. If the day closes while a customer is in the flow, direct them to reception; the server rejects submission.
- Workspace routes for Manager, Reception, HR, and Staff now require an active In attendance record for the current Kampala date. Owners and paired customer/queue devices are exempt. Users who are Break, Out, or not clocked in see the attendance gate; the page is checked by middleware before workspace content is served.
- From the gate, choose **I’m in** or **I’m back**. The system records the attendance change and returns to the originally requested workspace path. Switching to Break or Out hides the workspace immediately; a new Kampala date requires a new In record.
- Operational Server Action requests made while not In return `not_clocked_in`. Sign in, PIN changes, attendance, notifications, and sign out remain available. If attendance is wrong, an authorized manager, HR user, or receptionist can use the existing **Mark In** attendance action.
- Migration `20261107000005_attendance_workspace_gate.sql` installs the database attendance predicate used by middleware. The matching pgTAP checks run in a transaction and roll back their test user and attendance rows.

## Phase 1 Kiosk reliability
- Review and apply migrations `20261107000003_kiosk_audit_registry.sql` and `20261107000004_kiosk_business_day_status.sql` before using the new audit/status RPC paths.
- Run `npm run check:audit`, `npm run check:architecture`, `npm run check:loading`, `npm test`, and `npx playwright test` after the app server is reachable. `npm run check:data` runs pgTAP against the local Supabase stack and requires Docker plus `supabase start`.
- Review the attendance gate on Manager, Reception, HR, and Staff accounts in both desktop and mobile widths before treating this phase as complete. This phase has not been committed or pushed.
