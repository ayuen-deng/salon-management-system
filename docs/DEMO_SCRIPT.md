# Mzuri Unisex Salon (Mbarara) — Live Owner Demo Script

**Target Audience:** Godfrey Mugisha (Salon Owner)  
**Presenter:** ayuen-deng  
**Duration:** 30–40 Minutes  
**Devices Required:**
- **Laptop 1 (Joan / Manager & Mary / Receptionist):** Chrome browser open at `http://localhost:3000/reception` and tab with `/manager`.
- **Phone (Godfrey / Owner):** Mobile viewport at `http://localhost:3000/owner` or owner login screen.
- **Tablet / Secondary Display (Salon Counter):** Browser open at `http://localhost:3000/reception#tablet` (Customer mirror).
- **Wall Display / TV:** Browser open at `http://localhost:3000/tv` (Customer-facing queue display).

---

## Pre-Demo Prep (5 Minutes Before)

Run in terminal:
```bash
# 1. Reset data and prepare fresh morning opening
npm run demo:scenario morning

# 2. Check remote database latency
npm run latency:check
```

Confirm all 4 demo devices are connected to the salon Wi-Fi or hotspot and loaded on their respective entry URLs.

---

## Act 1: The Owner's Perspective (Kampala / Phone) — 8 Minutes

### 1.1 Owner Sign-In
1. Hand the smartphone to Godfrey or show the mobile screen.
2. Navigate to `/login?role=owner`.
3. Enter credentials:
   - **Username:** `owner`
   - **6-digit PIN:** `111111`
4. Tap **Sign In**.
5. *Point out:* Instant redirect to the **Owner Monitor**, perfectly scaled for a 390px mobile screen with clean card layout and collapsible bottom drawer.

### 1.2 Live Morning State
- Show the top stat cards:
  - **Revenue:** UGX 0 (Day freshly opened)
  - **Verified Split:** 0%
  - **Salon Activity:** 0 Served (Day just started at 08:00 AM)
  - **Staff on Floor:** 6 of 6 Present (Joan, Mary, Grace, Sarah, Peter, Rose)
- *Emphasize:* "Godfrey, whether you are in Kampala or travelling, this phone view is connected directly to your Mbarara salon database in real time. No manual phone calls asking 'how much have we made today?'"

---

## Act 2: The Walkthrough — Aisha's Saturday Journey — 15 Minutes

### 2.1 Customer Check-in at Reception (Laptop 1 & Counter Tablet)
1. Switch to Reception view (`/reception`).
2. Show the **Check-in Form**:
   - Phone: `0772990001`
   - Name: `Aisha`
   - Service selection: **Wash & Set** + **Braiding (Knotless)**
3. Tap **Check In Aisha**.
4. *Observe Multi-Device Realtime Update:*
   - Reception queue immediately shows ticket **A01**.
   - Customer Tablet (`/reception#tablet`) shows Aisha's name, ticket code **A01**, and estimated wait time.
   - Wall TV (`/tv`) dings and shows Ticket A01 in the Waiting column.
   - Owner Phone (`/owner`) updates Salon Activity: "1 Waiting".

### 2.2 Aisha in Service (Staff Station)
1. Open Staff View (`/staff`) signed in as **Grace** (`grace` / `555555`).
2. Grace sees Aisha at the top of her queue.
3. Grace clicks **Start Service** (Shampoo & Hair Wash).
4. Aisha moves to **In Service** across all screens (TV, Tablet, Reception, Owner).
5. 20 minutes later (simulated), Grace clicks **Complete Service**.
6. The system transitions Aisha to the second service in sequence (Braiding assigned to Sarah).

### 2.3 Edge Case 1: The Wash-to-Blow-dry Wait
- Show that when Aisha finishes shampooing but Sarah is finishing another customer, the ticket displays in the **Waiting for Next Step** state.
- Explain: "The system tracks wait time between multiple stylists so no client gets forgotten in the dryer chair."

---

## Act 3: Manager Controls & Edge Cases — 10 Minutes

### 3.1 Edge Case 2: Walkout / Abandonment
1. Check in a walk-in client (e.g. `Ronald`, Haircut).
2. Ronald decides he cannot wait and leaves.
3. In Reception/Manager Queue, click **Mark Walkout / Abandon**.
4. Prompt asks for reason: Select *"Client could not wait"*.
5. Explain: "This does not erase the record. It logs the abandonment reason in the daily audit report so we know how much business we lose to long wait times."

### 3.2 Edge Case 3: Price Dispute & Manager Discount Approval
1. At checkout, Aisha requests a special discount of UGX 8,000 (exceeding receptionist's UGX 5,000 limit).
2. Receptionist requests manager approval.
3. Switch to Manager view (`/manager`).
4. The **Approvals Inbox** badges "1 Pending".
5. Joan clicks **Approve**.
6. Checkout total updates to reflect the approved discount, and an audit trail entry is generated.

### 3.3 Payment & Verification
1. Aisha pays UGX 120,000 via **MTN Mobile Money**.
2. Mary enters the transaction reference: `MTN-998822`.
3. Ticket prints receipt / releases Aisha.
4. On Owner Phone:
   - Total Revenue updates to UGX 120,000.
   - MoMo split updates.

---

## Act 4: The Paper Safety Net & Day Close — 7 Minutes

### 4.1 Paper Safety Net (Power / Internet Outage)
1. Navigate to `/print`.
2. Show pre-printed operational forms:
   - Walk-in Intake Sheets
   - Service Station Traveler Cards
   - Daily Cash & MoMo Reconciliation Sheet
3. Switch back to `/reception#paper`:
   - Click **Enter from Paper**.
   - Show how a receptionist can back-enter 10 tickets in 3 minutes after power returns with original timestamps.

### 4.2 Two-Step Day Close & Accidental Close Undo
1. In Manager View (`/manager`), click **Begin Day Close**.
2. Physical cash count prompt: Enter counted cash (e.g. `170,000 UGX`).
3. Click **Confirm Day Close & Lock Snapshot**.
4. The day is now locked. No new tickets can be added.
5. *Edge Case:* "What if Joan closed by accident while one client was still in the chair?"
6. Click **Undo Day Close** (with manager reason prompt).
7. The day reopens cleanly with an audit log record explaining the reopen.

---

## Act 5: Q&A & Wrap-Up

1. Open **Integration Status Panel** on both Owner and Manager views:
   - Mobile Money: Simulated / Statement Reconciliation Ready
   - SMS / WhatsApp: Offline Direct (Twilio / Africa's Talking Ready)
   - URA EFRIS: Manual Compliance Mode
2. Reiterate that data is 100% live on Supabase Postgres with role-level security.
3. Walk through the questions in `docs/OWNER_DECISIONS.md`.
