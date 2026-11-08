# Deployment Guide (Vercel & Remote Supabase)

This document details deployment of the Salon Management System Prototype to Vercel for the live owner demonstration.

---

## 1. Prerequisites
- Remote Supabase database active (`https://akwxbwhbaeckwmiwsxcf.supabase.co`).
- Vercel account linked to GitHub repository `github.com/ayuen-deng/salon-management-system`.

---

## 2. Environment Variables Configuration (Vercel Project Settings)
In the Vercel Project Dashboard (`Settings -> Environment Variables`), add:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://akwxbwhbaeckwmiwsxcf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<set-from-Supabase-project-api-settings>
SUPABASE_SERVICE_ROLE_KEY=<set-as-a-server-only-deployment-secret>

# Demo & Branding Settings
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
NEXT_PUBLIC_TIMEZONE=Africa/Kampala
NEXT_PUBLIC_DEFAULT_CURRENCY=UGX
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_DEMO_SIMPLE_LOGIN=true
NEXT_PUBLIC_SALON_NAME="Mzuri Unisex Salon"
NEXT_PUBLIC_BRANCH_NAME="Mbarara"

# Integration Placeholders
PAYMENT_PROVIDER=manual
SMS_PROVIDER=noop
EMAIL_PROVIDER=console
PUSH_PROVIDER=stub
TAX_RECEIPT_PROVIDER=stub
```

> **Security Rule**: The service role secret key `SUPABASE_SERVICE_ROLE_KEY` is loaded server-side only in Edge and Route handlers. Only variables prefixed with `NEXT_PUBLIC_*` reach client bundles.

---

## 3. Keep-Alive Cron & Supabase Free Plan Protection
Vercel Crons are declared in [`vercel.json`](file:///c:/Users/PC/Desktop/salon-system/vercel.json):
```json
{
  "crons": [
    {
      "path": "/api/health",
      "schedule": "0 6 * * *"
    }
  ]
}
```
This triggers a daily lightweight query against `public.app_user` through [`/api/health`](file:///c:/Users/PC/Desktop/salon-system/src/app/api/health/route.ts) to reduce the risk of free-tier database pause due to inactivity.

---

## 4. Owner PWA Installation on Mobile
1. Open the deployed URL (e.g. `https://salon-app.vercel.app/login`) in Safari (iOS) or Chrome (Android) on the owner's phone.
2. Tap **Share** -> **Add to Home Screen**.
3. Launching from the home screen opens full-screen in standalone mode without browser URL bars, taking the owner directly to his Kampala dashboard after sign-in.
