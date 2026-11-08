-- Migration: Drop SMS columns, add review_ack table, and add HR control RPCs
-- Date: 2026-10-07

-- 1. Drop SMS consent columns from customer (reversible)
alter table if exists customer drop column if exists sms_consent;
alter table if exists customer drop column if exists consent_at;

-- 2. Create review_ack table for owner review item tracking
create table if not exists review_ack (
  id uuid primary key default gen_random_uuid(),
  audit_id bigint not null references audit_log(id) on delete cascade,
  owner_user_id uuid not null references app_user(id),
  seen_at timestamptz not null default now(),
  constraint uq_review_ack_audit_owner unique (audit_id, owner_user_id)
);

alter table review_ack enable row level security;

create policy review_ack_owner_select on review_ack
  for select using (
    (select role from app_user where id = auth.uid()) = 'owner'
    or auth.uid() = owner_user_id
  );

create policy review_ack_owner_insert on review_ack
  for insert with check (
    (select role from app_user where id = auth.uid()) = 'owner'
    or auth.uid() = owner_user_id
  );

-- 3. Partial unique index to enforce exactly ONE active HR per location
create unique index if not exists uq_active_hr_per_location
  on app_user (location_id)
  where (role = 'hr' and status = 'active');

-- 4. Function: owner_appoint_hr (Appoints or replaces the HR user atomically)
create or replace function owner_appoint_hr(
  p_location_id uuid,
  p_full_name text,
  p_phone_e164 text,
  p_username text,
  p_pin text,
  p_owner_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_old_hr_id uuid;
  v_new_hr_id uuid;
  v_owner_role user_role;
begin
  -- Validate caller is owner
  select role into v_owner_role from app_user where id = p_owner_id;
  if v_owner_role is null or v_owner_role != 'owner' then
    raise exception 'Unauthorized: Only the salon owner can appoint or replace HR.';
  end if;

  -- Deactivate any existing active HR at this location
  update app_user
  set status = 'inactive'
  where location_id = p_location_id
    and role = 'hr'
    and status = 'active'
  returning id into v_old_hr_id;

  -- Create new HR app_user
  insert into app_user (
    location_id,
    phone_e164,
    full_name,
    display_name,
    role,
    status,
    username,
    pin_hash
  ) values (
    p_location_id,
    p_phone_e164,
    p_full_name,
    p_full_name,
    'hr',
    'active',
    p_username,
    crypt(p_pin, gen_salt('bf'))
  )
  returning id into v_new_hr_id;

  -- Audit log: appointment
  insert into audit_log (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    reason,
    category,
    before,
    after
  ) values (
    p_owner_id,
    'owner',
    'APPOINT_HR',
    'app_user',
    v_new_hr_id::text,
    case when v_old_hr_id is not null then 'Owner replaced active HR administrator' else 'Owner appointed new HR administrator' end,
    'access',
    case when v_old_hr_id is not null then jsonb_build_object('replaced_hr_id', v_old_hr_id) else '{}'::jsonb end,
    jsonb_build_object('new_hr_id', v_new_hr_id, 'full_name', p_full_name, 'username', p_username)
  );

  return jsonb_build_object(
    'success', true,
    'new_hr_id', v_new_hr_id,
    'replaced_hr_id', v_old_hr_id
  );
end;
$$;

-- 5. Function: owner_revoke_hr (Deactivates active HR)
create or replace function owner_revoke_hr(
  p_location_id uuid,
  p_owner_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_revoked_id uuid;
  v_owner_role user_role;
begin
  select role into v_owner_role from app_user where id = p_owner_id;
  if v_owner_role is null or v_owner_role != 'owner' then
    raise exception 'Unauthorized: Only the salon owner can revoke HR.';
  end if;

  update app_user
  set status = 'inactive'
  where location_id = p_location_id
    and role = 'hr'
    and status = 'active'
  returning id into v_revoked_id;

  if v_revoked_id is not null then
    insert into audit_log (
      actor_id,
      actor_role,
      action,
      entity_type,
      entity_id,
      reason,
      category,
      before,
      after
    ) values (
      p_owner_id,
      'owner',
      'REVOKE_HR',
      'app_user',
      v_revoked_id::text,
      'Owner revoked HR administrator access from Kampala monitor',
      'access',
      jsonb_build_object('revoked_hr_id', v_revoked_id),
      jsonb_build_object('status', 'inactive')
    );
  end if;

  return jsonb_build_object('success', true, 'revoked_id', v_revoked_id);
end;
$$;
