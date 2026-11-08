-- Migration 00005: Owner Review Tracking and Owner Summary RPC
-- Creates owner_review_seen table to track owner review state without modifying append-only tables,
-- and defines owner_dashboard_summary RPC calculating all real-time and comparative metrics.

-- 1. OWNER REVIEW SEEN TABLE
create table if not exists owner_review_seen (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  seen_at timestamptz not null default now(),
  seen_by uuid not null references app_user(id),
  unique (entity_type, entity_id, seen_by)
);

alter table owner_review_seen enable row level security;

create policy owner_review_seen_select on owner_review_seen
  for select using ((select role from app_user where id = auth.uid()) = 'owner');

create policy owner_review_seen_insert on owner_review_seen
  for insert with check ((select role from app_user where id = auth.uid()) = 'owner');

-- 2. OWNER DASHBOARD SUMMARY RPC
create or replace function get_owner_dashboard_summary(p_location_id uuid)
returns jsonb as $$
declare
  v_user app_user;
  v_today date;
  v_now timestamptz := now();
  v_day business_day%rowtype;
  v_day_status text;
  v_opened_at_str text;
  v_last_activity timestamptz;
  
  -- Revenue metrics
  v_momo_rev bigint := 0;
  v_cash_rev bigint := 0;
  v_refunds bigint := 0;
  v_total_revenue bigint := 0;
  
  -- Verification metrics
  v_momo_verified bigint := 0;
  v_momo_awaiting bigint := 0;
  v_momo_total bigint := 0;
  v_momo_verified_pct int := 0;
  
  -- 4-week same-weekday average
  v_dow int;
  v_avg_same_weekday bigint := null;
  v_comp_count int := 0;
  
  -- Salon activity
  v_waiting_count int := 0;
  v_in_service_count int := 0;
  v_completed_count int := 0;
  v_left_queue_count int := 0;
  v_no_show_count int := 0;
  
  -- Staff metrics
  v_staff_present_count int := 0;
  v_staff_expected_count int := 0;
  v_absent_names text[] := array[]::text[];
  v_late_names text[] := array[]::text[];
  
  -- Live queue snapshot
  v_queue_snapshot jsonb := '[]'::jsonb;
  
  -- Review items
  v_review_items jsonb := '[]'::jsonb;
  
  -- Revenue hourly chart
  v_revenue_chart jsonb := '[]'::jsonb;
begin
  select * into v_user from app_user where id = auth.uid();
  if v_user.role not in ('owner', 'manager') then
    return jsonb_build_object('error', 'forbidden', 'message', 'Only owner or manager can view dashboard summary.');
  end if;

  v_today := (v_now at time zone 'Africa/Kampala')::date;
  v_dow := extract(dow from v_today)::int;

  -- 1. Find active or latest business day
  select * into v_day from business_day
  where location_id = p_location_id and business_date = v_today
  limit 1;

  if not found then
    select * into v_day from business_day
    where location_id = p_location_id
    order by business_date desc limit 1;
  end if;

  if v_day.id is not null then
    v_day_status := v_day.status::text;
    if v_day.opened_at is not null then
      v_opened_at_str := to_char(v_day.opened_at at time zone 'Africa/Kampala', 'HH24:MI');
    end if;
  else
    v_day_status := 'not_opened';
  end if;

  -- 2. Calculate Revenue & Splits for today (or latest active day)
  if v_day.id is not null then
    select
      coalesce(sum(case when method = 'mobile_money' and status in ('recorded', 'confirmed', 'reconciled') then amount_ugx else 0 end), 0),
      coalesce(sum(case when method = 'cash' and status in ('recorded', 'confirmed', 'reconciled') then amount_ugx else 0 end), 0),
      coalesce(sum(case when status = 'refunded' then amount_ugx else 0 end), 0),
      coalesce(sum(case when method = 'mobile_money' and status in ('confirmed', 'reconciled') then amount_ugx else 0 end), 0),
      coalesce(sum(case when method = 'mobile_money' and status = 'recorded' then amount_ugx else 0 end), 0)
    into v_momo_rev, v_cash_rev, v_refunds, v_momo_verified, v_momo_awaiting
    from payment
    where business_day_id = v_day.id;

    v_total_revenue := (v_momo_rev + v_cash_rev) - v_refunds;
    v_momo_total := v_momo_verified + v_momo_awaiting;
    if v_momo_total > 0 then
      v_momo_verified_pct := round((v_momo_verified::numeric / v_momo_total::numeric) * 100)::int;
    else
      v_momo_verified_pct := 0;
    end if;

    -- 3. Salon Activity Counts
    select
      count(*) filter (where status = 'queued'),
      count(*) filter (where status = 'in_service'),
      count(*) filter (where status in ('ready_for_checkout', 'completed')),
      count(*) filter (where status = 'abandoned')
    into v_waiting_count, v_in_service_count, v_completed_count, v_left_queue_count
    from visit
    where business_day_id = v_day.id;

    select count(*) into v_no_show_count
    from appointment
    where location_id = p_location_id and (starts_at at time zone 'Africa/Kampala')::date = v_day.business_date and status = 'no_show';

    -- 4. Live Queue Snapshot
    select jsonb_agg(q) into v_queue_snapshot from (
      select v.ticket_code, v.status, to_char(v.queued_at at time zone 'Africa/Kampala', 'HH24:MI') as queued_time,
             c.first_name as customer_name
      from visit v
      left join customer c on c.id = v.customer_id
      where v.business_day_id = v_day.id and v.status in ('queued', 'in_service', 'ready_for_checkout')
      order by v.queued_at asc
      limit 10
    ) q;
    v_queue_snapshot := coalesce(v_queue_snapshot, '[]'::jsonb);
  end if;

  -- 5. Calculate same-weekday 4-week comparison average
  select avg(total_revenue), count(*)
  into v_avg_same_weekday, v_comp_count
  from (
    select bd.business_date, coalesce(sum(p.amount_ugx), 0) as total_revenue
    from business_day bd
    join payment p on p.business_day_id = bd.id and p.status in ('recorded', 'confirmed', 'reconciled')
    where bd.location_id = p_location_id
      and bd.status = 'closed'
      and extract(dow from bd.business_date)::int = v_dow
      and bd.business_date < v_today
    group by bd.business_date
    order by bd.business_date desc
    limit 4
  ) hist;

  -- 6. Staff Attendance & Rota
  select
    count(distinct a.staff_user_id),
    array_remove(array_agg(case when a.late then u.display_name else null end), null)
  into v_staff_present_count, v_late_names
  from attendance a
  join app_user u on u.id = a.staff_user_id
  where a.location_id = p_location_id and a.business_date = coalesce(v_day.business_date, v_today);

  -- Expected from rota (excluding approved leave)
  select count(distinct r.staff_user_id) into v_staff_expected_count
  from rota_entry r
  where r.location_id = p_location_id
    and r.work_date = coalesce(v_day.business_date, v_today)
    and not exists (
      select 1 from leave_request lr
      where lr.staff_user_id = r.staff_user_id
        and lr.status = 'approved'
        and lr.start_date <= coalesce(v_day.business_date, v_today)
        and lr.end_date >= coalesce(v_day.business_date, v_today)
    );

  if v_staff_expected_count = 0 then
    v_staff_expected_count := 6; -- Default Mbarara floor target
  end if;

  -- Absent staff names
  select array_remove(array_agg(u.display_name), null) into v_absent_names
  from app_user u
  where u.location_id = p_location_id and u.role in ('staff', 'receptionist')
    and not exists (
      select 1 from attendance a
      where a.staff_user_id = u.id and a.business_date = coalesce(v_day.business_date, v_today)
    )
    and not exists (
      select 1 from leave_request lr
      where lr.staff_user_id = u.id and lr.status = 'approved'
        and lr.start_date <= coalesce(v_day.business_date, v_today)
        and lr.end_date >= coalesce(v_day.business_date, v_today)
    );

  -- 7. Last Activity Time (Guaranteed never in future)
  select greatest(
    coalesce(max(a.at), '2026-01-01'::timestamptz),
    coalesce(max(v.updated_at), '2026-01-01'::timestamptz),
    coalesce(max(p.created_at), '2026-01-01'::timestamptz)
  ) into v_last_activity
  from location loc
  left join audit_log a on a.at <= v_now
  left join visit v on v.location_id = p_location_id and v.updated_at <= v_now
  left join payment p on p.location_id = p_location_id and p.created_at <= v_now
  where loc.id = p_location_id;

  if v_last_activity = '2026-01-01'::timestamptz or v_last_activity is null then
    v_last_activity := v_now;
  end if;

  -- 8. "For Your Review" Items (Audit events, discounts, voids, etc.)
  select jsonb_agg(item) into v_review_items from (
    select
      al.id::text,
      case
        when al.action like '%DISCOUNT%' then 'Discount'
        when al.action like '%REFUND%' then 'Refund'
        when al.action like '%VOID%' then 'Void'
        when al.action like '%COMPLIMENTARY%' then 'Complimentary'
        when al.action like '%WRITE_OFF%' then 'Write-off'
        when al.action like '%REOPEN%' or al.action like '%UNDO%' then 'Reopened day'
        when al.action like '%EXPORT%' then 'Export'
        when al.category = 'people' or al.action like '%HR%' then 'HR'
        when al.action like '%CORRECTION%' then 'Correction'
        else 'Action'
      end as category,
      coalesce(al.reason, al.action) as title,
      coalesce(u.display_name, al.actor_role) as actor,
      to_char(al.at at time zone 'Africa/Kampala', 'HH24:MI') as time_str,
      al.at,
      exists (
        select 1 from owner_review_seen s
        where s.entity_type = 'audit_log' and s.entity_id = al.id::text and s.seen_by = auth.uid()
      ) as seen
    from audit_log al
    left join app_user u on u.id = al.actor_id
    where al.at >= (v_now - interval '7 days')
    order by al.at desc
    limit 20
  ) item;
  v_review_items := coalesce(v_review_items, '[]'::jsonb);

  -- 9. Hourly Revenue Chart (Last 7 days or today)
  select jsonb_agg(c) into v_revenue_chart from (
    select
      to_char(bd.business_date, 'Dy DD Mon') as day_label,
      coalesce(sum(p.amount_ugx), 0) as amount_ugx
    from (
      select generate_series(v_today - 6, v_today, '1 day'::interval)::date as business_date
    ) d
    left join business_day bd on bd.business_date = d.business_date and bd.location_id = p_location_id
    left join payment p on p.business_day_id = bd.id and p.status in ('recorded', 'confirmed', 'reconciled')
    group by d.business_date, bd.business_date
    order by d.business_date asc
  ) c;
  v_revenue_chart := coalesce(v_revenue_chart, '[]'::jsonb);

  return jsonb_build_object(
    'business_date', coalesce(v_day.business_date, v_today),
    'day_status', v_day_status,
    'opened_at_str', v_opened_at_str,
    'expected_open', coalesce(v_day.expected_open, '08:00'::time),
    'last_activity_str', to_char(v_last_activity at time zone 'Africa/Kampala', 'HH24:MI'),
    'last_activity_iso', v_last_activity,
    'revenue_today_ugx', v_total_revenue,
    'revenue_momo_ugx', v_momo_rev,
    'revenue_cash_ugx', v_cash_rev,
    'avg_same_weekday_ugx', v_avg_same_weekday,
    'comp_count', v_comp_count,
    'momo_verified_ugx', v_momo_verified,
    'momo_awaiting_ugx', v_momo_awaiting,
    'momo_verified_pct', v_momo_verified_pct,
    'activity', jsonb_build_object(
      'waiting', v_waiting_count,
      'in_service', v_in_service_count,
      'completed', v_completed_count,
      'left_queue', v_left_queue_count,
      'no_show', v_no_show_count
    ),
    'staff', jsonb_build_object(
      'present', v_staff_present_count,
      'expected', v_staff_expected_count,
      'absent_names', coalesce(v_absent_names, array[]::text[]),
      'late_names', coalesce(v_late_names, array[]::text[])
    ),
    'queue_snapshot', v_queue_snapshot,
    'review_items', v_review_items,
    'revenue_chart', v_revenue_chart
  );
end;
$$ language plpgsql security definer set search_path = public, auth;
