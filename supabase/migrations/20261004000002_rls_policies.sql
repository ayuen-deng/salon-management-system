-- Migration 00002: Row Level Security (RLS) Policies
-- Enforces the permission matrix in Section 7 of the Walkthrough exactly.

-- 1. ENABLE RLS ON ALL TABLES
alter table organization enable row level security;
alter table location enable row level security;
alter table app_user enable row level security;
alter table device enable row level security;
alter table attendance enable row level security;
alter table leave_request enable row level security;
alter table rota_entry enable row level security;
alter table service enable row level security;
alter table service_variant enable row level security;
alter table price_history enable row level security;
alter table staff_skill enable row level security;
alter table discount_reason enable row level security;
alter table customer enable row level security;
alter table business_day enable row level security;
alter table business_day_snapshot enable row level security;
alter table ticket_counter enable row level security;
alter table appointment enable row level security;
alter table desk_session enable row level security;
alter table visit enable row level security;
alter table visit_service enable row level security;
alter table queue_override enable row level security;
alter table approval_request enable row level security;
alter table discount enable row level security;
alter table payment enable row level security;
alter table payment_adjustment enable row level security;
alter table statement_import enable row level security;
alter table reconciliation_entry enable row level security;
alter table audit_log enable row level security;
alter table activity_event enable row level security;
alter table notification enable row level security;
alter table webhook_event enable row level security;
alter table app_setting enable row level security;
alter table daily_summary enable row level security;

-- Default deny: policies will grant explicit access.

-- 3. ORGANIZATIONAL POLICIES
create policy org_access on organization
  for select using (
    exists (select 1 from app_user where app_user.organization_id = organization.id and app_user.id = auth.uid())
  );

create policy loc_access on location
  for select using (
    exists (select 1 from app_user where app_user.location_id = location.id and app_user.id = auth.uid())
  );

-- 4. APP_USER POLICIES
create policy app_user_select on app_user
  for select using (
    (select role from app_user where id = auth.uid()) in ('owner', 'manager', 'hr')
    or id = auth.uid()
  );

create policy app_user_hr_manage on app_user
  for all using (
    (select role from app_user where id = auth.uid()) = 'hr'
  );

-- 5. ATTENDANCE & LEAVE (HR & Manager & Staff Own)
create policy attendance_select on attendance
  for select using (
    (select role from app_user where id = auth.uid()) in ('owner', 'manager', 'hr')
    or staff_user_id = auth.uid()
  );

create policy attendance_staff_manage on attendance
  for insert with check (staff_user_id = auth.uid());

create policy attendance_hr_manager on attendance
  for update using (
    (select role from app_user where id = auth.uid()) in ('manager', 'hr')
  );

create policy leave_select on leave_request
  for select using (
    (select role from app_user where id = auth.uid()) in ('owner', 'manager', 'hr')
    or staff_user_id = auth.uid()
  );

create policy leave_manage on leave_request
  for all using (
    (select role from app_user where id = auth.uid()) in ('manager', 'hr')
    or staff_user_id = auth.uid()
  );

create policy rota_select on rota_entry
  for select using (
    (select role from app_user where id = auth.uid()) in ('owner', 'manager', 'hr', 'receptionist', 'staff')
  );

create policy rota_manage on rota_entry
  for all using (
    (select role from app_user where id = auth.uid()) in ('manager', 'hr')
  );

-- 6. CATALOGUE & SERVICES (Publicly readable, Manager writable, HR has NO write)
create policy service_read on service
  for select using (true);

create policy service_manage on service
  for all using ((select role from app_user where id = auth.uid()) = 'manager');

create policy variant_read on service_variant
  for select using (true);

create policy variant_manage on service_variant
  for all using ((select role from app_user where id = auth.uid()) = 'manager');

create policy price_history_read on price_history
  for select using ((select role from app_user where id = auth.uid()) in ('owner', 'manager'));

create policy staff_skill_read on staff_skill
  for select using (true);

create policy staff_skill_manage on staff_skill
  for all using ((select role from app_user where id = auth.uid()) in ('manager', 'hr'));

create policy discount_reason_read on discount_reason
  for select using (true);

-- 7. CUSTOMERS (HR HAS ZERO ACCESS, STAFF ZERO ACCESS, ONLY RECEPTION/MANAGER/OWNER)
create policy customer_select on customer
  for select using (
    (select role from app_user where id = auth.uid()) in ('owner', 'manager', 'receptionist')
  );

create policy customer_manage on customer
  for insert with check (
    (select role from app_user where id = auth.uid()) in ('manager', 'receptionist')
  );

create policy customer_update on customer
  for update using (
    (select role from app_user where id = auth.uid()) in ('manager', 'receptionist')
  );

-- 8. BUSINESS DAY & SNAPSHOTS (HR HAS NO ACCESS)
create policy business_day_select on business_day
  for select using (
    (select role from app_user where id = auth.uid()) in ('owner', 'manager', 'receptionist', 'staff')
  );

create policy business_day_manage on business_day
  for all using (
    (select role from app_user where id = auth.uid()) in ('manager', 'receptionist')
  );

create policy business_day_snapshot_select on business_day_snapshot
  for select using (
    (select role from app_user where id = auth.uid()) in ('owner', 'manager')
  );

-- 9. VISITS & SERVICE LINES (HR HAS NO ACCESS)
create policy visit_select on visit
  for select using (
    (select role from app_user where id = auth.uid()) in ('owner', 'manager', 'receptionist')
    or ((select role from app_user where id = auth.uid()) = 'staff' and status in ('queued', 'in_service'))
  );

create policy visit_manage on visit
  for all using (
    (select role from app_user where id = auth.uid()) in ('manager', 'receptionist')
  );

create policy visit_service_select on visit_service
  for select using (
    (select role from app_user where id = auth.uid()) in ('owner', 'manager', 'receptionist')
    or staff_user_id = auth.uid()
    or ((select role from app_user where id = auth.uid()) = 'staff' and assignment_mode = 'any')
  );

create policy visit_service_manage on visit_service
  for all using (
    (select role from app_user where id = auth.uid()) in ('manager', 'receptionist')
    or staff_user_id = auth.uid()
  );

-- 10. PAYMENTS & FINANCIALS (HR AND STAFF HAVE ZERO ACCESS)
create policy payment_select on payment
  for select using (
    (select role from app_user where id = auth.uid()) in ('owner', 'manager', 'receptionist')
  );

create policy payment_insert on payment
  for insert with check (
    (select role from app_user where id = auth.uid()) in ('manager', 'receptionist')
  );

create policy payment_adj_select on payment_adjustment
  for select using (
    (select role from app_user where id = auth.uid()) in ('owner', 'manager')
  );

create policy payment_adj_manage on payment_adjustment
  for all using (
    (select role from app_user where id = auth.uid()) = 'manager'
  );

create policy recon_select on reconciliation_entry
  for select using (
    (select role from app_user where id = auth.uid()) in ('owner', 'manager')
  );

create policy recon_manage on reconciliation_entry
  for all using (
    (select role from app_user where id = auth.uid()) = 'manager'
  );

create policy statement_import_manage on statement_import
  for all using (
    (select role from app_user where id = auth.uid()) = 'manager'
  );

-- 11. AUDIT LOG (READ ONLY, SCOPED BY ROLE)
create policy audit_log_select on audit_log
  for select using (
    (select role from app_user where id = auth.uid()) in ('owner', 'manager')
    or (
      (select role from app_user where id = auth.uid()) = 'hr'
      and category in ('people', 'access')
    )
  );

-- 12. APP SETTINGS & DAILY SUMMARY
create policy app_setting_select on app_setting
  for select using (true);

create policy app_setting_manage on app_setting
  for all using (
    (select role from app_user where id = auth.uid()) in ('owner', 'manager')
  );

create policy daily_summary_select on daily_summary
  for select using (
    (select role from app_user where id = auth.uid()) in ('owner', 'manager', 'hr')
  );
