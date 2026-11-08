alter table public.visit
  alter column customer_id drop not null,
  alter column ticket_code drop not null,
  add column if not exists order_code text,
  add column if not exists draft_first_name text,
  add column if not exists draft_phone_e164 text,
  add column if not exists kiosk_phone_input text;

alter table public.visit
  drop constraint if exists visit_customer_or_kiosk_order_check;
alter table public.visit
  add constraint visit_customer_or_kiosk_order_check check (
    (customer_id is not null and ticket_code is not null)
    or (
      created_via = 'desk_tablet'
      and status in ('draft', 'expired', 'cancelled')
      and order_code is not null
      and device_id is not null
      and draft_first_name is not null
      and draft_phone_e164 is not null
      and ticket_code is null
    )
  );

create unique index if not exists visit_business_day_order_code_uidx
  on public.visit (business_day_id, order_code)
  where order_code is not null;

create index if not exists visit_kiosk_pending_created_idx
  on public.visit (device_id, created_at desc)
  where created_via = 'desk_tablet' and status = 'draft';

create table if not exists public.kiosk_device_session (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.device(id) on delete cascade,
  session_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);
alter table public.kiosk_device_session enable row level security;
revoke all on public.kiosk_device_session from public, anon, authenticated;

create table if not exists public.kiosk_order_request (
  id bigserial primary key,
  device_id uuid not null references public.device(id),
  idempotency_key text not null,
  visit_id uuid not null references public.visit(id),
  created_at timestamptz not null default now(),
  unique (device_id, idempotency_key)
);
alter table public.kiosk_order_request enable row level security;
revoke all on public.kiosk_order_request from public, anon, authenticated;

drop policy if exists visit_select on public.visit;
create policy visit_select on public.visit
  for select using (
    (select role from public.app_user where id = auth.uid()) in ('manager', 'receptionist')
    or (
      (select role from public.app_user where id = auth.uid()) = 'owner'
      and not (created_via = 'desk_tablet' and status in ('draft', 'expired', 'cancelled'))
    )
    or (
      (select role from public.app_user where id = auth.uid()) = 'staff'
      and status in ('queued', 'in_service')
    )
  );

drop policy if exists visit_service_select on public.visit_service;
create policy visit_service_select on public.visit_service
  for select using (
    (select role from public.app_user where id = auth.uid()) in ('manager', 'receptionist')
    or staff_user_id = auth.uid()
    or (
      (select role from public.app_user where id = auth.uid()) = 'staff'
      and assignment_mode = 'any'
    )
    or (
      (select role from public.app_user where id = auth.uid()) = 'owner'
      and exists (
        select 1 from public.visit v
        where v.id = visit_service.visit_id
          and not (v.created_via = 'desk_tablet' and v.status in ('draft', 'expired', 'cancelled'))
      )
    )
  );

insert into public.app_setting (location_id, key, value)
select id, 'kiosk_order_expiry_minutes', '20'::jsonb
from public.location
on conflict (location_id, key) do nothing;

create or replace function public.register_kiosk_device_session(
  p_pairing_code text,
  p_session_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_device public.device%rowtype;
  v_session_id uuid;
begin
  if p_pairing_code is null or p_session_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('success', false, 'code', 'INVALID_PAIRING', 'message', 'Enter the pairing code from the manager.');
  end if;

  select * into v_device
  from public.device
  where pairing_code = p_pairing_code
    and kind = 'reception_tablet'
    and revoked_at is null
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'code', 'INVALID_PAIRING', 'message', 'Pairing code is invalid or the tablet has been revoked. Ask a manager for a current code.');
  end if;

  insert into public.kiosk_device_session (device_id, session_hash)
  values (v_device.id, p_session_hash)
  returning id into v_session_id;

  return jsonb_build_object('success', true, 'device_id', v_device.id, 'session_id', v_session_id);
end;
$$;

create or replace function public.create_kiosk_order(
  p_session_hash text,
  p_idempotency_key text,
  p_first_name text,
  p_phone text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_device public.device%rowtype;
  v_day public.business_day%rowtype;
  v_order public.visit%rowtype;
  v_item jsonb;
  v_variant public.service_variant%rowtype;
  v_service_id uuid;
  v_quantity integer;
  v_sequence integer := 0;
  v_i integer;
  v_total bigint := 0;
  v_minutes integer := 0;
  v_phone text;
  v_name text;
  v_code text;
  v_existing_id uuid;
begin
  if p_session_hash is null or p_session_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('success', false, 'code', 'DEVICE_SESSION_REQUIRED', 'message', 'This tablet is not paired. Ask reception to pair it first.');
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 16 or length(p_idempotency_key) > 100 then
    return jsonb_build_object('success', false, 'code', 'INVALID_REQUEST', 'message', 'Please try again.');
  end if;

  select d.* into v_device
  from public.kiosk_device_session s
  join public.device d on d.id = s.device_id
  where s.session_hash = p_session_hash
    and s.expires_at > now()
    and d.kind = 'reception_tablet'
    and d.revoked_at is null;
  if not found then
    return jsonb_build_object('success', false, 'code', 'DEVICE_SESSION_REQUIRED', 'message', 'This tablet session has expired or been revoked. Ask a manager to pair it again.');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_device.id::text), hashtext(p_idempotency_key));
  select r.visit_id into v_existing_id
  from public.kiosk_order_request r
  where r.device_id = v_device.id and r.idempotency_key = p_idempotency_key;
  if v_existing_id is not null then
    select * into v_order from public.visit where id = v_existing_id;
    if v_order.status <> 'draft' then
      return jsonb_build_object('success', false, 'code', 'ORDER_NO_LONGER_PENDING', 'message', 'This order is no longer waiting. Please ask reception for help.');
    end if;
    select coalesce(sum(sv.expected_minutes), 0)::integer into v_minutes
    from public.visit_service vs
    join public.service_variant sv on sv.id = vs.service_variant_id
    where vs.visit_id = v_order.id;
    return jsonb_build_object(
      'success', true, 'visit_id', v_order.id, 'order_code', v_order.order_code,
      'first_name', v_order.draft_first_name, 'phone', v_order.draft_phone_e164,
      'total_ugx', v_order.total_final_ugx, 'wait_minutes', greatest(10, least(45, round(v_minutes * 0.8)::int))
    );
  end if;

  perform pg_advisory_xact_lock(hashtext(v_device.id::text), 0);
  if (
    select count(*) from public.visit
    where device_id = v_device.id
      and created_via = 'desk_tablet'
      and status = 'draft'
      and created_at >= now() - interval '10 minutes'
  ) >= 10 then
    return jsonb_build_object('success', false, 'code', 'RATE_LIMITED', 'message', 'This tablet has too many orders waiting. Please ask reception for help.');
  end if;

  v_name := initcap(regexp_replace(btrim(coalesce(p_first_name, '')), '\s+', ' ', 'g'));
  v_phone := public.normalize_ug_phone(coalesce(p_phone, ''));
  if length(v_name) < 1 or length(v_name) > 80 then
    return jsonb_build_object('success', false, 'code', 'INVALID_NAME', 'message', 'Enter your first name to continue.');
  end if;
  if v_phone !~ '^\+2567[0-9]{8}$' then
    return jsonb_build_object('success', false, 'code', 'INVALID_PHONE', 'message', 'Enter a valid Uganda mobile number.');
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 1 then
    return jsonb_build_object('success', false, 'code', 'EMPTY_CATALOGUE', 'message', 'No services are available right now. Please ask at the reception desk.');
  end if;
  if jsonb_array_length(p_lines) > 20 then
    return jsonb_build_object('success', false, 'code', 'INVALID_REQUEST', 'message', 'Please select fewer services.');
  end if;

  select * into v_day
  from public.business_day
  where location_id = v_device.location_id
    and business_date = (now() at time zone 'Africa/Kampala')::date
    and status = 'open'
  order by opened_at desc
  limit 1;
  if not found then
    return jsonb_build_object('success', false, 'code', 'DAY_CLOSED', 'message', 'We are not taking orders yet. Please ask at the reception desk.');
  end if;

  for v_item in select value from jsonb_array_elements(p_lines) loop
    begin
      v_service_id := (v_item->>'variant_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
    exception when others then
      return jsonb_build_object('success', false, 'code', 'INVALID_REQUEST', 'message', 'Please review the selected services and try again.');
    end;
    if v_quantity is null or v_quantity < 1 or v_quantity > 10 then
      return jsonb_build_object('success', false, 'code', 'INVALID_REQUEST', 'message', 'Please review the selected service quantities.');
    end if;
    select sv.* into v_variant
    from public.service_variant sv
    join public.service s on s.id = sv.service_id
    where sv.id = v_service_id and sv.active and s.active
      and s.location_id = v_device.location_id;
    if not found then
      return jsonb_build_object('success', false, 'code', 'CATALOGUE_CHANGED', 'message', 'One of those services is no longer available. Please choose again.');
    end if;
    v_total := v_total + v_variant.list_price_ugx * v_quantity;
    v_minutes := v_minutes + v_variant.expected_minutes * v_quantity;
  end loop;

  v_code := public.next_ticket_code(v_day.id, 'K');
  insert into public.visit (
    organization_id, location_id, business_day_id, customer_id, status, source,
    entered_via, ticket_code, created_via, device_id, order_code,
    draft_first_name, draft_phone_e164, kiosk_phone_input,
    total_list_ugx, total_discount_ugx, total_final_ugx
  ) values (
    v_device.organization_id, v_device.location_id, v_day.id, null, 'draft', 'walk_in',
    'live', null, 'desk_tablet', v_device.id, v_code,
    v_name, v_phone, p_phone, v_total, 0, v_total
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_lines) loop
    v_service_id := (v_item->>'variant_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    select sv.* into v_variant
    from public.service_variant sv
    join public.service s on s.id = sv.service_id
    where sv.id = v_service_id and sv.active and s.active
      and s.location_id = v_device.location_id;
    for v_i in 1..v_quantity loop
      v_sequence := v_sequence + 1;
      insert into public.visit_service (
        visit_id, service_variant_id, sequence_no, status,
        list_price_ugx, discount_ugx, final_price_ugx,
        assignment_mode, price_source
      ) values (
        v_order.id, v_variant.id, v_sequence, 'blocked',
        v_variant.list_price_ugx, 0, v_variant.list_price_ugx,
        'any', 'catalogue'
      );
    end loop;
  end loop;

  insert into public.kiosk_order_request (device_id, idempotency_key, visit_id)
  values (v_device.id, p_idempotency_key, v_order.id);

  return jsonb_build_object(
    'success', true, 'visit_id', v_order.id, 'order_code', v_code,
    'first_name', v_name, 'phone', v_phone, 'total_ugx', v_total,
    'wait_minutes', greatest(10, least(45, round(v_minutes * 0.8)::int))
  );
end;
$$;

create or replace function public.expire_kiosk_orders()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_expired integer;
begin
  with candidates as (
    select v.id
    from public.visit v
    left join public.app_setting s
      on s.location_id = v.location_id and s.key = 'kiosk_order_expiry_minutes'
    where v.created_via = 'desk_tablet'
      and v.status = 'draft'
      and v.created_at <= now() - make_interval(mins => coalesce((s.value #>> '{}')::integer, 20))
    for update of v skip locked
  ), expired as (
    update public.visit v
      set status = 'expired', updated_at = now()
    from candidates c
    where v.id = c.id
    returning v.id, v.location_id, v.order_code
  )
  insert into public.activity_event (location_id, message, actor_name)
  select location_id, 'Unpaid kiosk order ' || order_code || ' expired', 'System'
  from expired;
  get diagnostics v_expired = row_count;
  return v_expired;
end;
$$;

revoke all on function public.register_kiosk_device_session(text, text) from public, anon, authenticated;
revoke all on function public.create_kiosk_order(text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.expire_kiosk_orders() from public, anon, authenticated;
grant execute on function public.register_kiosk_device_session(text, text) to service_role;
grant execute on function public.create_kiosk_order(text, text, text, text, jsonb) to service_role;
grant execute on function public.expire_kiosk_orders() to service_role;

create extension if not exists pg_cron with schema pg_catalog;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'expire-kiosk-orders') then
      perform cron.unschedule('expire-kiosk-orders');
    end if;
    perform cron.schedule('expire-kiosk-orders', '* * * * *', 'select public.expire_kiosk_orders();');
  end if;
end;
$$;
