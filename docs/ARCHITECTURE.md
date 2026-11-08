# Architectural Blueprint & MVC Layering Guide

## Overview
The system follows a strict Model-View-Controller (MVC) architecture adapted for Next.js App Router and Supabase Postgres.

---

## 1. Golden Architectural Rule
**All business logic, security constraints, and permission controls reside in Postgres (RPC + RLS).**
The application code wraps these guarantees; it never re-implements them or assumes client-side trust.

---

## 2. Directory Layout & Layer Boundaries
```
src/
  app/                      # Thin route shells, layouts, and metadata
    (auth)/login/
    reception/
    desk/
    display/queue/
    staff/
    manager/
    hr/
    owner/
    print/
  modules/                  # Feature modules (Strict MVC inside each)
    catalogue/              # models/, controllers/, views/, index.ts
    customers/
    visits/
    queue/
    payments/
    day/
    people-hr/
    manager/
    dashboard-owner/
    staff-portal/
    paper-entry/
  shared/
    models/                 # Result<T, E>, DomainError, integer UGX money, phone normalizer
    controllers/            # Common guards and mappers
    views/                  # shadcn/ui primitives (Button, Card, utils)
    lib/                    # Supabase clients (typed)
    integrations/           # PaymentProvider, SmsProvider interfaces and stubs
```

---

## 3. Dependency Rules & Enforcement
1. **Unidirectional Flow**: `views -> controllers -> models`.
2. **Encapsulation**: Cross-module imports are only permitted through each module's public `index.ts`. Deep imports into another module's internal directories are strictly prohibited.
3. **Supabase Client Isolation**: The Supabase client is imported **only** within Repositories inside `models/`. Views and Controllers never directly touch the database client.
4. **Automated Verification**: Enforced via [`scripts/check-architecture.mjs`](file:///c:/Users/PC/Desktop/salon-system/scripts/check-architecture.mjs) and run with `npm run check:architecture`.
