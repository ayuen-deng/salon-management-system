# Salon Management System Prototype (Mbarara, Uganda)

A unisex salon management prototype built with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui primitives, and Supabase Postgres.

---

## Quick Start

### 1. Installation & Environment
Ensure Node.js (v20+) is installed.

```bash
# Install dependencies
npm install

# Check architecture boundaries
npm run check:architecture

# Run unit tests
npm run test

# Build for production
npm run build

# Start development server
npm run dev
```

Navigate to `http://localhost:3000` to access the surface switcher.

---

## Role Surfaces
- `/reception` - Receptionist desk: customer lookup, service basket builder, live queue, checkout.
- `/desk` - Customer tablet: Menu, Select, and Confirm modes with large font read-back.
- `/display/queue` - Waiting lounge TV display: high-visibility Now Serving and Waiting tickets.
- `/staff` - Stylist mobile portal: Attendance selector, current task, Start/Done actions.
- `/manager` - Manager operational portal: Approvals inbox, statement reconciliation, two-step day closing.
- `/hr` - HR management: Staff accounts and weekly rota (isolated from financials).
- `/owner` - Kampala owner dashboard: Realtime revenue split, floor presence, review queue.
- `/print` - Printable paper forms for offline outages (Appendix A).

---

## Documentation
- [`docs/ARCHITECTURE.md`](file:///c:/Users/PC/Desktop/salon-system/docs/ARCHITECTURE.md) - MVC layout, dependency rules, and database-level enforcement.
- [`docs/DEMO.md`](file:///c:/Users/PC/Desktop/salon-system/docs/DEMO.md) - Step-by-step walkthrough demo script (Aisha's Saturday journey).
- [`docs/VERIFICATION.md`](file:///c:/Users/PC/Desktop/salon-system/docs/VERIFICATION.md) - Traceability matrix mapping requirements to files, RPCs, and tests.
- [`docs/MIGRATIONS_GUIDE.md`](file:///c:/Users/PC/Desktop/salon-system/docs/MIGRATIONS_GUIDE.md) - Supabase migrations execution guide.
