# AUDIT REPORT: Design System, Queue Live Sync, Kiosk Media & Dashboard Data

**Project:** Mzuri Unisex Salon (Mbarara, Uganda)  
**Date:** 2026-10-28  
**Scope:** Design tokens (blue & black, Inter sans-serif, sentence case), live queue sync, kiosk photography & category canonicalization, owner dashboard data integrity.

---

### 1. Typography, Monospace & Colour Token Findings
- **Monospace Usage:** Discovered `font-mono`, `ui-monospace`, and tabular-numbers implemented across 58 files (e.g. `owner-dashboard.view.tsx`, `desk-tablet.view.tsx`, `stat-card.tsx`, `login-form.view.tsx`, `queue-display.view.tsx`, `manager-payments.view.tsx`). Numbers, prices ("UGX 125,000"), and labels were set in monospace.
- **Serif Fonts:** `font-serif` was used on the **Mzuri Unisex Salon** wordmark and screen headers across `/login`, `/desk`, `/display/queue`, and `/owner`.
- **Uppercase & Letter Spacing:** Excessive `uppercase` and `tracking-widest` found on chips, categories, table headers, and badges.
- **Bronze / Brown Palette:** Remnants of `#9A7B4F`, `#85683F`, and `#866840` were heavily present across `/login`, `/desk`, `/display/queue`, and staff views.
- **Resolution:**
  - Standardize on single system font: **Inter** (`font-sans`) with `font-variant-numeric: tabular-nums` for tabular alignment.
  - Eliminate all `font-serif`, `font-mono`, and `uppercase` styling.
  - Implement single source of truth color tokens:
    - Primary Blue: `#1F4FD8` (hover `#1A43B8`, tint `#EEF3FF`, ring `#7B9BF0`). On dark surfaces: `#4C7DF5`.
    - Ink / Dark surfaces: near-black `#0A0E14`, charcoal `#111827`.
    - Neutrals: background `#F6F8FB`, surface `#FFFFFF`, border `#E2E7EF`, secondary `#566174`, muted `#8A94A6`.
    - Status: success `#17794F`, warning `#A16207`, danger `#B42318`.

---

### 2. Queue Screen Findings (`/display/queue`)
- **Root Cause of Empty/Discrepant Display:**
  - Visits in remote DB for the active business day had lines in `ready` status, but 0 lines in `in_progress`.
  - Visits with multiple sequence lines did not advance to `in_progress` until staff actively tapped "Start".
  - Pairing requirement check was not surfaced: if a device is unpaired, it silently rendered an empty queue instead of displaying an explicit pairing prompt: *"This screen is not paired. Ask the manager for a pairing code."*
- **Resolution:**
  - Enforce shared view query reading from `queue_board` / live `visit` + `visit_service`.
  - Explicit device pairing check: show friendly pairing instructions if session is unpaired.
  - Update demo seeds to include realistic tickets in all three states: **Now serving**, **Next**, and **Waiting**.
  - Style with near-black `#0A0E14` background, off-white text, `#4C7DF5` highlight for in-service tickets, and sentence case headers.

---

### 3. Kiosk Cards & Categories Findings (`/desk`)
- **Why Cards Showed Grey Placeholders:**
  - The `service` table schema does not have an `image_url` column.
  - Images were stored in `app_setting` under `service_metadata`, but earlier inserts were missing the mandatory `location_id` column, causing them to fail or return empty on fetch.
  - Kiosk was checking `service.image_url` directly on the service row.
- **Duplicate Categories:**
  - DB contains fragmented composite strings like `'men|Barbering|Haircuts'`, `'Barbering'`, `'women|Hair Care|Chemical'`, `'both|Hair care and treatments|Care'`.
  - Parsing logic extracted raw tokens resulting in duplicate chips: `"Barbering"` vs `"Haircuts"`, `"Hair Care"` vs `"Hair care and treatments"`.
- **Resolution:**
  - Persist `service_metadata` with `location_id` and normalize `service_variant` / `service` joins.
  - Consolidate all 35 services into the 9 canonical categories: `Haircuts`, `Hair care and treatments`, `Colour`, `Braids and styling`, `Massage`, `Makeup`, `Nails`, `Skin and facials`, `Brows and lashes`.
  - Filter out categories with 0 services for the chosen audience.

---

### 4. Owner Dashboard Data & Time Integrity Findings
- **"Open since 14:32" and "Last activity 22:05" at 10:53:**
  - The remote DB's active business day was created on `2026-10-04` with `opened_at = 12:04 UTC` (15:04 EAT / 14:32), which is in the past and left unclosed.
  - "Last activity" queried the newest `audit_log` row without checking if the event was from today or a past date.
  - `opened_at` was rendered as a simple time string without date qualification.
- **Misleading "-93% Comparison" in Green:**
  - The comparison compared today's partial day against a full 4-week closed-day average and styled negative differences with `text-emerald-700`.
- **Resolution:**
  - Qualify multi-day open status: `"Open since 4 Oct 15:04 (day left open overnight)"`.
  - Cap last activity to `min(latest_audit_today, now)` and display relative date if past.
  - Directional comparison: negative percentages styled in neutral or `#B42318` danger, never green. Hide comparisons before midday if sample is insufficient.
  - Fix review rows to `"Joan · Manager"` and render orange review badge as neutral/blue pill.

---

### 5. Implementation Plan

- **Phase 1: Unified Design System (Blue & Black, One Sans Font)**
  - Define blue, black, neutral tokens in `globals.css` and `tailwind.config.js`.
  - Configure `Inter` via `next/font` in `layout.tsx`; purge all `font-mono`, `font-serif`, `uppercase`, and bronze hexes.
  - Update `LoginFormView`, `AppShell`, role dashboards, and stat cards.
  - Implement lint/CI token enforcement and Playwright computed-style assertions.
- **Phase 2: Live Queue Screen & Dashboard Time Sanity**
  - Refactor `QueueDisplayView` with 3 columns, live sync, pairing guard, and near-black theme.
  - Fix owner dashboard time logic, date qualifiers, and directional comparison styling.
  - Seed demo scenarios with active in-service, next, and waiting tickets.
- **Phase 3: Image-Led Kiosk & Canonical Categories**
  - Fix `service_metadata` resolution and ensure all 35 services display high-res photography cards.
  - Canonicalize categories and suppress empty categories per audience.
  - Restyle kiosk buttons to `#1F4FD8` blue, black/white surfaces, and sentence case.

Nothing blocks execution. Proceeding to Phase 1.
