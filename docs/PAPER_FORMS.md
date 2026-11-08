# Paper Fallback Forms (Appendix A & B)

This document details the physical paper fallback system for Mzuri Unisex Salon (Mbarara, Uganda) per Appendix A of the walkthrough specification and `docs/CHANGES_AFTER_PDF.md`.

## Core Principles

1. **Payment is Taken Before Service:**
   - Under the payment-first rule, every customer pays at reception before proceeding to a styling station or barber chair.
   - On the Customer Visit Sheet (Form 1), the payment confirmation block appears directly above the service execution times.
2. **Staff Carry No Paper:**
   - Stylists and barbers do not carry paper forms, clipboard slips, or commission vouchers.
   - When finished with a client, the staff member reports their start and done times verbally to reception.
   - Pay statements and commission figures are private and managed exclusively by the manager in the system.
3. **Form Paper Size:**
   - All forms are strictly formatted for standard **A4 portrait** paper (`210mm x 297mm`). Thermal rolls are reserved exclusively for customer payment receipts.
4. **Clean Print Routes Without Screen Chrome:**
   - Forms are served at dedicated clean routes under `/print/forms/*` without sidebars, headers, banners, or controls.

---

## The Four Standard Forms

### 1. Customer Visit Sheet (`/print/forms/visit-sheet`)
- **Format:** 2 sheets per A4 page (138mm height each) with a central dashed cut line.
- **Batch Serial Numbering:** Supports `?count=N&start=NNNN` to print pads of consecutively numbered sheets (e.g., `R-0001` through `R-0020`).
- **Fields:**
  - Serial number (pre-printed) & visit date
  - Paper ticket code (`P__`) & arrival time
  - Customer first name & phone number with read-back verification box
  - Booked appointment toggle
  - Up to 5 service lines with list prices and preferred stylist designation
  - Subtotal, discount amount, discount reason, and manager approval initials
  - **Payment-First Confirmation Block:** Method (Cash / MoMo), MoMo reference code, amount received, time paid, and cashier initials
  - **Service Times:** Stylist first name, start time, end time (reported to reception)
  - **System Entry Audit:** Entered in system by and datetime stamp

### 2. Reception Queue & Walk-in Tally Sheet (`/print/forms/queue-sheet`)
- **Format:** Full 1-page A4 sheet with 24 ruled rows ($\ge 8.5\text{ mm}$ height).
- **Purpose:** Clipboard tracking of queue sequence during power or system outages.
- **Fields:** Paper Code, Time paid, Customer first name, Services requested, Stylist assigned, Time called, Time done.
- **Constraint:** Zero monetary columns (financial details remain on Form 1).

### 3. Manager's Day Summary Sheet (`/print/forms/manager-sheet`)
- **Format:** Full 1-page A4 sheet restricted to role `manager`.
- **Sections:**
  - Staff attendance roster (7 core staff, in/out, lunch breaks, late flags)
  - Log of exceptions (voids, refunds, discounts > UGX 5,000, comps)
  - Mobile Money received log (matched against direct telecom statements)
  - Closing time, manager signature, and owner counter-signature

### 4. End-of-Day Cash Drawer Handover Sheet (`/print/forms/cash-count`)
- **Format:** Full 1-page A4 sheet for morning opening, shift handovers, and evening reconciliation.
- **Sections:**
  - Banknote count table: 50,000, 20,000, 10,000, 5,000, 2,000, 1,000 UGX
  - Coin count table: 500, 200, 100, 50 UGX
  - Summary reconciliation: Total physical cash counted, less opening float (UGX 50,000), net cash collected, expected cash from visit sheets, variance over/short, and dual signatures.
