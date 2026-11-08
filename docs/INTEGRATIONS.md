# Third-Party Integrations Policy & Architecture

**Project:** Salon Management System (Kembabazi Unisex Salon, Mbarara)  
**Spec of Record:** `docs/salon_operations_walkthrough.pdf` & prompt override specifications.

---

## 1. Integrations Status Overview

In accordance with prototype revisions, **all cosmetic Third-Party Integration Status Panels have been removed** from user-facing screens (Owner Dashboard, Owner Settings, and Manager Portal). The application presents only honest, working behaviours directly within normal transactional screens.

| Subsystem | Status | Honest Behaviour |
| :--- | :--- | :--- |
| **Mobile Money (MTN / Airtel)** | Statement Reconciled | Receptionist enters transaction reference provided by customer; payment recorded with status `attested`. Verified against uploaded CSV merchant statement at morning reconciliation. |
| **SMS** | **Dormant / Removed** | Customer SMS flows have been completely removed from the product per prompt instructions. Phone numbers are stored solely for visit history. No SMS messages are sent or simulated. `SmsProvider` interface remains in `src/shared/integrations/sms.provider.ts` as dormant code only. |
| **Email** | Direct Access | Reports are viewed live in-app by the Owner via the Kampala remote monitor. Automated SMTP is dormant. |
| **URA EFRIS** | Disclaimed | Receipts carry the notice *"This is not a fiscal tax receipt"*. No claims of URA/EFRIS integration. |
| **Receipt Printing** | Browser Print | Standard browser print flow at `/print/receipt/[visitId]` using standard 80mm roll and A5 print stylesheets. No direct ESC/POS hardware daemon required. |

---

## 2. Dormant Code Architecture

The `SmsProvider` and `NoopSmsProvider` in `src/shared/integrations/sms.provider.ts` are retained strictly as decoupled, dormant interfaces:
- No user-facing flows (tablet check-in, receptionist desk, checkout, owner views) invoke or depend on them.
- Customer consent fields (`sms_consent`, `consent_at`) have been dropped from the database schema.
