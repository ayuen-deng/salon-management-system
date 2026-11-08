-- Migration 00001: Tenancy, Roles, People, Catalogue, Customers, Visits, Payments, Auditing
-- Computations in Africa/Kampala time, money stored as integer UGX, timestamps in UTC

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. ENUMS
do $$ begin
  create type app_role as enum ('owner', 'manager', 'hr', 'receptionist', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type device_kind as enum ('reception_tablet', 'queue_screen');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_absence_type as enum ('none', 'approved_leave', 'unapproved_absence', 'off_duty');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_request_status as enum ('requested', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type business_day_status as enum ('open', 'closing', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appointment_status as enum ('booked', 'arrived', 'no_show', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type desk_mode as enum ('menu', 'select', 'confirm');
exception when duplicate_object then null; end $$;

do $$ begin
  create type visit_status as enum (
    'draft', 'queued', 'in_service', 'ready_for_checkout', 'payment_pending', 'paid', 'closed', 'cancelled', 'abandoned'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type visit_source as enum ('walk_in', 'appointment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type entry_method as enum ('live', 'paper');
exception when duplicate_object then null; end $$;

do $$ begin
  create type creation_surface as enum ('receptionist', 'desk_tablet');
exception when duplicate_object then null; end $$;

do $$ begin
  create type service_line_status as enum ('blocked', 'ready', 'in_progress', 'done', 'cancelled', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assignment_mode as enum ('strict', 'any');
exception when duplicate_object then null; end $$;

do $$ begin
  create type price_source_type as enum ('catalogue', 'custom', 'complimentary');
exception when duplicate_object then null; end $$;

do $$ begin
  create type times_source_type as enum ('measured', 'reported', 'corrected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type discount_kind as enum ('fixed', 'percent', 'complimentary');
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_status as enum ('pending', 'approved', 'declined');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('cash', 'mobile_money');
exception when duplicate_object then null; end $$;

do $$ begin
  create type confirmation_level as enum ('attested', 'confirmed_via_provider', 'reconciled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type adjustment_type as enum ('void', 'refund', 'overpayment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type audit_category as enum ('people', 'money', 'customer', 'catalogue', 'operations', 'access');
exception when duplicate_object then null; end $$;

-- 3. TENANCY & LOCATIONS
create table if not exists organization (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists location (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  name text not null,
  timezone text not null default 'Africa/Kampala',
  opening_hours jsonb not null default '{"open": "08:00", "close": "20:00"}'::jsonb,
  created_at timestamptz not null default now()
);

-- 4. USERS & PROFILES
create table if not exists app_user (
  id uuid primary key, -- references auth.users(id)
  organization_id uuid not null references organization(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  full_name text not null,
  display_name text not null,
  phone text not null,
  role app_role not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  pin_hash text,
  pin_attempts int not null default 0,
  start_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists device (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  kind device_kind not null,
  name text not null,
  pairing_code text,
  device_token text unique,
  paired_by uuid references app_user(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- 5. ATTENDANCE, LEAVE, ROTA
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  staff_user_id uuid not null references app_user(id) on delete cascade,
  business_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  on_break boolean not null default false,
  break_started_at timestamptz,
  absence_type attendance_absence_type not null default 'none',
  corrected_by uuid references app_user(id),
  corrected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists leave_request (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  staff_user_id uuid not null references app_user(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  leave_type text not null check (leave_type in ('approved_leave', 'off_duty')),
  status leave_request_status not null default 'requested',
  requested_by uuid not null references app_user(id),
  decided_by uuid references app_user(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists rota_entry (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  staff_user_id uuid not null references app_user(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0=Sunday, 1=Monday
  start_time time not null,
  end_time time not null,
  effective_from date not null default current_date
);

-- 6. CATALOGUE & SKILLS
create table if not exists service (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  name text not null,
  category text not null,
  active boolean not null default true,
  default_minutes int not null check (default_minutes > 0),
  created_at timestamptz not null default now()
);

create table if not exists service_variant (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references service(id) on delete cascade,
  name text not null,
  list_price_ugx bigint not null check (list_price_ugx >= 0),
  min_price_ugx bigint not null check (min_price_ugx >= 0),
  max_price_ugx bigint not null check (max_price_ugx >= min_price_ugx),
  expected_minutes int not null check (expected_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists price_history (
  id uuid primary key default gen_random_uuid(),
  service_variant_id uuid not null references service_variant(id) on delete cascade,
  old_price_ugx bigint not null,
  new_price_ugx bigint not null,
  changed_by uuid not null references app_user(id),
  changed_at timestamptz not null default now()
);

create table if not exists staff_skill (
  staff_user_id uuid not null references app_user(id) on delete cascade,
  service_id uuid not null references service(id) on delete cascade,
  primary key (staff_user_id, service_id)
);

create table if not exists discount_reason (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  code text not null,
  label text not null,
  active boolean not null default true
);

-- 7. CUSTOMERS
create table if not exists customer (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  phone_e164 text not null,
  first_name text not null,
  sms_consent boolean not null default false,
  consent_at timestamptz,
  merged_into uuid references customer(id),
  created_by uuid references app_user(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customer_phone on customer(phone_e164);

-- 8. BUSINESS DAY & SNAPSHOTS
create table if not exists business_day (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  business_date date not null,
  status business_day_status not null default 'open',
  opened_at timestamptz not null default now(),
  opened_by uuid not null references app_user(id),
  closed_at timestamptz,
  closed_by uuid references app_user(id),
  auto_closed boolean not null default false,
  expected_open time not null default '08:00',
  expected_close time not null default '20:00',
  cash_float bigint not null default 0,
  cash_counted bigint,
  created_at timestamptz not null default now(),
  unique (location_id, business_date)
);

create table if not exists business_day_snapshot (
  id uuid primary key default gen_random_uuid(),
  business_day_id uuid not null references business_day(id) on delete cascade,
  data jsonb not null,
  taken_at timestamptz not null default now(),
  superseded_at timestamptz
);

create table if not exists ticket_counter (
  business_day_id uuid not null references business_day(id) on delete cascade,
  prefix text not null, -- 'A' for digital, 'P' for paper
  next_seq int not null default 1,
  primary key (business_day_id, prefix)
);

-- 9. APPOINTMENTS & DESK SESSIONS
create table if not exists appointment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  customer_id uuid not null references customer(id) on delete cascade,
  staff_user_id uuid references app_user(id),
  service_id uuid references service(id),
  starts_at timestamptz not null,
  expected_minutes int not null,
  status appointment_status not null default 'booked',
  late boolean not null default false,
  visit_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists desk_session (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  tablet_device_id uuid not null references device(id),
  receptionist_user_id uuid not null references app_user(id),
  mode desk_mode not null default 'menu',
  draft jsonb not null default '{}'::jsonb,
  pushed_category text,
  updated_at timestamptz not null default now()
);

-- 10. VISITS & SERVICE LINES
create table if not exists visit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  business_day_id uuid not null references business_day(id),
  customer_id uuid not null references customer(id),
  status visit_status not null default 'draft',
  source visit_source not null default 'walk_in',
  entered_via entry_method not null default 'live',
  paper_serial text,
  ticket_code text not null,
  queued_at timestamptz,
  created_via creation_surface not null default 'receptionist',
  device_id uuid references device(id),
  total_list_ugx bigint not null default 0,
  total_discount_ugx bigint not null default 0,
  total_final_ugx bigint not null default 0,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_visit_totals check (total_final_ugx = total_list_ugx - total_discount_ugx and total_final_ugx >= 0)
);
create unique index if not exists idx_visit_paper_serial on visit (location_id, paper_serial) where paper_serial is not null;
create index if not exists idx_visit_lookup on visit(location_id, business_day_id, status);
create index if not exists idx_visit_queued_at on visit(queued_at);

create table if not exists visit_service (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visit(id) on delete cascade,
  service_variant_id uuid not null references service_variant(id),
  staff_user_id uuid references app_user(id),
  preferred_staff_id uuid references app_user(id),
  assignment_mode assignment_mode not null default 'any',
  sequence_no int not null default 1,
  status service_line_status not null default 'blocked',
  list_price_ugx bigint not null check (list_price_ugx >= 0),
  discount_ugx bigint not null default 0 check (discount_ugx >= 0),
  final_price_ugx bigint not null check (final_price_ugx >= 0),
  price_source price_source_type not null default 'catalogue',
  ready_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  times_source times_source_type not null default 'measured',
  created_at timestamptz not null default now(),
  constraint chk_service_prices check (final_price_ugx = list_price_ugx - discount_ugx)
);
create index if not exists idx_visit_service_queue on visit_service(status, ready_at);

create table if not exists queue_override (
  id uuid primary key default gen_random_uuid(),
  visit_service_id uuid not null references visit_service(id) on delete cascade,
  by_user_id uuid not null references app_user(id),
  reason_code text not null,
  created_at timestamptz not null default now()
);

-- 11. MONEY, APPROVALS & PAYMENTS
create table if not exists approval_request (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  kind text not null, -- 'discount', 'adjustment', 'reopen'
  payload jsonb not null,
  requested_by uuid not null references app_user(id),
  status approval_status not null default 'pending',
  decided_by uuid references app_user(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists discount (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visit(id) on delete cascade,
  visit_service_id uuid references visit_service(id) on delete cascade,
  kind discount_kind not null,
  amount_ugx bigint not null check (amount_ugx >= 0),
  reason_code text not null,
  applied_by uuid not null references app_user(id),
  approved_by uuid references app_user(id),
  created_at timestamptz not null default now()
);

create table if not exists payment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  visit_id uuid not null references visit(id),
  business_day_id uuid not null references business_day(id),
  method payment_method not null,
  provider text not null default 'manual',
  amount_ugx bigint not null check (amount_ugx > 0),
  status text not null default 'confirmed',
  confirmation_level confirmation_level not null default 'attested',
  provider_reference text,
  idempotency_key text unique not null,
  recorded_by uuid not null references app_user(id),
  raw_payload jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists idx_payment_ref on payment(provider_reference);

create table if not exists payment_adjustment (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payment(id),
  adjustment_type adjustment_type not null,
  amount_ugx bigint not null check (amount_ugx > 0),
  reason_code text not null,
  approved_by uuid not null references app_user(id),
  created_at timestamptz not null default now()
);

create table if not exists statement_import (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  provider text not null,
  imported_by uuid not null references app_user(id),
  total_records int not null,
  total_ugx bigint not null,
  imported_at timestamptz not null default now()
);

create table if not exists reconciliation_entry (
  id uuid primary key default gen_random_uuid(),
  statement_import_id uuid not null references statement_import(id) on delete cascade,
  reference text not null,
  amount_ugx bigint not null,
  matched_payment_id uuid references payment(id),
  status text not null default 'unmatched' check (status in ('unmatched', 'matched', 'written_off')),
  written_off_by uuid references app_user(id),
  write_off_reason text,
  reconciled_at timestamptz
);

-- 12. AUDIT LOG & OBSERVABILITY (APPEND ONLY)
create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_id uuid references app_user(id),
  actor_role text not null,
  device_id uuid references device(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before jsonb,
  after jsonb,
  reason text,
  business_day_id uuid references business_day(id),
  category audit_category not null
);
create index if not exists idx_audit_log_at_cat on audit_log(at desc, category);

-- Trigger to enforce append-only nature of audit_log
create or replace function protect_audit_log()
returns trigger as $$
begin
  raise exception 'audit_log is append-only. UPDATE or DELETE operations are strictly prohibited.';
end;
$$ language plpgsql;

drop trigger if exists trg_protect_audit_log on audit_log;
create trigger trg_protect_audit_log
before update or delete on audit_log
for each row execute function protect_audit_log();

-- Trigger to protect payment table from update/delete (append-only)
create or replace function protect_payment()
returns trigger as $$
begin
  raise exception 'payment records are immutable. Corrections must be made via payment_adjustment rows.';
end;
$$ language plpgsql;

drop trigger if exists trg_protect_payment on payment;
create trigger trg_protect_payment
before update or delete on payment
for each row execute function protect_payment();

create table if not exists activity_event (
  id bigserial primary key,
  location_id uuid not null references location(id) on delete cascade,
  message text not null,
  actor_name text,
  entity_link text,
  created_at timestamptz not null default now()
);

create table if not exists notification (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('sms', 'email', 'push')),
  recipient text not null,
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider text not null,
  created_at timestamptz not null default now()
);

create table if not exists webhook_event (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text unique not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed'))
);

create table if not exists app_setting (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references location(id) on delete cascade,
  key text not null,
  value jsonb not null,
  unique (location_id, key)
);

create table if not exists daily_summary (
  id uuid primary key default gen_random_uuid(),
  business_day_id uuid not null references business_day(id) on delete cascade,
  data jsonb not null,
  version int not null default 1,
  generated_at timestamptz not null default now()
);
