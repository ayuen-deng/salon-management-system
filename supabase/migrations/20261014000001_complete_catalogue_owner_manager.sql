-- ==============================================================================
-- Migration: 20261014000001_complete_catalogue_owner_manager.sql
-- Description:
-- 1. Add versioning and audit attribution to service and service_variant
-- 2. Extend price_history with min/max, reason, and changed_by_role
-- 3. Create catalogue_change table for cross-role feed and notifications
-- 4. Update RLS policies to allow both owner and manager write access
-- ==============================================================================

-- 1. Versioning and attribution on service & service_variant
alter table if exists service 
  add column if not exists version int not null default 1,
  add column if not exists created_by uuid references app_user(id),
  add column if not exists created_by_role text default 'manager',
  add column if not exists updated_at timestamptz not null default now();

alter table if exists service_variant 
  add column if not exists version int not null default 1,
  add column if not exists created_by uuid references app_user(id),
  add column if not exists created_by_role text default 'manager',
  add column if not exists updated_at timestamptz not null default now();

-- 2. Extend price_history
alter table if exists price_history 
  add column if not exists old_min_price_ugx bigint,
  add column if not exists new_min_price_ugx bigint,
  add column if not exists old_max_price_ugx bigint,
  add column if not exists new_max_price_ugx bigint,
  add column if not exists reason text,
  add column if not exists changed_by_role text default 'manager';

-- 3. Create catalogue_change table for change feed
create table if not exists catalogue_change (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organization(id) on delete cascade,
  location_id uuid references location(id) on delete cascade,
  entity_type text not null check (entity_type in ('service', 'service_variant')),
  entity_id uuid not null,
  action text not null check (action in ('added', 'edited', 'price_changed', 'disabled', 'enabled')),
  changed_by uuid not null references app_user(id),
  changed_by_role text not null,
  at timestamptz not null default now(),
  summary text not null,
  old_data jsonb,
  new_data jsonb,
  seen_by_manager_at timestamptz
);

create index if not exists idx_catalogue_change_at on catalogue_change(at desc);

-- Enable RLS on catalogue_change
alter table catalogue_change enable row level security;

create policy catalogue_change_read on catalogue_change
  for select using ((select role from app_user where id = auth.uid()) in ('owner', 'manager'));

create policy catalogue_change_manage on catalogue_change
  for all using ((select role from app_user where id = auth.uid()) in ('owner', 'manager'));

-- 4. Update RLS policies on service & service_variant for Owner + Manager
drop policy if exists service_manage on service;
create policy service_manage on service
  for all using ((select role from app_user where id = auth.uid()) in ('owner', 'manager'));

drop policy if exists variant_manage on service_variant;
create policy variant_manage on service_variant
  for all using ((select role from app_user where id = auth.uid()) in ('owner', 'manager'));

drop policy if exists price_history_manage on price_history;
create policy price_history_manage on price_history
  for all using ((select role from app_user where id = auth.uid()) in ('owner', 'manager'));

-- Ensure Realtime publication includes catalogue tables
do $$
begin
  alter publication supabase_realtime add table service;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table service_variant;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table catalogue_change;
exception when others then null;
end $$;
