# Walkthrough Script & Demo Guide (Mbarara Salon Prototype)

## Kiosk order (Phase 1)
- Pair the kiosk with the reception tablet's current six-digit pairing code, then select active services and enter a first name and Uganda mobile number.
- Place the order. The confirmation shows a `K` order number, masked phone, estimated service wait after payment, and estimated total. This is not a queue ticket; the customer must pay at reception before entering the queue.
- Unpaid orders expire after the configured 20-minute default. Follow the Phase 2 reception handoff below to review and pay an order.
- Managers can inspect expired/cancelled kiosk orders under **Manager → Visits → Abandoned**; those records are read-only.

This script walks through the Aisha journey (A to Z) and all edge cases detailed in the specification.

## HR Attendance and Leave Policy (Phase 3)

- Open **HR → Attendance**. Overview is the default. Try Today, This week, This month, Last 3 months, or Custom range; then filter by role or staff member.
- Explain the six tiles and the five charts using `docs/HR_METRICS.md`. Click an item under Needs attention to inspect that person's attendance rows. In Daily Records, a past shift without clock-out should say “Missed clock-out”; no hours are estimated.
- Open **Working Hours** to edit standard hours, grace periods, working days, and the optional receptionist override. Explain that a rota shift wins over the default and an attendance policy snapshot remains attached to clocked days.
- Open **HR → Leave** to see policy and balances. Role entitlement fields are intentionally blank until the salon owner confirms its policy. Set the leave-year start and public holiday dates as needed, then save; per-person blank overrides mean use the role default.
- Annual leave affects the remaining balance only on scheduled workdays, with configured holidays excluded. Pending is displayed separately. Unpaid and other approved leave do not reduce annual leave balance. Do not add reasons or medical details to leave entries.
- Phase 3 migration `20261106000002_hr_attendance_leave_policy.sql` must be reviewed and applied before this module can use the live database views and policy RPCs. Until then, use the existing demo environment for UI review only.

## Staff Leave and Notifications (Phase 4)

- Sign in as a staff member and open **More → Leave** on a phone, or **Leave** from the desktop sidebar. The page shows entitlement, taken, approved upcoming, pending, remaining, leave-year dates, the request form, and leave history.
- Choose leave type and dates. The preview counts working days using the rota or policy. Try an overlapping period or a date range beyond the annual balance; the UI explains the issue and the database also rejects invalid requests.
- Submit a valid request and confirm it appears as Pending. Cancel it and verify the request moves to Cancelled and pending balance updates.
- HR receives an in-app notification and a pending-request badge. Approve or reject the request from **HR → Leave** or the HR Overview attention panel. The staff member gets an in-app bell update and toast. Rejection asks them to contact HR; the app stores no leave reason.
- Notifications are in-app only. No SMS, email, push, or sound is sent.
- Migrations `20261106000002_hr_attendance_leave_policy.sql` and `20261106000003_staff_leave_notifications.sql` must be reviewed and applied in order before live request, balance, and notification behavior can be demonstrated.

---

## 1. Setup & Credentials (Dev Prototype)
Every role can log in using their simple **Username** and **6-Digit PIN**:

| Role | Username | 6-Digit PIN | Person | Description |
|---|---|---|---|---|
| **owner** | `owner` | `111111` | Godfrey Mugisha | Remote monitor from Kampala |
| **manager** | `manager` | `222222` | Joan Tumusiime | Full operational & day-close authority |
| **hr** | `hr` | `333333` | David Kato | Staff directory & weekly rota management |
| **receptionist** | `reception` *(or `mary`)* | `444444` | Mary Namubiru | Intake desk & queue ticket issuer |
| **staff** | `grace` *(or `staff`)* | `555555` | Grace Atuhaire | Hair Stylist (Station 3) |
| **staff** | `sarah` | `555555` | Sarah Kobusingye | Hair Stylist |
| **staff** | `peter` | `555555` | Peter Byamukama | Barber |
| **staff** | `rose` | `555555` | Rose Kyomugisha | Wash Assistant |

*Note: These credentials apply when `NEXT_PUBLIC_DEMO_SIMPLE_LOGIN=true`. In production mode (`false`), Owner, Manager, and HR authenticate using their email and secure password.*

### Dedicated Owner Account Management (Post-Meeting Handover)
To hand the owner his login, test it on his phone, and safely rotate or disable it immediately after the meeting:
- **Rotate PIN**: `npm run owner:rotate` (generates and sets a new random 6-digit PIN)
- **Disable Access**: `npm run owner:disable` (bans and marks owner profile inactive)
- **Restore Default**: `npm run owner:enable` (reactivates with default PIN `111111`)

---

## 2. Interactive Role Surfaces
Navigate to `http://localhost:3000` to access the hub:
1. **Reception Desk (`/reception`)**:
   - Customer lookup by Ugandan phone format (`0772123456`).
   - Service selection with live price calculation in integer UGX.
   - Live queue status monitor.
2. **Customer Desk Tablet (`/desk`)**:
   - **Menu Mode**: Browse catalogue and variants.
   - **Select Mode**: Customer builds a live draft basket.
   - **Confirm Mode**: Reads phone number back in bold font (`Is this 0772 123 456?`), displays total and SMS consent checkbox, generates ticket code (e.g. `A17`).
3. **Queue Display TV (`/display/queue`)**:
   - Seating area board with high-contrast text.
   - Left column: **Now Serving** with station/stylist.
   - Right column: **Waiting List** ordered by arrival time with estimated wait.
4. **Staff Phone Portal (`/staff`)**:
   - Attendance selector: "I'm In" / "On Break" / "Clock Out".
   - Minimal task card: shows current assigned ticket, service name, and **Start** / **Done** buttons.
   - Clicking **Done** immediately releases the station and staff member (zero hold-and-wait).
5. **Manager Portal (`/manager`)**:
   - Live approvals inbox for discounts over Mary's UGX 5,000 limit.
   - Daily statement reconciliation for Mobile Money vs cash.
   - Two-step day closing with cash count checklist.
6. **HR Management Workspace (`/hr`)**:
   - People and access management exclusively (David Kato). Zero customer records, zero prices, zero UGX, zero revenue data.
   - **Overview (`/hr`)**: Real-time staff present, on leave, late, not in yet, needs attention, and recent people changes.
   - **Staff Directory (`/hr/staff`)**: Full employee roster with onboarding/offboarding checklists, role assignment, and CSV export.
   - **Access Governance (`/hr/access`)**: Instant PIN resets, immediate account revocation, manager revocation confirmation, and device access controls.
   - **Attendance (`/hr/attendance`)**: Comprehensive attendance logs, punctuality metrics (late counts, arrival times, absences), supervisor corrections with mandatory non-medical reason codes, and CSV export.
   - **Leave Management (`/hr/leave`)**: Approved leave, unapproved absence, and off duty records. Upcoming, past, and pending requests.
   - **Weekly Rota (`/hr/rota`)**: Shift matrix across all salon roles driving "staff present vs expected" and lateness rules. Copy last week rollover.
   - **Performance (`/hr/performance`)**: Read-only shared service and attendance report with date/role filters, stylist service detail, target progress, category and start-time charts, and CSV/PDF export. Service measures use eligible live measured lines only; other roles show attendance with service measures marked not applicable.
   - **Audit Ledger (`/hr/audit`)**: Immutable log restricted strictly to `people` and `access` categories with state before/after diffs.
7. **Owner Monitor (`/owner`)**:
   - Remote monitor in Kampala.
   - Stat cards: Total Revenue Today (UGX), Mobile Money vs Cash split, 78% Verified split, Floor staff present vs expected.
   - "For Your Review" list highlighting discounts, voids, and exports.
8. **Printable Forms (`/print`)**:
   - Clean printable paper visit sheets matching Appendix A for internet/power outages.

## Kiosk reception handoff (Phase 2)

1. Pair a temporary test tablet and open a business day.
2. On `/desk`, create a K-code order using a disposable phone/name. Confirm the kiosk shows an order number, masked phone and estimated total, with no A-code.
3. Sign in as receptionist in a separate browser context. Confirm the Check-in panel and sidebar count update; the draft must not appear in the queue.
4. Open the order, read the number back, optionally adjust services, and record Cash or Mobile Money with a reference.
5. Confirm the A-code, immutable receipt and queue/stylist portal updates, then close the receipt preview. Use a disposable test project for payment demos; do not delete payment or audit rows from production.
