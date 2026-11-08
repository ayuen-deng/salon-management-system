# CHANGES AFTER PDF SPECIFICATION

**Project:** Mzuri Unisex Salon Management System (Mbarara)  
**Spec of Record:** `docs/salon_operations_walkthrough.pdf`  
**Precedence Rule:** Where prompt specifications and implementation requirements depart from the walkthrough PDF, this document records the binding new rule.

## Kiosk orders: payment precedes queue placement
- A paired kiosk creates a pending `visit` draft with `created_via = 'desk_tablet'`, service lines, normalized first name and Uganda phone, and a per-business-day `K` order code. It does not create a customer or queue ticket.
- Reception reviews the order, confirms the customer's number and records payment. Only the payment workflow allocates an `A`/`P` queue ticket and moves the visit into the live queue.
- Unpaid orders expire after the location's `kiosk_order_expiry_minutes` setting (default 20 minutes); expired orders remain available for reference. No SMS or sound is used.
- The kiosk is paired through a device-bound server session that expires after 30 days and is rejected immediately when the device is revoked. It can submit an order and only receives that submission's result; it cannot browse orders or customers.
- Expired and cancelled kiosk orders appear read-only in Manager → Visits → Abandoned, under their `K` order number.
- Reception claiming and payment handling are implemented in the Phase 2 section below.

---

## 1. Third-Party Integrations Status Panel Removed
- **PDF Section Affected:** Section 11–14 (Third-Party Integrations Status & Monitoring).
- **New Rule:** The cosmetic "Third-Party Integrations Status" card has been completely removed from all user-facing pages (Owner Dashboard, Owner Settings, and Manager Portal). The UI displays only honest, working behaviours directly within normal transactional screens (e.g. *"Payment recorded, not yet verified"*). Integration claims are governed strictly by `docs/INTEGRATIONS.md` and `docs/WHAT_NOT_TO_CLAIM.md`.

---

## 2. SMS Removal from Product (Customer-Facing & Data Schema)
- **PDF Section Affected:** Section 3 (Customer Reception & Confirmation), Section 4 (Queue & In-Salon Communications), Section 11 (SMS Integration).
- **New Rule:** 
  - Customer phone numbers are collected **strictly for visit lookup and client history**; no SMS messages are sent, scheduled, or promised.
  - The SMS opt-in checkbox has been removed from the customer-facing tablet Confirm screen and replaced with a static privacy notice: *"We keep your phone number for your visit history."*
  - The `sms_consent` and `consent_at` columns have been dropped from the `customer` database table (`supabase/migrations/20261007000006_owner_revisions.sql`).
  - Customer tickets are displayed prominently on the lobby TV screen and on the customer tablet screen upon check-in, and spoken aloud by the receptionist.
  - The `SmsProvider` interface remains in `src/shared/integrations/sms.provider.ts` as decoupled **dormant code** only.

---

## 3. "For Your Review" Feed: Interactive Modal, Dual Tabs, and Exact PDF Categories
- **PDF Section Affected:** Section 10 (What the Owner Sees from Kampala - For Your Review).
- **New Rule:**
  - Clicking any review item opens an interactive **detail modal** (rendered as a bottom sheet on mobile devices) displaying category tag, plain title, actor and role, full ISO date and time (Africa/Kampala timezone), monetary amounts, stated reason, and before/after JSON state diffs from the immutable `audit_log`.
  - **Dual Tabs:** The feed provides dedicated **To review** and **Seen** tabs. The unseen badge counter updates in real time.
  - **Mark as Seen Safeguard:** The owner's only action is "Mark as seen", accompanied by the explicit disclaimer: *"Marking as seen only records that you looked at this. To act on it, contact the manager."*
  - Acknowledgements are audited under category `access` and recorded in `review_ack` / `owner_review_seen`.
  - Categories strictly adhere to the 10 PDF categories: **Price change** (including catalogue CSV imports), **Discount**, **Refund**, **Void**, **Complimentary**, **Write-off**, **Reopened day**, **Correction**, **Export**, and **HR**. Owner's own root actions (e.g. APPOINT_HR, REVOKE_HR) are excluded from his own review queue.

---

## 4. Root HR Account Control: Exactly One Active HR with Atomic Replace & Revoke
- **PDF Section Affected:** Section 7 (Staff Roles & Permissions - HR Root Authority).
- **New Rule:**
  - The owner Settings page features an active **HR account** control card displaying the current administrator (name, username, phone, appointment date) with two controls:
    - **Revoke access** (danger outlined): Prompts with a safeguard modal ("The salon will have no HR administrator until you appoint one"). Revoking immediately invalidates all active HR sessions and sets the user status to `inactive`.
    - **Appoint HR / Replace HR**: Modal capturing full name, phone number (E.164), username, and PIN. If an HR administrator is currently active, the operation is **atomic** (old HR account deactivated, new HR account created in a single transaction).
  - Enforced in the database via partial unique index `uq_active_hr_per_location` on `app_user (location_id) WHERE (role = 'hr' AND status = 'active')`.
  - All appointment and revocation events are logged to `audit_log` with category `access`.

---

## 5. Attendance Self Check-In for Non-Service Roles
- **PDF Section Affected:** Section 7 (Permissions Matrix) & Section 5 (Staff Rota & Attendance).
- **New Rule:**
  - Non-service employees (**Manager**, **Receptionist**, and **HR**) now clock in directly from their respective workspace portals via a shared `<AttendancePill />` control (`I'm In / Break / Out`).
  - Database RLS permits each user to insert only their own attendance record (`staff_user_id = auth.uid()`). Manager override and HR correction policies remain in force.
  - The owner does not clock in.
  - Presence status distinguishes between scheduled start time: shows **"Not in yet"** before scheduled start time plus grace minutes (default 10), and **"Late"** or **"Absent"** thereafter.

---

## 6. Service Metrics Strictly Limited to Service Staff
- **PDF Section Affected:** Section 10 (Owner Staff Performance).
- **New Rule:**
  - Service performance metrics (completed services, measured chair time, average service duration) apply **only to users with the `staff` role** (stylists, barbers, wash assistants).
  - Support and management roles (`manager`, `receptionist`, `hr`) display **attendance metrics only**: days present, hours logged, average arrival time, late count, total late minutes, and unapproved absences.

---

## 7. Receipt Printing Hardware & Architecture
- **PDF Section Affected:** Section 1 (Executive Summary) & Section 8 (Checkout & Payments).
  - *PDF Note:* Walkthrough stated *"No printer required in salon; tickets and receipts sent by SMS."*
- **New Rule:**
  - **No tickets are printed.** Ticket codes appear on the customer tablet and lobby display screen.
  - **Receipts are printed physically from the reception computer** upon payment completion.
  - Hardware requirement: standard 80 mm thermal roll printer (or A5 paper) connected to the reception workstation.
  - Triggered via dedicated monochrome print route `/print/receipt/[visitId]` using standard browser `window.print()`.
  - Receipts carry an immutable JSONB snapshot created upon payment completion, gapless `receipt_no`, customer first name only, server timestamp, cashier first name, and the disclaimer *"This is not a fiscal tax receipt"*.
  - Reprints are clearly watermarked **DUPLICATE**; refunded or voided visits are watermarked **VOID** or **REFUNDED**.

---

## 8. Owner May Add and Edit Catalogue Items and Prices
- **PDF Section Affected:** Section 7 (Staff Roles & Permissions - Permissions Matrix).
  - *PDF Note:* Permission matrix indicated Owner as "View" for price changes and service catalogue edits.
- **New Rule:**
  - **Owner and Manager both hold full write authority over the service catalogue.** The owner may add new services, add variants, adjust price ranges (list, min, max), toggle active status (disable/enable), and run CSV imports directly from his `/owner/catalogue` portal.
  - Receptionists, staff, and HR remain strictly read-only.
  - **Staff Skills Assignment** remains exclusively with the Manager (Joan) to protect operational dispatch integrity.
  - **Audit & Review Linkage:**
    - Every manager price change appears in the Owner's *"For your review"* inbox.
    - Owner's own changes do not clutter his own review queue. Instead, recent owner additions/edits surface dynamically on the Manager's `/manager/catalogue` page in a dedicated *"From the owner"* panel with a *"Mark as seen"* acknowledgement, a notification badge on the sidebar, and tags (`Added by owner`, `Changed by owner`) active for 7 days.
    - All price changes require an explicit audit reason and are logged immutably to `price_history` and `audit_log` (category `catalogue`).

---

## 9. Staff Portal Architecture & Deliberately Minimal Mobile Design
- **PDF Section Affected:** Section 7 (Staff Roles & Permissions - Staff Portal), Section 3 (Walkthrough Stages 6 to 9), Section 6 (Multi-Stage Visits).
- **New Rule:**
  - **Phone-First Layout (390px):** Single column, touch targets at least 48px, prominent ticket code typography, reachable bottom tab bar with 2 real routes (`/staff` My queue, `/staff/attendance` Attendance).
  - **Zero Privacy Leaks:** Staff portal columns strictly exclude customer phone numbers, customer history, prices in UGX, totals, payments, earnings, performance summaries ("Services completed today: X"), and invented station numbers.
  - **3-Tier Scrolling Queue:**
    1. **Now:** At most 1 in-progress service line with large ticket code, customer first name, service variant, and 2-tap confirmation green **Done** button.
    2. **Next:** Assigned ready lines in FIFO queue order, followed by top 3 pool tickets matching the staff member's skills with large blue **Start** buttons. Atomic pool claiming ensures race conditions are rejected gracefully ("Already taken").
    3. **Coming up:** Blocked lines waiting on prior sequence steps with estimated ready countdown ("Ready in ~10–15 min").
  - **10-Second Undo Window:** Following a Start or Done action, a non-intrusive floating banner offers a 10-second Undo button audited under `operations`.
  - **Forgotten Done Gentle In-App Reminder:** Appears if a service line remains in progress past 90 minutes.
  - **Unified Attendance Single Control:** Top-bar `<AttendancePill />` and `/staff/attendance` read and write to the same `attendance` records in real time.

---

## 10. HR Workspace Scope & Data Minimisation
- **PDF Section Affected:** Section 7 (Staff Roles & Permissions - HR: proposed scope for a small salon, Safeguards for the HR role).
- **New Rule:**
  - **Navigation & Routes:** Exact 8 real routes with desktop-first layout, usable at 1024px:
    1. Overview (`/hr`)
    2. Staff (`/hr/staff`)
    3. Access (`/hr/access`)
    4. Attendance (`/hr/attendance`)
    5. Leave (`/hr/leave`)
    6. Rota (`/hr/rota`)
    7. Performance (`/hr/performance`)
    8. Audit (`/hr/audit`)
  - **Strict Data Minimisation:** HR manages people and access only. HR never sees customer data (names, phones, history) or money data (prices, UGX, revenue, payments, receipts, discounts, reconciliation).
  - **Account Provisioning:** HR can create `staff`, `receptionist`, and `manager` accounts with single-display 6-digit PINs. HR is strictly blocked from creating `owner` or `hr` accounts.
  - **Immediate Deactivation:** Deactivating an account terminates active sessions immediately.
  - **Manager Revocation Confirmation:** Emergency revocations performed by the manager surface in HR's Access workspace for explicit **Confirm** (remains inactive) or **Reverse** (restores access) with mandatory audit reasons.
  - **Onboarding & Offboarding Governance:** Configurable governance checklists per person.
  - **Self-Protection:** HR cannot change their own role, deactivate their own account, or appoint/revoke HR (owner-only authority).
  - **Attendance & Punctuality:** Records for all roles with punctuality summaries (late count, late minutes, avg arrival, absences). Corrections require reason codes, exclude medical details, cannot correct HR's own record (manager only), and appear in Owner "For your review" with tag HR. Export CSV contains people data only.
  - **Leave Management:** Supports approved leave, unapproved absence, and off duty. Approved leave excludes person from expected staff counts and lateness metrics.
  - **Weekly Rota Matrix:** Weekly grid across all roles driving expected staff counts and lateness rules. Supports shift copy rollover.
  - **Performance (Read-Only):** Measured service lines and duration for stylists only (paper forms excluded). Attendance summaries for all roles. Absolute zero prices, revenue, or customer data.
  - **Audit Ledger:** Read-only access restricted strictly to `people` and `access` categories enforced via database RLS with before/after state diffs.

---

## 11. Mzuri Unisex Salon Rebranding, Restyle, Catalogue Audiences, and Premium Customer Tier (Owner Overhaul - Phase 1)
- **PDF Sections Affected:** Section 1 (Executive Summary), Section 2 (Branding), Section 3 (Walk-in & Customer Profiles), Section 7 (Staff Roles & Permissions), Section 8 (Checkout & Catalogue).
- **New Rules (Phase 1 Approved & Implemented):**
  1. **Branding:**
     - The salon is formally named **Mzuri Unisex Salon**.
     - Location is **Mbarara**. Address, phone, and receipt footer are dynamically sourced from `app_setting`.
     - Browser tab title is **Mzuri Unisex Salon**. User avatars use neutral `M` (replacing orange `K`).
  2. **Professional Minimal Restyling:**
     - Removed flashy/AI-themed visual elements (gradients, high-saturation cards, glowing live dots, heavy drop shadows, bright orange accent).
     - Standardized on restrained Mzuri palette:
       - Background: warm light grey `#F6F5F2`
       - Surface: white `#FFFFFF` with clean 1px border `#E4E1DA`
       - Ink: `#1F2328`, secondary text: `#5B6470`
       - Primary accent: muted bronze `#9A7B4F`
       - Status tokens: success `#2F6F4E`, warning `#9A6B1F`, danger `#A33A3A`
       - Numerals: tabular figures enabled via `font-feature-settings: "tnum"`.
  3. **Catalogue Audience Division & New Offerings:**
     - Services and categories are classified by audience: `men`, `women`, or `both` (stored cleanly via composite category strings `audience|category|subcategory`).
     - **Men's haircuts start at UGX 6,000** (Standard Cut: UGX 6,000; Fade: UGX 8,000; Beard Grooming: UGX 10,000).
     - Full range of **Massage** services added (Full Body Massage 60 min UGX 60,000; Half Body Massage 30 min UGX 35,000).
     - Full range of **Makeup** services added (Bridal, Kwanjula/Traditional, Glam, Natural Everyday, Photoshoot, Eyebrow Shaping, Strip Lashes, Gele Tying).
     - Wash & Treatment services added (Hair Wash UGX 10,000, Deep Conditioning, Scalp Treatment, Hair Colouring, Facial Treatment).
  4. **Premium Customer Tier:**
     - Customers are categorized into tiers: `regular` and `premium`, with `premium_since` timestamp and `premium_reason`.
     - **Reception:** Displays a quiet bronze `Premium` pill during walk-in lookup and customer selection so the team recognizes high-value clients.
     - **Manager Customer Directory:** Provides an `All / Premium / Regular` filter toggle, count badges, and an audited modal for manual Mark/Unmark Premium with a mandatory reason code.
     - **Owner Customer Directory:** Read-only view with `All / Premium / Regular` filter toggle, count badges, and quiet `Premium` indicator.
     - **Strict Privacy Rule:** Customer tier is **never** displayed on the public kiosk (`/desk`), public queue TV (`/display/queue`), or staff portal (`/staff`).

---

## 12. Payment-First Flow and Crisp High-Definition Borders (Owner Overhaul - Phase 2)
- **PDF Sections Affected:** Section 3 (Walk-in & Customer Reception), Section 4 (Queue & Station Assignments), Section 8 (Checkout & Payments).
- **New Rules (Phase 2 Implemented):**
  1. **Payments Made Upfront:**
     - Walk-in customers select services and complete payment (Cash or MTN / Airtel Mobile Money with required reference code) **before** a service ticket is allocated.
     - The reception "Pay & Issue Ticket" button initiates visit creation and records the confirmed payment atomically in `payment`.
     - Upfront thermal-style receipts are generated immediately with receipt number, payment method, amount in UGX, and server timestamp.
  2. **Automated Completion Lifecycle:**
     - Visits enter the active queue with status `queued` with payment pre-confirmed.
     - When stylists finish all service lines for a pre-paid visit, the visit automatically moves to status `completed` without waiting for post-service checkout.
     - Replaces post-service checkout friction while keeping all financial audit trails intact.
  3. **High-Definition Contrast & Professional Blue Styling:**
     - Border and separator token `--border` elevated from muted slate to crisp `#CBD5E1` (`slate-300`) across all cards, tables, inputs, and navigation panes.
     - Primary brand accent established as rich professional royal blue (`#1D4ED8`) with pure white card surfaces and dark slate typography.






---

## 13. Customer Kiosk Overhaul (KFC-Inspired Self-Ordering Layout - Phase 3)
- **PDF Section Affected:** Section 2 (The Customer Desk / Self-Service Tablet - `/desk`).
- **New Rules (Phase 3 Implemented):**
  1. **Audience Toggle & Visual Navigation:**
     - Top audience tabs toggle between **Men's Services** and **Women's Services**. Services configured with `both` seamlessly appear in both audience views.
     - Search bar allows fast, instant filtering of catalogue items.
  2. **Left Vertical Category Rail:**
     - Clean vertical category sidebar (e.g. Cuts & Fades, Grooming, Wash & Treatments, Massage, Plaits & Braids, Makeup) with active indicator chevrons.
  3. **High-Contrast Service Cards & Inline Steppers:**
     - Cards display service name, subcategory badge, estimated duration in minutes, and transparent list price starting at UGX 6,000.
     - Interactive `+` / `-` quantity steppers allow selecting single or multiple services directly from the grid.
  4. **Floating Cart & Review Drawer:**
     - Bottom bar shows selected item count, total price in UGX, and a "Review Selection" button that opens an order summary sheet.
  5. **Phone Entry via On-Screen Numeric Keypad:**
     - Clear touch-friendly 3x4 dial pad for Ugandan phone numbers (`07...`).
     - Complies with data privacy rule: displays static notice *"We keep your phone number for your visit history; no SMS sent"*.
  6. **Ticket Confirmation & Payment Instruction:**
     - Generates ticket code and explicitly instructs the client to proceed to reception for upfront payment before queue entry.
     - Displays estimated wait time and full breakdown of selected services.


---

## 14. Creatable Appointments & Staff Portal History Count (Phase 4)
- **PDF Sections Affected:** Section 3 (Walk-in & Customer Reception), Section 5 (Staff Rota, Attendance & Staff Station).
- **New Rules (Phase 4 Implemented):**
  1. **Creatable Advance Appointments:**
     - Added "Book Appointment" modal on both the **Reception Appointments** (`/reception/appointments`) and **Manager Appointments** (`/manager/appointments`) schedules.
     - Captures client name, valid Ugandan phone number (normalized to E.164), active catalogue service, optional preferred stylist, booking date, time, and expected duration in minutes.
     - Upserts customer records without SMS overhead and schedules advance bookings in the remote Supabase `appointment` table.
  2. **Staff Portal Customer History Counter:**
     - Stylists now see their lifetime client volume via a dedicated **"Customers Served"** stat tile at the top of their portal (`/staff`).
     - Computed dynamically in the repository from unique customer visits where the staff member completed service lines (`status = 'done'`).
  3. **Assigned Appointments on Staff Portal:**
     - Displays all scheduled appointments assigned to the logged-in stylist directly within the mobile phone portal.
     - Shows client first name, booking date, scheduled time, service name, duration, and status (`Booked`, `Late`, or `Finished`).


---

## 15. Manager Targets Setting, Staff Portal Progress & Commission Base Pay (Phase 5)
- **PDF Sections Affected:** Section 5 (Staff Rota, Attendance & Staff Station), Section 7 (Staff Roles & Permissions - Manager Powers), Section 9 (Financial Reporting & Pay Calculations).
- **New Rules (Phase 5 Implemented):**
  1. **Manager Target Configuration:**
     - Managers can set customer volume targets directly from the **Staff Administration** page (`/manager/staff`) via a "Set Target" modal.
     - Supports flexible periods: **weekly**, **monthly**, or **3-month**, with a specific target deadline date.
     - Managers assign a commission base percentage (e.g. 15%) tied to the target volume.
     - Every target assignment or update is logged to `audit_log` with category `operations`.
  2. **Staff Portal Target & Commission Progress:**
     - On the mobile **Staff Portal** (`/staff`), stylists see an interactive **Target & Commission** banner displaying:
       - Current customer count vs. target goal (e.g. `0 / 60 clients`).
       - Percentage completion bar.
       - Target period and due date.
       - Commission base rate (% on volume) calculated for their pay statements.
  3. **Commission Base Reconciliation:**
     - Reverses the preliminary "no commissions anywhere" policy to support performance-driven remuneration where customer targets act as the baseline commission tier.


---

## 16. Modern Split Login & 3-Column Minimal Queue Screen (Five Fixes - Phase 1)
- **PDF Sections Affected:** Section 1 (Front Desk & Public Area Displays), Section 7 (Staff Roles & Authentication).
- **New Rules (Phase 1 Implemented):**
  1. **Modern Split Login Layout (`/login`):**
     - Full desktop split layout featuring a dark brand photography hero panel on the left (`/images/salon_hero.jpg` with a warm dark gradient overlay), refined serif wordmark **Mzuri Unisex Salon**, location mark **Mbarara**, and brand welcome text.
     - Right form panel on white surface with segmented role selector (`Owner`, `Manager`, `HR`, `Reception`, `Staff`), username input, and 6-digit PIN with numerical keypad support (`inputmode="numeric"`), show/hide password toggle, and clear inline validation.
     - On mobile screens (390px), gracefully collapses into a compact brand header and full-width form.
  2. **Three-Column Queue Display (`/display/queue`):**
     - Replaced old 2-column neon display with the specified 3-column architecture:
       - **Now serving**: Displays tickets currently in progress with very large typography and stylist/station destination (e.g. `A17` -> `Grace` or `Styling`).
       - **Next**: Up to 6 tickets ready for stylists or pool; between-services visits explicitly indicate next step (e.g. `Next: Grace · blow-dry`) without exposing any client identity.
       - **Waiting**: Remaining queue order tickets in high-contrast tiles with an automated `+ N more` overflow banner and an overall estimated wait time header (`About 25 to 35 minutes`).
     - **Privacy & Minimalism**: Dark charcoal surface (`#1F2328`), off-white text, muted bronze accent (`#9A7B4F`). Zero customer full names, surnames, or phone numbers.
     - Displays quiet timestamp `Updated 13:20` and friendly empty states (`No one is being served right now`, `No one is waiting in line`).


---

## 17. Catalogue Image Management & Canonical Categories (Five Fixes - Phase 2)
- **PDF Sections Affected:** Section 8 (Catalogue & Price Book Management), Section 1 (Customer Desk / Kiosk).
- **New Rules (Phase 2 Implemented):**
  1. **Image Upload in Catalogue:**
     - Add Service and Edit Service modals now include a dedicated image dropzone supporting drag-and-drop or file selection.
     - Strict client and server-side validation: JPG, PNG, or WebP; maximum 5 MB; minimum 800 px on the shortest side.
     - Automated image optimization via Sharp into:
       - **4:3 aspect ratio** card asset (1200x900, WebP) for the kiosk.
       - **1:1 aspect ratio** thumbnail (300x300, WebP) for owner/manager management lists.
     - Storage bucket `catalogue-images` configured for public read access. Uploads and replacements write to `audit_log` under category `catalogue`.
  2. **Featured on Kiosk & Sort Order:**
     - Each service item now supports a **Featured on kiosk** toggle and a numerical **Display Order** rank.
  3. **Canonical Category Cleanup:**
     - Merged duplicate and near-duplicate categories into the canonical 9 categories:
       1. `Haircuts`
       2. `Hair care and treatments`
       3. `Colour`
       4. `Braids and styling`
       5. `Massage`
       6. `Makeup`
       7. `Nails` (merged from legacy "Nails & Spa" and "Nails & Beauty")
       8. `Skin and facials`
       9. `Brows and lashes`
     - Accessible and manageable via the "Categories" modal in the Catalogue board for owners and managers.
  4. **Commercial Photography Assets:**
     - Face-free, high-resolution commercial photography seeded to `public/demo-images/` and uploaded to Supabase Storage `catalogue-images/demo/`, with full source attribution and Unsplash free commercial licenses documented in `docs/IMAGE_CREDITS.md`.


---

## 18. Image-Led Customer Tablet Kiosk (`/desk`) (Five Fixes - Phase 3)
- **PDF Sections Affected:** Section 1 (Customer Desk / Tablet Self-Order Kiosk), Section 3 (Customer Reception & Confirmation).
- **New Rules (Phase 3 Implemented):**
  1. **Welcome Screen Hero & Audience Tiles:**
     - A welcoming entry view with the refined **Mzuri Unisex Salon** wordmark and Mbarara badge.
     - Two rich commercial photography cards: **Men's Services** (grooming, cuts, beard care, shaves) and **Women's Services** (braids, weaves, natural hair, treatments, nails & makeup).
     - **60-Second Idle Timeout**: Automatically clears cart state and resets the tablet back to the welcome screen when left unattended.
  2. **Image-Led Kiosk Browsing Layout:**
     - Left category rail with canonical category chips and instant filtering.
     - Top audience switcher for Men's and Women's services, plus search filter.
     - **4:3 Photography Cards**: Each service features high-resolution photography, estimated duration badge, category tag, and starting price (`Starting from UGX 15,000`).
  3. **Bottom Variant Selection Drawer:**
     - Tapping "Select" on a card slides open a focused bottom selection sheet listing all available length or styling variants with expected durations and exact UGX list prices.
  4. **Floating Basket & Reception Payment Confirmation:**
     - Floating bottom basket summary displaying selected service count and total UGX.
     - Identification step collecting customer first name and phone number strictly for visit history.
     - Confirmation screen renders the large ticket code (e.g. `T314`) in bronze typography, with total amount and instructions to pay at reception before service. No SMS opt-in or false promises.


---

## 19. Staff Portal Restructure & Sensitive Data Protection (Five Fixes - Phase 4)
- **PDF Sections Affected:** Section 5 (Staff Rota, Attendance & Staff Station), Section 7 (Staff Roles & Permissions - Data Boundaries).
- **New Rules (Phase 4 Implemented):**
  1. **Queue as Central Screen (`/staff`):**
     - The main `/staff` landing route is dedicated exclusively to the **live queue**:
       - **Now (In progress)**: Current active ticket with large typography, customer first name, service variant, and large green/bronze Done button with 2-tap release safeguard.
       - **Next (Ready)**: Tickets ready for the stylist or pool, with large Start action buttons.
       - **Coming up**: Blocked tickets waiting on prior steps.
     - Removed cluttering cards (customers served, target progress, and appointment lists) from the primary queue page.
  2. **Dedicated Modular Tab Routes:**
     - Restructured staff navigation into 5 clean, focused tab routes:
       - `/staff`: Live Queue (Now, Next, Coming up).
       - `/staff/appointments`: Booked client appointments with dates, times, and duration.
       - `/staff/target`: Monthly/weekly customer volume goal with visual progress bar, percent completion, due date, and status pace note.
       - `/staff/history`: Lifetime customers served counter and recent completed services audit.
       - `/staff/attendance`: Personal 7-day clock-in/out records.
  3. **Complete Removal of Pay and Commission Rates from Staff Views:**
     - Purged **"Commission Base 10% on volume"** and all other monetary pay, commission, bonus, or volume tariff rates from all staff views.
     - Staff members only see volume targets and customer counts, protecting business remuneration details.
  4. **Strict Customer First-Name Normalization:**
     - Enforced `cleanFirstName` across all queue, appointment, and history items.
     - Strips surnames and title-cases first names (e.g. `"Michael Philips"` $\rightarrow$ `"Michael"`, `"jonah"` $\rightarrow$ `"Jonah"`, `"alvin smith"` $\rightarrow$ `"Alvin"`). Full customer names and phone numbers are never displayed to staff.

## 20. Receipt Printing and Receipt Settings (Phase 1)
- All post-payment and duplicate receipt print actions use the shared print helper and `/print/receipt/[visitId]`; a hidden same-origin frame prints the dedicated receipt document.
- Reception Visits, checkout preview, Customer History and Manager Visits share the same `ReceiptDocument` for preview and printing. Reprints use the immutable issue snapshot, add a duplicate stamp and Kampala reprint time, increment the count and create a `RECEIPT_REPRINTED` audit row.
- Receipt branding, optional address/phone/footer and the fiscal disclaimer setting are read from location settings. Known demo placeholders are cleared by `20261104000001_receipt_print_defaults.sql`; no contact details are invented in application defaults.
- `OwnerSettingsView` can edit receipt details. The disclaimer setting defaults to enabled.

## 21. HR and Attendance Improvements (Phase 1)
- Added `staff_presence_today`, a Kampala-day database view shared by Manager, Owner, Reception, and HR snapshots. It emits only Present, On break, Out, Not present, or On leave; all snapshot chips use the shared component.
- HR Overview now derives presence from that view, shows the present/expected count, and opens detail panels for attendance tiles and the review queue. Leave approval and manager revocation decisions are available from the review panel with a required reason.
- Staff attendance history no longer labels people late/on time; lateness remains in HR attendance and Owner Staff summary views.
- Added an action/category registry, database-side category enforcement, and an HR-only people/access audit view. The HR ledger uses plain-language actions and readable allow-listed state fields instead of raw JSON.
- App shell resolves the signed-in display name and role instead of showing “Operational User”.
- Migration `20261105000002_hr_presence_audit.sql` and pgTAP coverage are local and still need database application after review. The remote database does not yet expose the new view.

## 22. HR Skills and Exports (Phase 2, 2026-11-05)
- HR and Managers can assign active catalogue services to active staff from their Staff pages. Assignment uses `set_staff_skills`, validates role/location/service state in the database, and records people-category audit details. Catalogue service assignments call the same RPC path.
- Staff queue views subscribe to `staff_skill` realtime events and retain a one-second refresh fallback so skill changes are reflected promptly.
- HR Staff rows show at most four service chips with a `+N more` editor entry, sentence-case status, Kampala phone formatting, HR role label, and readable start dates.
- HR Staff, Attendance, Leave, Rota, Performance, and Audit include shared CSV and generated A4 PDF exports. Exports use the active filters, carry salon/location and generation details, repeat the table heading on each PDF page, and include a confidentiality footer. HR export events are recorded as people-category audit items.
- Migration `20261106000001_hr_skills_exports.sql` is local and awaits review before database application. The CLI is installed as a dev dependency and `npm run check:data` is configured; pgTAP awaits a local Docker/Postgres runtime. See `docs/VERIFICATION.md` for all Phase 2 checks and browser limitations.

## 23. HR Attendance and Leave Policy (Phase 3, 2026-11-05)
- **Attendance policy:** HR can edit standard start/end, late and early-departure grace, working days, and optional role overrides. Rota shifts take precedence. Policy changes are effective-dated and clocked attendance rows keep their policy snapshot.
- **Attendance records:** HR Attendance defaults to Overview and offers date presets/custom range, role/person filters, Daily Records, and Working Hours. Metrics derive from clock taps, recorded breaks, rota, and approved leave. Past shifts missing clock-out are flagged without estimating hours.
- **Overview:** Six attendance metric cards, five period charts, attention list, and a staff attendance detail dialog. Leave balance data is surfaced on the overview.
- **Leave policy:** Role entitlements, individual overrides, leave-year start (January 1 default), and public holiday dates are editable with audit entries. Entitlements are blank until the owner confirms salon policy; no legal entitlement is assumed.
- **Leave types and balances:** Annual leave reduces balance on scheduled working days and excludes configured holidays; pending days remain separate. Unpaid leave and other approved leave do not reduce annual entitlement. The form does not request leave reasons or medical details. HR Leave exports include balance fields.
- **Database:** Local migration `20261106000002_hr_attendance_leave_policy.sql` creates effective-dated policy tables, break periods, attendance and balance views, HR-only policy RPCs, and people-category audit mappings. The migration and `supabase/tests/hr_attendance_leave_policy.sql` are not applied/run pending review and a local Postgres runtime.
- Metric formulas and data limits are documented in `docs/HR_METRICS.md`. No commit or push was made pending review.

## 24. Staff Leave Requests and In-App Notifications (Phase 4, 2026-11-05)
- **Staff leave page:** `/staff/leave` gives staff their own entitlement, taken, approved upcoming, pending, and remaining annual leave, an estimated working-day count, upcoming approved leave, request history, status and pending-request cancellation. Mobile navigation has Queue, Appointments, Target, and More; History, Leave and Attendance are in More. Desktop navigation shows all staff pages.
- **Validation:** `request_my_leave` and `preview_my_leave_request` enforce active staff role, no past dates, valid date range, scheduled working-day count, overlap exclusion, and annual leave availability. `cancel_my_leave_request` only cancels the actor’s pending request. Staff have read access only to their own leave rows; table writes are revoked and go through server-authorized RPCs. HR can still override by recording or deciding leave through the HR workspace. Other roles do not get self-service leave in this version; HR records their leave, and the manager records HR leave.
- **Notifications:** the shared `notification` table now supports per-user in-app messages with RLS, server-stamped read times, a realtime bell/unread count, mark-as-read, and a no-sound toast. A new request notifies active HR users; approval or rejection notifies the staff member. Rejection notices direct the staff member to contact HR. No reason text or medical details are collected or stored, per Ayuen’s decision.
- **Database:** Local migration `20261106000003_staff_leave_notifications.sql` adds the in-app notification fields/policies, staff RPCs, cancellation status, and leave-change trigger. pgTAP coverage is in `supabase/tests/staff_leave_notifications.sql`; the optional database mutation Playwright flow is in `e2e/staff-leave.spec.ts`.
- Migrations 1–3 and Phase 4 are not applied to the remote database. The Supabase CLI test command is blocked in this workspace, so live database and realtime behavior remain unverified. No commit or push was made.

## 25. Shared Staff Performance (Phase 5, 2026-11-05)
- Added a server-only `get_staff_performance_report` RPC and typed repository/action module shared by HR Performance and Owner Staff. HR and owner screens now use the same scoped date, role, people, attendance, and measured-service calculations.
- HR Performance provides today/week/month/custom ranges, role filters, per-person details, daily service and start-hour charts, category actual-vs-expected time, target progress, attendance, team comparisons, and CSV/PDF exports.
- The report excludes customer identifiers, contact details, service prices, revenue, and commission settings. Service measures only apply to stylists; other roles display attendance with service measures marked not applicable.
- Formula definitions and eligibility rules are documented in `docs/HR_METRICS.md`. Migration `20261106000005_hr_staff_performance.sql` and pgTAP coverage are local pending database review and execution.

## 26. Reception Kiosk Order Handoff (2026-11-07)
- Reception Check-in now lists pending K-code orders separately from the paid salon queue, with name, services, estimate, wait time, live search, a five-second new-order highlight, claim ownership and “Didn’t come” reasons.
- Reception opens a kiosk order into the existing builder. It must claim the order, read the phone number back and provide a Mobile Money reference when applicable. Customers are matched by normalized phone; new customer rows are only created during successful payment confirmation.
- A database transaction revalidates the current catalogue, checks stylist eligibility and discount limit, records payment, allocates the A-code, queues the original visit and inserts its immutable receipt snapshot. A retry with the same idempotency key returns the existing ticket/receipt.
- The receptionist sees the stored estimate beside the current total. When a catalogue price changed, each changed service and its old/new price are identified; additions/removals are called out as order changes.
- Manager Today counts kiosk drafts as “Orders awaiting payment”; Manager and Reception Visits have an Awaiting payment view. Reception Check-in displays the count in its sidebar badge. Pending kiosk rows are excluded from active visit-close blockers and are expired and logged at manager day close.
- Migration `20261107000001_kiosk_reception_handoff.sql` adds claim fields, role/location checked RPCs and transaction flow, plus close-day expiration. It is applied to the Supabase production project. No commit or push was made.

## 27. Kiosk Reliability and Day Status (2026-11-07)
- Registered all six kiosk audit actions (created, claimed, released, cancelled, expired, and payment-confirmed) under canonical categories. Added `scripts/check-audit.mjs` and `npm run check:audit`; its self-tests reject a missing action and conflicting category mappings.
- Replaced native browser alert/confirm/prompt calls with shared toasts and dialogs. Kiosk claim now always exits its busy state and reports errors in-app.
- Added a compact kiosk-order card below Reception Check-in’s live queue and searchable, paginated `/reception/kiosk-orders` and `/manager/kiosk-orders` pages. Visits includes links to awaiting-payment orders.
- Paired kiosks read business-day status before showing the menu, display offline/closed states, and recheck status. Queue display shows a closed-day state; order creation retains its server-side day guard.
- Migrations `20261107000003_kiosk_audit_registry.sql` and `20261107000004_kiosk_business_day_status.sql` were applied to the linked production project. Read-only verification confirmed both RPCs and all six registry actions. No commit or push was made.
- Added loading boundaries to both kiosk-order routes. The changed layers include reception and kiosk views/actions/repositories, the queue view, manager/reception Visits links, shared toast service/host, app layout/shell and role navigation, two App Router pages, route loading boundaries, audit checker, ESLint config, migration and pgTAP coverage, plus the required docs. Verification details and limits are in `docs/VERIFICATION.md`.

## 28. Attendance Workspace Gate (2026-11-07)
- Middleware now checks the signed-in user's active attendance for the Kampala business date before serving Manager, Reception, HR, or Staff pages. The Owner, login/PIN routes, paired devices, sign-out endpoint, and notification API are excluded.
- Added a standalone attendance gate with current identity, role, Kampala time, scheduled start when available, and “I’m in” / “I’m back” actions. A request to a deep link returns to that route after marking In. Changing to Break or Out immediately hides the workspace; realtime invalidations refresh attendance across open tabs.
- Operational Server Action requests made while not clocked in receive a structured `not_clocked_in` response. Staff with an in-progress service cannot take a break or clock out.
- Migration `20261107000005_attendance_workspace_gate.sql` installs the service-only attendance predicate and is applied to production. `supabase/tests/attendance_workspace_gate.sql` verifies Not In, In, Break, Out, and Owner-exempt states in a rollback transaction.
- Phase 2 implementation is ready for review. No commit or push was made.
