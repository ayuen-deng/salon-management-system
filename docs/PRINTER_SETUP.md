# Printer Setup & Configuration Guide

**Project:** Mzuri Unisex Salon (Mbarara, Uganda)  
**Spec of Record:** `docs/salon_operations_walkthrough.pdf`, as amended by `docs/CHANGES_AFTER_PDF.md`.

This guide covers one-time hardware and browser printer setup on the reception desk computer for thermal roll receipt printing, plus fallback procedures if the roll printer goes offline.

---

## 1. Hardware & Printer Driver Configuration

1. **Printer Hardware:**
   - 80 mm POS Thermal Receipt Printer (e.g. Epson TM-T20 / TM-T88, Star Micronics TSP100, Xprinter 80mm USB).
   - Standard 80 mm thermal paper roll (BPA-free).
2. **Default Printer Selection:**
   - Set the thermal roll printer as the default printer on the reception computer (`Windows Settings > Bluetooth & Devices > Printers & Scanners > Set as default`).
3. **Driver Paper Size Settings:**
   - Paper Size: `80mm x Receipt` (or `80 x 297 mm` continuous roll).
   - Cut Mode: `Cut after each job` (or partial cut).
   - Print Density / Darkness: Standard / Medium.

---

## 2. Browser Print Settings (Google Chrome / Chromium)

To ensure seamless, clean roll printing with zero screen chrome:

1. **Margins:** Set to **None** (`@page { margin: 0 }` is enforced by the app).
   - Setting margins to None removes the browser's default URL, page title, date, and "Page 1 of 1" headers and footers.
2. **Headers and Footers:** **Uncheck** / Toggle **Off**.
3. **Paper Size:** Select **80mm** or `Custom (80 x 297 mm)`.
4. **Scale:** Set to **100%** (Fit to printable area).
5. **Kiosk Mode Printing (Optional Recommended Setup):**
   - For automatic 1-click or popup-less receipt printing, launch Chrome with:
     ```cmd
     chrome.exe --kiosk-printing --app=http://localhost:3000/reception
     ```
   - This bypasses the print dialog and outputs directly to the 80mm thermal roll printer.

---

## 3. Receipt Specifications & Compliance

- **Route:** `/print/receipt/[visitId]`; all app entry points use the shared `printVisitReceipt` function.
- **Print isolation:** the shared function loads the dedicated route in a hidden same-origin frame, prints from that frame, then removes it. A modal or app page is never the print document.
- **Width:** one 80 mm continuous column with an app named print page and zero page margins.
- **Data source:** the immutable receipt snapshot stored with the payment. A later catalogue price or customer profile change does not rewrite the original receipt.
- **Brand settings:** salon name, location, optional address, optional phone, optional footer and fiscal disclaimer setting come from the location's `app_setting` rows. Address, phone and footer begin blank.
- **Privacy:** customer first name only; no customer phone or surname.
- **Issue and reprint times:** issue date and time remain the original Kampala time. A duplicate also records the reprint time.
- **Legal compliance:** the setting `receipt_fiscal_disclaimer_enabled` defaults to true and controls *"This is not a fiscal tax receipt."*
- **Audit:** every duplicate print increments the payment receipt print count and adds a `RECEIPT_REPRINTED` audit row with actor, time and receipt number.
- **Status stamps:** duplicate, void and refunded receipts show clear status stamps.

---

## 4. Fallback Procedure: What To Do If The Thermal Printer Fails

If the thermal roll printer jams, runs out of paper rolls, or loses power:

1. **Immediate Customer Reception (Do not delay queue):**
   - Use the **Physical Duplicate Receipt Book** kept in the reception drawer.
   - Handwrite the Ticket Code (`TXX` or `PXX`), Customer First Name, Total UGX, Payment Method, and sign/initial.
   - Give the top slip to the customer.
2. **System Registration:**
   - Complete checkout in the system normally so the ticket code appears on the live queue display and the payment is recorded in the day's cash or Mobile Money ledger.
3. **Post-Fix Reprint:**
   - Once the roll printer is reloaded or restored, open a paid visit in **Manager Visits** (`/manager/visits`), **Reception Visits**, or **Customer History** and choose **Print duplicate receipt** or **Reprint receipt**.
   - The preview stays on screen while the hidden receipt frame prints only the receipt document.
