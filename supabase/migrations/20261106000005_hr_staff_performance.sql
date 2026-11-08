-- Phase 5: one people-only performance source shared by HR and the owner.
create or replace function public.get_staff_performance_report(
  p_actor_user_id uuid,
  p_from_date date,
  p_to_date date,
  p_role text default null,
  p_staff_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor record;
  report jsonb;
begin
  select u.id, u.role, u.organization_id, u.location_id
    into actor
  from public.app_user u
  where u.id = p_actor_user_id and u.status = 'active';

  if actor.id is null or actor.role not in ('hr', 'owner') then
    raise exception 'Only active HR or owner users can read staff performance' using errcode = '42501';
  end if;
  if p_from_date is null or p_to_date is null or p_from_date > p_to_date
      or p_to_date - p_from_date > 365
      or p_from_date < (now() at time zone 'Africa/Kampala')::date - 365
      or p_to_date > (now() at time zone 'Africa/Kampala')::date then
    raise exception 'Choose a past performance period within the available 366-day attendance history' using errcode = '22023';
  end if;
  if p_role is not null and p_role not in ('staff', 'receptionist', 'manager', 'hr') then
    raise exception 'Invalid staff role filter' using errcode = '22023';
  end if;
  if p_staff_user_id is not null and not exists (
    select 1 from public.app_user u
    where u.id = p_staff_user_id and u.location_id = actor.location_id
      and u.role in ('staff', 'receptionist', 'manager', 'hr')
  ) then
    raise exception 'Staff member is outside this location' using errcode = '42501';
  end if;

  with users as (
    select u.id as staff_id, u.display_name as name, u.role
    from public.app_user u
    where u.location_id = actor.location_id and u.status = 'active'
      and u.role in ('staff', 'receptionist', 'manager', 'hr')
      and (p_role is null or u.role::text = p_role)
  ), eligible_visits as (
    select v.id as visit_id, bd.business_date
    from public.visit v
    join public.business_day bd on bd.id = v.business_day_id
    where v.location_id = actor.location_id
      and v.status in ('paid', 'closed')
      and v.total_final_ugx > 0
      and bd.business_date between p_from_date and p_to_date
      and not exists (
        select 1 from public.payment p
        join public.payment_adjustment pa on pa.payment_id = p.id
        where p.visit_id = v.id and pa.adjustment_type in ('refund', 'void')
      )
      and exists (
        select 1 from public.visit_service paid_line
        where paid_line.visit_id = v.id and paid_line.price_source <> 'complimentary'
      )
  ), completed_visits as (
    select distinct vs.staff_user_id as staff_id, vs.visit_id, ev.business_date
    from public.visit_service vs
    join eligible_visits ev on ev.visit_id = vs.visit_id
    where vs.status = 'done' and vs.staff_user_id is not null
  ), measured_lines as (
    select vs.staff_user_id as staff_id, vs.visit_id, ev.business_date,
      s.category, sv.expected_minutes,
      round(extract(epoch from (vs.ended_at - vs.started_at)) / 60.0)::int as actual_minutes,
      extract(hour from (vs.started_at at time zone 'Africa/Kampala'))::int as start_hour
    from public.visit_service vs
    join eligible_visits ev on ev.visit_id = vs.visit_id
    join public.visit v on v.id = vs.visit_id
    join public.service_variant sv on sv.id = vs.service_variant_id
    join public.service s on s.id = sv.service_id
    where vs.status = 'done' and vs.times_source = 'measured'
      and vs.started_at is not null and vs.ended_at is not null
      and vs.ended_at > vs.started_at
      and extract(epoch from (vs.ended_at - vs.started_at)) / 60.0 <= 300
      and v.entered_via = 'live'
      and ev.business_date between p_from_date and p_to_date
  ), attendance as (
    select d.staff_user_id as staff_id, d.business_date, d.clock_in, d.hours_worked,
      d.late_minutes, d.status, d.absence_type
    from public.hr_attendance_daily d
    where d.location_id = actor.location_id
      and d.business_date between p_from_date and p_to_date
  ), target_settings as (
    select u.staff_id,
      nullif(s.value -> u.staff_id::text ->> 'target_customers', '')::int as target_customers,
      coalesce(s.value -> u.staff_id::text ->> 'period', 'monthly') as target_period,
      nullif(s.value -> u.staff_id::text ->> 'deadline', '')::date as target_deadline
    from users u
    left join public.app_setting s on s.location_id = actor.location_id and s.key = 'staff_targets'
  ), target_windows as (
    select t.*,
      case t.target_period
        when 'weekly' then coalesce(t.target_deadline, (now() at time zone 'Africa/Kampala')::date) - 6
        when 'monthly' then date_trunc('month', coalesce(t.target_deadline, (now() at time zone 'Africa/Kampala')::date)::timestamp)::date
        when '3-month' then (coalesce(t.target_deadline, (now() at time zone 'Africa/Kampala')::date) - interval '3 months' + interval '1 day')::date
        else date_trunc('month', coalesce(t.target_deadline, (now() at time zone 'Africa/Kampala')::date)::timestamp)::date
      end as target_from,
      least(coalesce(t.target_deadline, (now() at time zone 'Africa/Kampala')::date), (now() at time zone 'Africa/Kampala')::date) as target_to
    from target_settings t
  ), target_counts as (
    select tw.staff_id, tw.target_customers, tw.target_period, tw.target_deadline,
      (select count(distinct v.id)::int
       from public.visit_service vs
       join public.visit v on v.id = vs.visit_id
       join public.business_day bd on bd.id = v.business_day_id
       where vs.staff_user_id = tw.staff_id and vs.status = 'done'
         and v.location_id = actor.location_id and v.status in ('paid', 'closed')
         and v.total_final_ugx > 0 and bd.business_date between tw.target_from and tw.target_to
         and exists (select 1 from public.visit_service paid_line
           where paid_line.visit_id = v.id and paid_line.price_source <> 'complimentary')
         and not exists (select 1 from public.payment p
           join public.payment_adjustment pa on pa.payment_id = p.id
           where p.visit_id = v.id and pa.adjustment_type in ('refund', 'void'))
      ) as target_current
    from target_windows tw
  ), service_aggregates as (
    select u.staff_id,
      count(ml.staff_id)::int as services_completed,
      coalesce(sum(ml.actual_minutes), 0)::int as measured_minutes,
      round(avg(ml.actual_minutes), 1) as avg_service_minutes,
      round(avg(ml.expected_minutes), 1) as avg_expected_minutes
    from users u left join measured_lines ml on ml.staff_id = u.staff_id
    group by u.staff_id
  ), customer_aggregates as (
    select u.staff_id, count(distinct cv.visit_id)::int as customers_served
    from users u left join completed_visits cv on cv.staff_id = u.staff_id
    group by u.staff_id
  ), attendance_aggregates as (
    select u.staff_id,
      count(*) filter (where a.clock_in is not null)::int as days_present,
      round(coalesce(sum(a.hours_worked), 0)::numeric, 1) as hours_worked,
      round(100.0 * count(*) filter (where a.clock_in is not null and coalesce(a.late_minutes, 0) = 0)
        / nullif(count(*) filter (where a.clock_in is not null), 0), 1) as on_time_rate_pct,
      count(*) filter (where a.absence_type = 'unapproved_absence' or a.status = 'unapproved_absence')::int as unapproved_absences
    from users u left join attendance a on a.staff_id = u.staff_id
    group by u.staff_id
  ), category_rows as (
    select ml.staff_id, ml.category, count(*)::int as services,
      round(avg(ml.actual_minutes), 1) as avg_actual_minutes,
      round(avg(ml.expected_minutes), 1) as avg_expected_minutes
    from measured_lines ml group by ml.staff_id, ml.category
  ), top_categories as (
    select c.staff_id,
      jsonb_agg(jsonb_build_object('category', c.category, 'services', c.services)
        order by c.services desc, c.category) as categories
    from (
      select cr.*, row_number() over (partition by cr.staff_id order by cr.services desc, cr.category) as rn
      from category_rows cr
    ) c where c.rn <= 3 group by c.staff_id
  ), metrics as (
    select u.staff_id, u.name, u.role::text as role, (u.role = 'staff') as is_service_staff,
      case when u.role = 'staff' then sa.services_completed end as services_completed,
      case when u.role = 'staff' then ca.customers_served end as customers_served,
      case when u.role = 'staff' then sa.measured_minutes end as measured_minutes,
      case when u.role = 'staff' then sa.avg_service_minutes end as avg_service_minutes,
      case when u.role = 'staff' then sa.avg_expected_minutes end as avg_expected_minutes,
      case when u.role = 'staff' and aa.hours_worked > 0 then round(100.0 * sa.measured_minutes / (aa.hours_worked * 60.0), 1) end as utilization_pct,
      aa.on_time_rate_pct, aa.days_present, aa.hours_worked, aa.unapproved_absences,
      case when u.role = 'staff' then tc.target_current end as target_current,
      case when u.role = 'staff' then tc.target_customers end as target_goal,
      case when u.role = 'staff' then tc.target_period end as target_period,
      case when u.role = 'staff' then tc.target_deadline end as target_deadline,
      case when u.role = 'staff' and tc.target_customers > 0 then least(100, round(100.0 * tc.target_current / tc.target_customers))::int end as target_progress_pct,
      case when u.role = 'staff' then coalesce(top.categories, '[]'::jsonb) else '[]'::jsonb end as top_categories
    from users u
    join service_aggregates sa on sa.staff_id = u.staff_id
    join customer_aggregates ca on ca.staff_id = u.staff_id
    join attendance_aggregates aa on aa.staff_id = u.staff_id
    left join target_counts tc on tc.staff_id = u.staff_id
    left join top_categories top on top.staff_id = u.staff_id
  ), team as (
    select
      coalesce(sum(m.services_completed) filter (where m.is_service_staff), 0)::int as services_completed,
      coalesce((select count(distinct cv.visit_id)::int from completed_visits cv join users u on u.staff_id = cv.staff_id where u.role = 'staff'), 0) as customers_served,
      (select round(avg(ml.actual_minutes), 1) from measured_lines ml join users u on u.staff_id = ml.staff_id where u.role = 'staff') as avg_service_minutes,
      case when sum(m.days_present) > 0 then round(100.0 * sum(case when m.on_time_rate_pct is not null then m.on_time_rate_pct * m.days_present / 100.0 else 0 end) / sum(m.days_present), 1) end as on_time_rate_pct,
      case when sum(m.hours_worked) filter (where m.is_service_staff) > 0
        then round(100.0 * sum(m.measured_minutes) filter (where m.is_service_staff) / (sum(m.hours_worked) filter (where m.is_service_staff) * 60.0), 1) end as utilization_pct,
      coalesce(sum(m.hours_worked), 0)::numeric(10,1) as hours_worked
    from metrics m
  ), detail as (
    select jsonb_build_object(
      'staff_id', u.staff_id,
      'services_by_day', coalesce((select jsonb_agg(jsonb_build_object('date', d.business_date, 'services', d.services) order by d.business_date)
        from (select ml.business_date, count(*)::int as services from measured_lines ml where ml.staff_id = u.staff_id group by ml.business_date) d), '[]'::jsonb),
      'category_durations', coalesce((select jsonb_agg(jsonb_build_object('category', cr.category, 'services', cr.services, 'avg_actual_minutes', cr.avg_actual_minutes, 'avg_expected_minutes', cr.avg_expected_minutes) order by cr.category)
        from category_rows cr where cr.staff_id = u.staff_id), '[]'::jsonb),
      'time_of_day', coalesce((select jsonb_agg(jsonb_build_object('hour', t.start_hour, 'services', t.services) order by t.start_hour)
        from (select ml.start_hour, count(*)::int as services from measured_lines ml where ml.staff_id = u.staff_id group by ml.start_hour) t), '[]'::jsonb),
      'attendance', jsonb_build_object('days_present', m.days_present, 'hours_worked', m.hours_worked, 'on_time_rate_pct', m.on_time_rate_pct, 'unapproved_absences', m.unapproved_absences),
      'target', jsonb_build_object('current', m.target_current, 'goal', m.target_goal, 'period', m.target_period, 'deadline', m.target_deadline, 'progress_pct', m.target_progress_pct),
      'team_average', jsonb_build_object('avg_service_minutes', tm.avg_service_minutes, 'utilization_pct', tm.utilization_pct, 'on_time_rate_pct', tm.on_time_rate_pct, 'hours_worked', tm.hours_worked)
    ) as value
    from metrics m join users u on u.staff_id = m.staff_id cross join team tm
    where u.staff_id = p_staff_user_id
  )
  select jsonb_build_object(
    'from_date', p_from_date,
    'to_date', p_to_date,
    'team', (select to_jsonb(team) from team),
    'people', coalesce((select jsonb_agg(to_jsonb(metrics) order by metrics.role, metrics.name) from metrics), '[]'::jsonb),
    'person_detail', (select detail.value from detail)
  ) into report;

  return report;
end;
$$;

revoke all on function public.get_staff_performance_report(uuid, date, date, text, uuid) from public, anon, authenticated;
grant execute on function public.get_staff_performance_report(uuid, date, date, text, uuid) to service_role;
