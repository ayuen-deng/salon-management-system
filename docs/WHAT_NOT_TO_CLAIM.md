# Strict Boundaries: What NOT to Claim During the Live Owner Demo

**Purpose:** Keep the presentation 100% honest, professional, and grounded in working reality. Avoid making speculative claims about third-party automated integrations that are not yet connected to live external provider accounts.

---

### 1. Mobile Money (MTN / Airtel)
- **What is working:**
  - Cashier enters customer phone number and the transaction reference code printed on the customer's phone SMS.
  - End-of-day reconciliation: The manager uploads the official MTN / Airtel CSV statement from their merchant portal. The system matches reference codes, amounts, and identifies discrepancies (unrecorded transactions, wrong amounts, customer tips).
- **What is NOT working (Do NOT claim):**
  - Do NOT claim that the system triggers automatic USSD push prompts (STK push) to the customer's phone.
  - Do NOT claim that MTN or Airtel balances update automatically without uploading the portal statement.
  - *Honest positioning:* "The system is statement-reconciled. This prevents the frequent scam in Ugandan salons where clients show fake SMS messages to cashiers, while avoiding costly third-party aggregator transaction fees."

---

### 2. SMS Notifications & WhatsApp Alerts
- **What is working:**
  - Customer phone numbers are normalized to E.164 (`+256...`) strictly for visit lookup and customer history.
  - Customer ticket codes are displayed on the live queue display TV and shown prominently on the customer tablet screen upon check-in; receptionist also speaks the code.
  - No SMS messages are sent, no SMS check-boxes exist, and no consent flags are requested.
- **What is NOT working (Do NOT claim):**
  - Do NOT claim that SMS is used, promised, or sent to customers. SMS has been removed from customer-facing operations.
  - *Honest positioning:* "Customer tickets are announced and shown directly on the lobby queue display and check-in tablet. No customer SMS costs are incurred."

---

### 3. Email Reports
- **What is working:**
  - Daily EOD summaries and audit reports are formatted and ready.
- **What is NOT working (Do NOT claim):**
  - Do NOT claim automated nightly SMTP delivery to the owner's Gmail.
  - *Honest positioning:* "The owner has direct live access to the dashboard from his phone anytime. Scheduled email exports will be plugged into your preferred company mail server."

---

### 4. URA EFRIS (Electronic Fiscal Receipting and Invoicing System)
- **What is working:**
  - Every transaction has an immutable audit log, timestamp, and unique ticket ID.
- **What is NOT working (Do NOT claim):**
  - Do NOT claim that the salon is transmitting fiscal data live to Uganda Revenue Authority servers or generating URA QR fiscal codes.
  - *Honest positioning:* "The system maintains clean, tamper-evident transaction logs suitable for standard bookkeeping and accountant review. Full EFRIS system-to-system integration requires a URA sandbox certificate and will be evaluated in Phase 2."

---

### 5. Automated Hardware Printing
- **What is working:**
  - Clean HTML/CSS print stylesheets for receipt slips and paper backup intake sheets at `/print`.
  - Standard browser `window.print()` support.
- **What is NOT working (Do NOT claim):**
  - Do NOT claim automatic silent printing to raw ESC/POS thermal printer USB ports without a browser print dialog.
