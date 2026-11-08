-- Canonical, database-backed attendance snapshots and audit action categories.

create or replace view public.staff_presence_today
with (security_invoker = true)
as
with local_day as (
  select (now() at time zone 'Africa/Kampala')::date as business_date
)
select
  u.id as user_id,
  u.location_id,
  u.display_name,
  u.full_name,
  u.role,
  d.business_date,
  case
    when lr.id is not null then 'on_leave'
    when a.clock_out is not null then 'out'
    when coalesce(a.on_break, false) then 'on_break'
    when a.clock_in is not null then 'present'
    else 'not_present'
  end as status,
  a.clock_in,
  a.clock_out,
  a.break_started_at,
  lr.leave_type,
  rota.start_time as scheduled_start_time
from public.app_user u
cross join local_day d
left join lateral (
  select a.*
  from public.attendance a
  where a.staff_user_id = u.id and a.business_date = d.business_date
  order by a.updated_at desc
  limit 1
) a on true
left join lateral (
  select l.id, l.leave_type
  from public.leave_request l
  where l.staff_user_id = u.id
    and l.status = 'approved'
    and l.from_date <= d.business_date
    and l.to_date >= d.business_date
  order by l.created_at desc
  limit 1
) lr on true
left join lateral (
  select r.start_time
  from public.rota_entry r
  where r.staff_user_id = u.id
    and r.weekday = extract(dow from d.business_date)::smallint
    and r.effective_from <= d.business_date
  order by r.effective_from desc
  limit 1
) rota on true
where u.status = 'active'
  and u.role in ('staff', 'receptionist', 'manager', 'hr');

revoke all on public.staff_presence_today from public, anon, authenticated;
grant select on public.staff_presence_today to service_role;

-- This registry is the authoritative mapping for each audit action. Old rows are
-- immutable; views and RLS use the registry to exclude historical miscategories.
create table if not exists public.audit_action_category (
  action text primary key,
  category text not null check (category in (
    'access', 'people', 'customer', 'catalogue', 'operations', 'money'
  ))
);

insert into public.audit_action_category (action, category) values
  ('ACKNOWLEDGE_ALL_REVIEW_ITEMS', 'operations'),
  ('ACKNOWLEDGE_REVIEW_ITEM', 'operations'),
  ('ADD_COMPLIMENTARY_LINE', 'money'),
  ('COMPLIMENTARY_SERVICE', 'money'),
  ('APPOINTMENT_CANCELLED', 'operations'),
  ('APPOINTMENT_CHECKED_IN', 'operations'),
  ('APPOINTMENT_MARKED_LATE', 'operations'),
  ('ATTENDANCE_CORRECTED', 'people'),
  ('BEGIN_CLOSE_DAY', 'operations'),
  ('CANCEL_CLOSING', 'operations'),
  ('CATEGORIES_UPDATED', 'catalogue'),
  ('CHANGE_USER_ROLE', 'people'),
  ('CLIENT_PROFILE_EXPORTED_PDF', 'customer'),
  ('CLOSE_DAY', 'operations'),
  ('CREATE_ACCOUNT', 'people'),
  ('CUSTOMER_MERGE', 'customer'),
  ('CUSTOMER_NAME_CORRECTED', 'customer'),
  ('CUSTOMER_PROFILE_PDF_EXPORTED', 'customer'),
  ('DAY_CLOSE_PREPARATION_SUBMITTED', 'money'),
  ('DEVICE_PAIRED', 'access'),
  ('DEVICE_REVOKED', 'access'),
  ('DISCOUNT_RULE_TOGGLED', 'money'),
  ('EDIT_STAFF_PROFILE', 'people'),
  ('EXPORT_CLIENT_PROFILE', 'customer'),
  ('HR_ACCESS_UPDATED', 'access'),
  ('MANAGER_REVOKE_STAFF', 'access'),
  ('HR_CONFIRM_REVOCATION', 'access'),
  ('HR_REVERSE_REVOCATION', 'access'),
  ('IMAGE_UPDATED', 'catalogue'),
  ('IMPORT_CATALOGUE', 'catalogue'),
  ('LINE_FINISHED', 'operations'),
  ('LINE_FINISHED_ON_BEHALF', 'operations'),
  ('LINE_REASSIGNED', 'operations'),
  ('LINE_STARTED', 'operations'),
  ('LINE_STARTED_ON_BEHALF', 'operations'),
  ('LINE_UNDO_DONE', 'operations'),
  ('LINE_UNDO_START', 'operations'),
  ('MARK_CUSTOMER_PREMIUM', 'customer'),
  ('UNMARK_CUSTOMER_PREMIUM', 'customer'),
  ('OPEN_DAY', 'operations'),
  ('PAPER_VISIT_ENTERED', 'operations'),
  ('PAYMENT_PENDING_FLAGGED', 'money'),
  ('PAYMENT_RECORDED', 'money'),
  ('PAYMENT_REFERENCE_ATTACHED', 'money'),
  ('PAYMENT_REFUNDED', 'money'),
  ('PAYMENT_VOIDED', 'money'),
  ('PRICE_CHANGE', 'catalogue'),
  ('RECEIPT_REPRINTED', 'money'),
  ('REMOVE_STARTED_LINE', 'operations'),
  ('REOPEN_DAY', 'operations'),
  ('RESET_PIN', 'access'),
  ('REVOKE_DEVICE', 'access'),
  ('REVOKE_HR', 'access'),
  ('ROTA_COPIED', 'people'),
  ('ROTA_UPDATED', 'people'),
  ('SERVICE_ADDED', 'catalogue'),
  ('SERVICE_METADATA_UPDATED', 'catalogue'),
  ('SET_STAFF_TARGET', 'operations'),
  ('STAFF_ATTENDANCE_OVERRIDE', 'people'),
  ('STAFF_SKILLS_ASSIGNED', 'people'),
  ('STAFF_STATUS_UPDATE', 'people'),
  ('START_OUT_OF_ORDER', 'operations'),
  ('STYLIST_UNAVAILABLE', 'operations'),
  ('TIMESTAMPS_CORRECTED', 'operations'),
  ('UNDO_CLOSE', 'operations'),
  ('UPDATE_RECEIPT_SETTINGS', 'operations'),
  ('UPDATE_REVIEW_THRESHOLDS', 'operations'),
  ('UPFRONT_PAYMENT_RECORDED', 'money'),
  ('VARIANT_ADDED', 'catalogue'),
  ('VISIT_CANCELLED', 'operations'),
  ('VISIT_CREATED', 'operations'),
  ('VISIT_CREATED_PAYMENT_FIRST', 'operations'),
  ('VISIT_TOTAL_ADJUSTED', 'money'),
  ('WRITE_OFF', 'money'),
  ('APPROVAL_GRANTED', 'money'),
  ('APPROVAL_DECLINED', 'money'),
  ('ENABLED', 'catalogue'),
  ('DISABLED', 'catalogue'),
  ('APPOINT_HR', 'access'),
  ('REPLACE_HR', 'access'),
  ('LEAVE_APPROVED', 'people'),
  ('LEAVE_REJECTED', 'people'),
  ('LEAVE_RECORDED', 'people'),
  ('DEACTIVATE_USER', 'people'),
  ('REACTIVATE_USER', 'people')
on conflict (action) do update set category = excluded.category;

alter table public.audit_action_category enable row level security;
drop policy if exists audit_action_category_read on public.audit_action_category;
create policy audit_action_category_read on public.audit_action_category
  for select using (true);
grant select on public.audit_action_category to authenticated, service_role;

create or replace function public.enforce_audit_action_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_category text;
begin
  select category into expected_category
  from public.audit_action_category
  where action = new.action;

  if expected_category is null then
    raise exception 'Unregistered audit action: %', new.action using errcode = '23514';
  end if;
  -- Category is assigned from the registry so stale application payloads cannot
  -- put a sensitive action into a less restricted category.
  new.category := expected_category::public.audit_category;
  return new;
end;
$$;

drop trigger if exists trg_enforce_audit_action_category on public.audit_log;
create trigger trg_enforce_audit_action_category
before insert on public.audit_log
for each row execute function public.enforce_audit_action_category();

drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
  for select using (
    (select role from public.app_user where id = auth.uid()) in ('owner', 'manager')
    or (
      (select role from public.app_user where id = auth.uid()) = 'hr'
      and exists (
        select 1
        from public.audit_action_category m
        where m.action = audit_log.action
          and m.category::public.audit_category = audit_log.category
          and m.category in ('people', 'access')
      )
    )
  );

create or replace view public.hr_people_access_audit
with (security_invoker = true)
as
select a.id, a.at, a.actor_id, a.actor_role, a.action, a.entity_type,
       a.entity_id, a.reason, a.before, a.after, m.category
from public.audit_log a
join public.audit_action_category m
  on m.action = a.action and m.category::public.audit_category = a.category
where m.category in ('people', 'access');

revoke all on public.hr_people_access_audit from public, anon, authenticated;
grant select on public.hr_people_access_audit to service_role;
