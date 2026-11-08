-- Migration 00003: Postgres Stored Procedures (RPCs)
-- Business logic enforcement, optimistic concurrency, and audit trail writing.

-- 1. PHONE NORMALIZATION: accepts 07xx, +2567xx, 2567xx, spaces, dashes
create or replace function normalize_ug_phone(p_phone text)
returns text as $$
declare
  v_clean text;
begin
  if p_phone is null then
    return null;
  end if;
  v_clean := regexp_replace(p_phone, '[^0-9+]', '', 'g');
  if v_clean ~ '^07[0-9]{8}$' then
    return '+256' || substring(v_clean from 2);
  elsif v_clean ~ '^2567[0-9]{8}$' then
    return '+' || v_clean;
  elsif v_clean ~ '^\+2567[0-9]{8}$' then
    return v_clean;
  end if;
  return v_clean;
end;
$$ language plpgsql immutable;

-- 2. TICKET CODE GENERATOR (Atomic, race-free)
create or replace function next_ticket_code(p_business_day_id uuid, p_prefix text default 'A')
returns text as $$
declare
  v_seq int;
begin
  insert into ticket_counter (business_day_id, prefix, next_seq)
  values (p_business_day_id, p_prefix, 2)
  on conflict (business_day_id, prefix)
  do update set next_seq = ticket_counter.next_seq + 1
  returning next_seq - 1 into v_seq;

  return p_prefix || lpad(v_seq::text, 2, '0');
end;
$$ language plpgsql security definer set search_path = public, auth;

-- 3. AUDIT LOGGER HELPER
create or replace function log_audit_event(
  p_actor_id uuid,
  p_actor_role text,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb,
  p_after jsonb,
  p_reason text,
  p_business_day_id uuid,
  p_category audit_category,
  p_device_id uuid default null
)
returns void as $$
begin
  insert into audit_log (
    actor_id, actor_role, device_id, action, entity_type, entity_id,
    before, after, reason, business_day_id, category
  ) values (
    p_actor_id, p_actor_role, p_device_id, p_action, p_entity_type, p_entity_id,
    p_before, p_after, p_reason, p_business_day_id, p_category
  );
end;
$$ language plpgsql security definer set search_path = public, auth;

-- 4. OPEN BUSINESS DAY
create or replace function open_business_day(
  p_location_id uuid,
  p_cash_float bigint default 0,
  p_backdate_time timestamptz default null,
  p_reason text default null
)
returns jsonb as $$
declare
  v_user app_user;
  v_date date;
  v_day_id uuid;
  v_now timestamptz := coalesce(p_backdate_time, now());
begin
  select * into v_user from app_user where id = auth.uid();
  if v_user.role not in ('manager', 'receptionist') then
    return jsonb_build_object('error', 'forbidden', 'message', 'Only manager or receptionist can open the day.');
  end if;

  v_date := (v_now at time zone 'Africa/Kampala')::date;

  if exists (select 1 from business_day where location_id = p_location_id and business_date = v_date and status = 'open') then
    return jsonb_build_object('error', 'conflict', 'message', 'Business day is already open.');
  end if;

  insert into business_day (
    organization_id, location_id, business_date, status, opened_at, opened_by, cash_float
  ) values (
    v_user.organization_id, p_location_id, v_date, 'open', v_now, v_user.id, p_cash_float
  ) returning id into v_day_id;

  perform log_audit_event(
    v_user.id, v_user.role::text, 'OPEN_DAY', 'business_day', v_day_id::text,
    null, jsonb_build_object('status', 'open', 'cash_float', p_cash_float), p_reason,
    v_day_id, 'operations'
  );

  insert into activity_event (location_id, message, actor_name)
  values (p_location_id, v_user.display_name || ' opened the business day', v_user.display_name);

  return jsonb_build_object('success', true, 'business_day_id', v_day_id);
end;
$$ language plpgsql security definer set search_path = public, auth;

-- 5. CLOSE BUSINESS DAY (Two-step: begin_close_day, confirm_close_day, cancel_closing, undo_close)
create or replace function begin_close_day(p_business_day_id uuid)
returns jsonb as $$
declare
  v_user app_user;
  v_open_visits int;
begin
  select * into v_user from app_user where id = auth.uid();
  if v_user.role not in ('manager', 'receptionist') then
    return jsonb_build_object('error', 'forbidden', 'message', 'Insufficient permissions.');
  end if;

  select count(*) into v_open_visits
  from visit
  where business_day_id = p_business_day_id and status in ('queued', 'in_service', 'ready_for_checkout', 'payment_pending');

  update business_day set status = 'closing' where id = p_business_day_id;

  return jsonb_build_object('success', true, 'open_visits_count', v_open_visits);
end;
$$ language plpgsql security definer set search_path = public, auth;

create or replace function cancel_closing(p_business_day_id uuid)
returns jsonb as $$
begin
  update business_day set status = 'open' where id = p_business_day_id and status = 'closing';
  return jsonb_build_object('success', true);
end;
$$ language plpgsql security definer set search_path = public, auth;

create or replace function confirm_close_day(p_business_day_id uuid, p_cash_counted bigint)
returns jsonb as $$
declare
  v_user app_user;
  v_day business_day;
  v_open_visits int;
  v_snapshot jsonb;
begin
  select * into v_user from app_user where id = auth.uid();
  if v_user.role != 'manager' then
    return jsonb_build_object('error', 'forbidden', 'message', 'Only manager can confirm closing of the business day.');
  end if;

  select * into v_day from business_day where id = p_business_day_id;
  if not found or v_day.status not in ('open', 'closing') then
    return jsonb_build_object('error', 'conflict', 'message', 'Day is not in closeable state.');
  end if;

  -- Verify no open visits remain
  select count(*) into v_open_visits
  from visit
  where business_day_id = p_business_day_id and status in ('queued', 'in_service', 'ready_for_checkout');

  if v_open_visits > 0 then
    return jsonb_build_object('error', 'conflict', 'message', 'Cannot close with open visits remaining. Finish or abandon visits first.');
  end if;

  -- Build snapshot
  select jsonb_build_object(
    'business_date', v_day.business_date,
    'total_visits', count(distinct v.id),
    'completed_visits', count(distinct case when v.status = 'closed' or v.status = 'paid' then v.id end),
    'abandoned_visits', count(distinct case when v.status = 'abandoned' then v.id end),
    'total_revenue_ugx', coalesce(sum(p.amount_ugx), 0),
    'cash_counted_ugx', p_cash_counted
  ) into v_snapshot
  from visit v
  left join payment p on p.visit_id = v.id
  where v.business_day_id = p_business_day_id;

  update business_day
  set status = 'closed',
      closed_at = now(),
      closed_by = v_user.id,
      cash_counted = p_cash_counted
  where id = p_business_day_id;

  insert into business_day_snapshot (business_day_id, data)
  values (p_business_day_id, v_snapshot);

  perform log_audit_event(
    v_user.id, v_user.role::text, 'CLOSE_DAY', 'business_day', p_business_day_id::text,
    to_jsonb(v_day), v_snapshot, 'Day confirmed closed', p_business_day_id, 'operations'
  );

  return jsonb_build_object('success', true, 'snapshot', v_snapshot);
end;
$$ language plpgsql security definer set search_path = public, auth;

create or replace function undo_close(p_business_day_id uuid)
returns jsonb as $$
declare
  v_user app_user;
  v_day business_day;
begin
  select * into v_user from app_user where id = auth.uid();
  if v_user.role != 'manager' then
    return jsonb_build_object('error', 'forbidden', 'message', 'Only manager can undo close.');
  end if;

  select * into v_day from business_day where id = p_business_day_id;
  if v_day.status != 'closed' or (now() - v_day.closed_at) > interval '15 minutes' then
    return jsonb_build_object('error', 'conflict', 'message', 'Undo window (15 minutes) expired or day not closed.');
  end if;

  update business_day set status = 'open', closed_at = null, closed_by = null where id = p_business_day_id;
  update business_day_snapshot set superseded_at = now() where business_day_id = p_business_day_id and superseded_at is null;

  perform log_audit_event(
    v_user.id, v_user.role::text, 'UNDO_CLOSE', 'business_day', p_business_day_id::text,
    to_jsonb(v_day), jsonb_build_object('status', 'open'), 'Undo close within grace period', p_business_day_id, 'operations'
  );

  return jsonb_build_object('success', true);
end;
$$ language plpgsql security definer set search_path = public, auth;

-- 6. CONFIRM VISIT (Converts draft into queued visit, stamps ticket code, marks first line ready)
create or replace function confirm_visit(p_visit_id uuid)
returns jsonb as $$
declare
  v_visit visit;
  v_code text;
  v_first_line_id uuid;
begin
  select * into v_visit from visit where id = p_visit_id and status = 'draft';
  if not found then
    return jsonb_build_object('error', 'conflict', 'message', 'Visit not found or already confirmed.');
  end if;

  v_code := next_ticket_code(v_visit.business_day_id, case when v_visit.entered_via = 'paper' then 'P' else 'A' end);

  update visit
  set status = 'queued',
      ticket_code = v_code,
      queued_at = now(),
      updated_at = now()
  where id = p_visit_id;

  -- Mark first sequential service line as ready, others blocked
  select id into v_first_line_id
  from visit_service
  where visit_id = p_visit_id
  order by sequence_no asc
  limit 1;

  if v_first_line_id is not null then
    update visit_service
    set status = 'ready', ready_at = now()
    where id = v_first_line_id;
  end if;

  insert into activity_event (location_id, message)
  values (v_visit.location_id, 'Ticket ' || v_code || ' entered the queue');

  return jsonb_build_object('success', true, 'ticket_code', v_code);
end;
$$ language plpgsql security definer set search_path = public, auth;

-- 7. SERVICE LINE START & FINISH (Releases resource immediately, no hold-and-wait)
create or replace function start_service_line(p_visit_service_id uuid, p_reason text default null)
returns jsonb as $$
declare
  v_user app_user;
  v_line visit_service;
  v_visit visit;
begin
  select * into v_user from app_user where id = auth.uid();
  select * into v_line from visit_service where id = p_visit_service_id;
  select * into v_visit from visit where id = v_line.visit_id;

  if v_line.status != 'ready' then
    return jsonb_build_object('error', 'conflict', 'message', 'Service line is not ready to start.');
  end if;

  -- Staff can start own line; Receptionist/Manager can start on behalf with reason
  if v_user.role = 'staff' and v_line.staff_user_id is not null and v_line.staff_user_id != v_user.id then
    return jsonb_build_object('error', 'forbidden', 'message', 'Cannot start service assigned to another staff member.');
  end if;

  update visit_service
  set status = 'in_progress',
      started_at = now(),
      staff_user_id = coalesce(staff_user_id, v_user.id)
  where id = p_visit_service_id;

  update visit set status = 'in_service', updated_at = now() where id = v_line.visit_id and status = 'queued';

  if p_reason is not null then
    insert into queue_override (visit_service_id, by_user_id, reason_code)
    values (p_visit_service_id, v_user.id, p_reason);
  end if;

  insert into activity_event (location_id, message, actor_name)
  values (v_visit.location_id, v_user.display_name || ' started serving ticket ' || v_visit.ticket_code, v_user.display_name);

  return jsonb_build_object('success', true);
end;
$$ language plpgsql security definer set search_path = public, auth;

create or replace function finish_service_line(p_visit_service_id uuid)
returns jsonb as $$
declare
  v_user app_user;
  v_line visit_service;
  v_visit visit;
  v_next_line_id uuid;
  v_remaining_lines int;
begin
  select * into v_user from app_user where id = auth.uid();
  select * into v_line from visit_service where id = p_visit_service_id;
  select * into v_visit from visit where id = v_line.visit_id;

  if v_line.status != 'in_progress' then
    return jsonb_build_object('error', 'conflict', 'message', 'Line is not in progress.');
  end if;

  -- Complete current line: RELEASES STAFF AND STATION IMMEDIATELY
  update visit_service
  set status = 'done',
      ended_at = now()
  where id = p_visit_service_id;

  -- Check next sequential line
  select id into v_next_line_id
  from visit_service
  where visit_id = v_line.visit_id and sequence_no > v_line.sequence_no and status = 'blocked'
  order by sequence_no asc
  limit 1;

  if v_next_line_id is not null then
    -- Next stage becomes ready; customer moves to "between services"
    update visit_service
    set status = 'ready',
        ready_at = now()
    where id = v_next_line_id;
  else
    -- Check if any other non-done lines exist
    select count(*) into v_remaining_lines
    from visit_service
    where visit_id = v_line.visit_id and status in ('blocked', 'ready', 'in_progress');

    if v_remaining_lines = 0 then
      update visit
      set status = 'ready_for_checkout',
          updated_at = now()
      where id = v_line.visit_id;
    end if;
  end if;

  insert into activity_event (location_id, message)
  values (v_visit.location_id, 'Ticket ' || v_visit.ticket_code || ' finished service stage');

  return jsonb_build_object('success', true, 'next_line_id', v_next_line_id);
end;
$$ language plpgsql security definer set search_path = public, auth;

-- 8. RECORD PAYMENT (Idempotent, append-only, sets confirmation level)
create or replace function record_payment(
  p_visit_id uuid,
  p_method payment_method,
  p_amount_ugx bigint,
  p_provider_reference text,
  p_idempotency_key text,
  p_provider text default 'manual'
)
returns jsonb as $$
declare
  v_user app_user;
  v_visit visit;
  v_existing payment;
  v_level confirmation_level;
  v_paid_total bigint;
  v_payment_id uuid;
begin
  select * into v_user from app_user where id = auth.uid();
  if v_user.role not in ('manager', 'receptionist') then
    return jsonb_build_object('error', 'forbidden', 'message', 'Insufficient permissions to record payment.');
  end if;

  -- Idempotency check
  select * into v_existing from payment where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('success', true, 'payment_id', v_existing.id, 'idempotent_replay', true);
  end if;

  select * into v_visit from visit where id = p_visit_id;
  if not found then
    return jsonb_build_object('error', 'not_found', 'message', 'Visit not found.');
  end if;

  if p_method = 'mobile_money' and (p_provider_reference is null or trim(p_provider_reference) = '') then
    return jsonb_build_object('error', 'validation', 'message', 'Mobile Money reference is mandatory.');
  end if;

  v_level := case when p_method = 'mobile_money' then 'attested'::confirmation_level else 'confirmed_via_provider'::confirmation_level end;

  insert into payment (
    organization_id, location_id, visit_id, business_day_id, method, provider,
    amount_ugx, status, confirmation_level, provider_reference, idempotency_key, recorded_by
  ) values (
    v_visit.organization_id, v_visit.location_id, p_visit_id, v_visit.business_day_id,
    p_method, p_provider, p_amount_ugx, 'confirmed', v_level, p_provider_reference,
    p_idempotency_key, v_user.id
  ) returning id into v_payment_id;

  -- Check if fully paid
  select coalesce(sum(amount_ugx), 0) into v_paid_total from payment where visit_id = p_visit_id;
  if v_paid_total >= v_visit.total_final_ugx then
    update visit set status = 'paid', updated_at = now() where id = p_visit_id;
  end if;

  perform log_audit_event(
    v_user.id, v_user.role::text, 'RECORD_PAYMENT', 'payment', v_payment_id::text,
    null, jsonb_build_object('amount', p_amount_ugx, 'method', p_method, 'reference', p_provider_reference),
    'Payment recorded at checkout', v_visit.business_day_id, 'money'
  );

  return jsonb_build_object('success', true, 'payment_id', v_payment_id, 'is_paid', v_paid_total >= v_visit.total_final_ugx);
end;
$$ language plpgsql security definer set search_path = public, auth;

-- 9. ENTER FROM PAPER (Fallback backfill)
create or replace function enter_from_paper(p_payload jsonb)
returns jsonb as $$
declare
  v_user app_user;
  v_date date;
  v_day_id uuid;
  v_visit_id uuid;
  v_cust_id uuid;
  v_serial text;
  v_code text;
  v_phone text;
  v_first_name text;
  v_lines jsonb;
  v_line jsonb;
  v_total_list bigint := 0;
  v_total_discount bigint := 0;
  v_total_final bigint := 0;
  v_seq int := 1;
begin
  select * into v_user from app_user where id = auth.uid();
  if v_user.role not in ('manager', 'receptionist') then
    return jsonb_build_object('error', 'forbidden', 'message', 'Insufficient permissions.');
  end if;

  v_serial := trim(p_payload->>'paper_serial');
  if v_serial is null or v_serial = '' then
    return jsonb_build_object('error', 'validation', 'message', 'Paper serial number is required.');
  end if;

  if exists (select 1 from visit where location_id = v_user.location_id and paper_serial = v_serial) then
    return jsonb_build_object('error', 'conflict', 'message', 'Paper serial already entered.');
  end if;

  v_date := (p_payload->>'business_date')::date;
  select id into v_day_id from business_day where location_id = v_user.location_id and business_date = v_date;
  if not found then
    -- Create backdated day if missing
    insert into business_day (
      organization_id, location_id, business_date, status, opened_at, opened_by
    ) values (
      v_user.organization_id, v_user.location_id, v_date, 'closed', (v_date || ' 08:00:00 Africa/Kampala')::timestamptz, v_user.id
    ) returning id into v_day_id;
  end if;

  -- Customer lookup or create
  v_phone := normalize_ug_phone(p_payload->>'phone');
  v_first_name := coalesce(p_payload->>'first_name', 'Customer');
  select id into v_cust_id from customer where location_id = v_user.location_id and phone_e164 = v_phone limit 1;
  if not found then
    insert into customer (organization_id, location_id, phone_e164, first_name, created_by)
    values (v_user.organization_id, v_user.location_id, v_phone, v_first_name, v_user.id)
    returning id into v_cust_id;
  end if;

  v_code := next_ticket_code(v_day_id, 'P');

  insert into visit (
    organization_id, location_id, business_day_id, customer_id, status, source,
    entered_via, paper_serial, ticket_code, created_via, total_list_ugx, total_discount_ugx, total_final_ugx
  ) values (
    v_user.organization_id, v_user.location_id, v_day_id, v_cust_id, 'paid', 'walk_in',
    'paper', v_serial, v_code, 'receptionist', 0, 0, 0
  ) returning id into v_visit_id;

  v_lines := p_payload->'lines';
  for v_line in select * from jsonb_array_elements(v_lines)
  loop
    v_total_list := v_total_list + (v_line->>'list_price_ugx')::bigint;
    v_total_discount := v_total_discount + coalesce((v_line->>'discount_ugx')::bigint, 0);

    insert into visit_service (
      visit_id, service_variant_id, staff_user_id, sequence_no, status,
      list_price_ugx, discount_ugx, final_price_ugx, times_source, started_at, ended_at
    ) values (
      v_visit_id, (v_line->>'variant_id')::uuid, (v_line->>'staff_user_id')::uuid, v_seq, 'done',
      (v_line->>'list_price_ugx')::bigint, coalesce((v_line->>'discount_ugx')::bigint, 0),
      (v_line->>'list_price_ugx')::bigint - coalesce((v_line->>'discount_ugx')::bigint, 0),
      'reported', (v_line->>'started_at')::timestamptz, (v_line->>'ended_at')::timestamptz
    );
    v_seq := v_seq + 1;
  end loop;

  v_total_final := v_total_list - v_total_discount;
  update visit
  set total_list_ugx = v_total_list,
      total_discount_ugx = v_total_discount,
      total_final_ugx = v_total_final
  where id = v_visit_id;

  -- Record payment if provided
  if p_payload->>'payment_method' is not null then
    insert into payment (
      organization_id, location_id, visit_id, business_day_id, method, provider,
      amount_ugx, status, confirmation_level, provider_reference, idempotency_key, recorded_by
    ) values (
      v_user.organization_id, v_user.location_id, v_visit_id, v_day_id,
      (p_payload->>'payment_method')::payment_method, 'manual', v_total_final, 'confirmed',
      case when (p_payload->>'payment_method') = 'mobile_money' then 'attested'::confirmation_level else 'confirmed_via_provider'::confirmation_level end,
      p_payload->>'payment_reference', 'PAPER-' || v_serial, v_user.id
    );
  end if;

  perform log_audit_event(
    v_user.id, v_user.role::text, 'ENTER_FROM_PAPER', 'visit', v_visit_id::text,
    null, jsonb_build_object('serial', v_serial, 'code', v_code), 'Paper visit backfilled', v_day_id, 'operations'
  );

  return jsonb_build_object('success', true, 'visit_id', v_visit_id, 'ticket_code', v_code);
end;
$$ language plpgsql security definer set search_path = public, auth;
