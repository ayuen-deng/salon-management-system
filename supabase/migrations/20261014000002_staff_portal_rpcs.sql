-- Migration: Staff Portal Narrow RPCs, Pool Dispatch, and Sequence Enforcements
-- Strictly enforces permissions and privacy for the Staff role (Kembabazi Unisex Salon).

-- 1. Helper function to check if staff member is currently clocked in
create or replace function public.is_staff_clocked_in(p_staff_id uuid, p_date date default current_date)
returns boolean
language plpgsql
security definer
as $$
declare
  v_in boolean := false;
begin
  select exists (
    select 1 from public.attendance
    where staff_user_id = p_staff_id
      and business_date = p_date
      and clock_in is not null
      and clock_out is null
      and on_break = false
  ) into v_in;
  return v_in;
end;
$$;

-- 2. Secure RPC: staff_my_queue
-- Exposes ONLY ticket code, customer first name, service variant name, sequence, and timestamps.
-- Zero phone numbers, prices, earnings, or customer history.
create or replace function public.get_staff_my_queue(p_staff_id uuid)
returns table (
  line_id uuid,
  visit_id uuid,
  ticket_code text,
  customer_first_name text,
  service_name text,
  variant_name text,
  status text,
  sequence_no integer,
  ready_at timestamptz,
  started_at timestamptz,
  expected_ready_at timestamptz,
  source text
)
language plpgsql
security definer
as $$
begin
  return query
  with active_business_day as (
    select id from public.business_day
    where status = 'open'
    order by business_date desc
    limit 1
  ),
  staff_skills as (
    select service_id from public.staff_skill
    where staff_user_id = p_staff_id
  )
  -- 1. In Progress (Now)
  select 
    vs.id as line_id,
    v.id as visit_id,
    v.ticket_code::text,
    c.first_name::text as customer_first_name,
    s.name::text as service_name,
    sv.name::text as variant_name,
    vs.status::text,
    vs.sequence_no,
    vs.ready_at,
    vs.started_at,
    null::timestamptz as expected_ready_at,
    'mine'::text as source
  from public.visit_service vs
  join public.visit v on v.id = vs.visit_id
  join public.customer c on c.id = v.customer_id
  join public.service_variant sv on sv.id = vs.service_variant_id
  join public.service s on s.id = sv.service_id
  where vs.staff_user_id = p_staff_id
    and vs.status = 'in_progress'
    and v.business_day_id in (select id from active_business_day)
    and v.status in ('in_service', 'queued')

  union all

  -- 2. Ready for Me (Next - Assigned)
  select 
    vs.id as line_id,
    v.id as visit_id,
    v.ticket_code::text,
    c.first_name::text as customer_first_name,
    s.name::text as service_name,
    sv.name::text as variant_name,
    vs.status::text,
    vs.sequence_no,
    vs.ready_at,
    vs.started_at,
    null::timestamptz as expected_ready_at,
    'mine'::text as source
  from public.visit_service vs
  join public.visit v on v.id = vs.visit_id
  join public.customer c on c.id = v.customer_id
  join public.service_variant sv on sv.id = vs.service_variant_id
  join public.service s on s.id = sv.service_id
  where vs.staff_user_id = p_staff_id
    and vs.status = 'ready'
    and v.business_day_id in (select id from active_business_day)
    and v.status in ('in_service', 'queued')

  union all

  -- 3. Ready in Pool (Next - Unassigned but skilled)
  select 
    vs.id as line_id,
    v.id as visit_id,
    v.ticket_code::text,
    c.first_name::text as customer_first_name,
    s.name::text as service_name,
    sv.name::text as variant_name,
    vs.status::text,
    vs.sequence_no,
    vs.ready_at,
    vs.started_at,
    null::timestamptz as expected_ready_at,
    'pool'::text as source
  from public.visit_service vs
  join public.visit v on v.id = vs.visit_id
  join public.customer c on c.id = v.customer_id
  join public.service_variant sv on sv.id = vs.service_variant_id
  join public.service s on s.id = sv.service_id
  where vs.staff_user_id is null
    and vs.status = 'ready'
    and (s.id in (select service_id from staff_skills) or not exists (select 1 from staff_skills))
    and v.business_day_id in (select id from active_business_day)
    and v.status in ('in_service', 'queued')

  union all

  -- 4. Coming Up (Blocked - Waiting on prior sequence)
  select 
    vs.id as line_id,
    v.id as visit_id,
    v.ticket_code::text,
    c.first_name::text as customer_first_name,
    s.name::text as service_name,
    sv.name::text as variant_name,
    vs.status::text,
    vs.sequence_no,
    vs.ready_at,
    vs.started_at,
    coalesce(
      (select prior_vs.started_at + (prior_sv.expected_minutes || ' minutes')::interval
       from public.visit_service prior_vs
       join public.service_variant prior_sv on prior_sv.id = prior_vs.service_variant_id
       where prior_vs.visit_id = vs.visit_id and prior_vs.sequence_no = vs.sequence_no - 1 and prior_vs.started_at is not null),
      now() + interval '15 minutes'
    ) as expected_ready_at,
    case when vs.staff_user_id = p_staff_id then 'mine' else 'pool' end as source
  from public.visit_service vs
  join public.visit v on v.id = vs.visit_id
  join public.customer c on c.id = v.customer_id
  join public.service_variant sv on sv.id = vs.service_variant_id
  join public.service s on s.id = sv.service_id
  where (vs.staff_user_id = p_staff_id or (vs.staff_user_id is null and (s.id in (select service_id from staff_skills) or not exists (select 1 from staff_skills))))
    and vs.status = 'blocked'
    and v.business_day_id in (select id from active_business_day)
    and v.status in ('in_service', 'queued');
end;
$$;

-- 3. Secure RPC: rpc_start_staff_line
create or replace function public.rpc_start_staff_line(p_line_id uuid, p_staff_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_line record;
  v_prev_line record;
  v_active_count integer;
  v_now timestamptz := now();
begin
  -- 1. Check clocked in
  if not public.is_staff_clocked_in(p_staff_id) then
    return jsonb_build_object('success', false, 'code', 'NOT_CLOCKED_IN', 'message', 'Tap I''m in first');
  end if;

  -- 2. Check no other in_progress line for this staff member
  select count(*) into v_active_count
  from public.visit_service
  where staff_user_id = p_staff_id and status = 'in_progress';

  if v_active_count > 0 then
    return jsonb_build_object('success', false, 'code', 'ALREADY_ACTIVE', 'message', 'Finish your current service first');
  end if;

  -- 3. Fetch target line
  select * into v_line
  from public.visit_service
  where id = p_line_id;

  if v_line is null then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Service line not found');
  end if;

  -- 4. Check ownership / atomic claim for pool lines
  if v_line.staff_user_id is not null and v_line.staff_user_id <> p_staff_id then
    return jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'message', 'This line is assigned to another team member');
  end if;

  if v_line.status = 'in_progress' and v_line.staff_user_id = p_staff_id then
    return jsonb_build_object('success', true, 'code', 'ALREADY_STARTED');
  end if;

  -- 5. Check sequence rule: previous sequential line must be done
  if v_line.sequence_no > 1 then
    select * into v_prev_line
    from public.visit_service
    where visit_id = v_line.visit_id and sequence_no = v_line.sequence_no - 1;

    if v_prev_line is not null and v_prev_line.status not in ('done', 'skipped', 'cancelled') then
      return jsonb_build_object('success', false, 'code', 'EARLIER_STEP_NOT_FINISHED', 'message', 'Earlier step not finished');
    end if;
  end if;

  -- 6. Perform atomic start & claim
  update public.visit_service
  set status = 'in_progress',
      staff_user_id = p_staff_id,
      started_at = v_now
  where id = p_line_id
    and (staff_user_id is null or staff_user_id = p_staff_id)
    and status in ('ready', 'in_progress');

  if not found then
    return jsonb_build_object('success', false, 'code', 'ALREADY_TAKEN', 'message', 'Already taken by another stylist');
  end if;

  -- 7. Ensure visit status is in_service
  update public.visit
  set status = 'in_service',
      updated_at = v_now
  where id = v_line.visit_id;

  -- 8. Audit log
  insert into public.audit_log (
    organization_id, location_id, actor_id, actor_role,
    action, entity_type, entity_id, category, reason
  ) values (
    'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
    p_staff_id, 'staff', 'LINE_STARTED', 'visit_service', p_line_id, 'operations', 'Staff started service line'
  );

  return jsonb_build_object('success', true);
end;
$$;

-- 4. Secure RPC: rpc_finish_staff_line
create or replace function public.rpc_finish_staff_line(p_line_id uuid, p_staff_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_line record;
  v_next_line record;
  v_remaining_count integer;
  v_now timestamptz := now();
  v_ready_checkout boolean := false;
begin
  select * into v_line
  from public.visit_service
  where id = p_line_id;

  if v_line is null then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Service line not found');
  end if;

  if v_line.staff_user_id <> p_staff_id then
    return jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'message', 'Only the assigned staff member can complete this service line');
  end if;

  -- 1. Mark line done
  update public.visit_service
  set status = 'done',
      ended_at = v_now
  where id = p_line_id;

  -- 2. Check next line in sequence
  select * into v_next_line
  from public.visit_service
  where visit_id = v_line.visit_id and sequence_no = v_line.sequence_no + 1;

  if v_next_line is not null then
    if v_next_line.status = 'blocked' then
      update public.visit_service
      set status = 'ready',
          ready_at = v_now
      where id = v_next_line.id;
    end if;
  else
    -- Check if all lines are done
    select count(*) into v_remaining_count
    from public.visit_service
    where visit_id = v_line.visit_id
      and status not in ('done', 'skipped', 'cancelled');

    if v_remaining_count = 0 then
      update public.visit
      set status = 'ready_for_checkout',
          updated_at = v_now
      where id = v_line.visit_id;
      v_ready_checkout := true;
    end if;
  end if;

  -- 3. Audit log
  insert into public.audit_log (
    organization_id, location_id, actor_id, actor_role,
    action, entity_type, entity_id, category, reason
  ) values (
    'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
    p_staff_id, 'staff', 'LINE_FINISHED', 'visit_service', p_line_id, 'operations', 'Staff finished service line'
  );

  return jsonb_build_object('success', true, 'ready_for_checkout', v_ready_checkout);
end;
$$;

-- 5. Secure RPC: rpc_undo_staff_line (10 second window)
create or replace function public.rpc_undo_staff_line(p_line_id uuid, p_staff_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_line record;
  v_now timestamptz := now();
begin
  select * into v_line
  from public.visit_service
  where id = p_line_id;

  if v_line is null then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Line not found');
  end if;

  if v_line.staff_user_id <> p_staff_id then
    return jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'message', 'Only the staff member who performed this action can undo it');
  end if;

  -- If line was finished within 10 seconds, revert to in_progress
  if v_line.status = 'done' and v_line.ended_at is not null then
    if extract(epoch from (v_now - v_line.ended_at)) > 10 then
      return jsonb_build_object('success', false, 'code', 'UNDO_EXPIRED', 'message', 'Undo window has expired (10s limit)');
    end if;

    update public.visit_service
    set status = 'in_progress',
        ended_at = null
    where id = p_line_id;

    -- Revert next line if it was made ready
    update public.visit_service
    set status = 'blocked',
        ready_at = null
    where visit_id = v_line.visit_id and sequence_no = v_line.sequence_no + 1 and status = 'ready';

    -- Revert visit status
    update public.visit
    set status = 'in_service',
        updated_at = v_now
    where id = v_line.visit_id;

    insert into public.audit_log (
      organization_id, location_id, actor_id, actor_role,
      action, entity_type, entity_id, category, reason
    ) values (
      'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
      p_staff_id, 'staff', 'LINE_UNDO_DONE', 'visit_service', p_line_id, 'operations', 'Staff reverted Done action within 10s'
    );

    return jsonb_build_object('success', true, 'reverted_to', 'in_progress');
  end if;

  -- If line was started within 10 seconds, revert to ready
  if v_line.status = 'in_progress' and v_line.started_at is not null then
    if extract(epoch from (v_now - v_line.started_at)) > 10 then
      return jsonb_build_object('success', false, 'code', 'UNDO_EXPIRED', 'message', 'Undo window has expired (10s limit)');
    end if;

    update public.visit_service
    set status = 'ready',
        started_at = null
    where id = p_line_id;

    insert into public.audit_log (
      organization_id, location_id, actor_id, actor_role,
      action, entity_type, entity_id, category, reason
    ) values (
      'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
      p_staff_id, 'staff', 'LINE_UNDO_START', 'visit_service', p_line_id, 'operations', 'Staff reverted Start action within 10s'
    );

    return jsonb_build_object('success', true, 'reverted_to', 'ready');
  end if;

  return jsonb_build_object('success', false, 'code', 'INVALID_STATE', 'message', 'Action cannot be undone');
end;
$$;
