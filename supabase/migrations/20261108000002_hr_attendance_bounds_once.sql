-- Evaluate attendance date bounds once instead of once per staff row. The old and new view return the same columns and rows.
create or replace view public.hr_attendance_daily with (security_invoker = true) as
with bounds as materialized (
  select greatest(coalesce(min(business_date), (now() at time zone 'Africa/Kampala')::date - 90), (now() at time zone 'Africa/Kampala')::date - 365) as first_day,
         (now() at time zone 'Africa/Kampala')::date as last_day
  from public.attendance
), days as (
  select generate_series(first_day, last_day, interval '1 day')::date as business_date from bounds
), staff_days as (
  select u.id as staff_user_id, u.location_id, u.organization_id, u.full_name as staff_name, u.role, d.business_date,
    a.id as attendance_id, a.clock_in, a.clock_out, coalesce(a.absence_type::text, 'none') as absence_type,
    coalesce(a.on_break, false) as on_break, a.break_started_at, a.corrected_by, a.corrected_reason, a.updated_at,
    coalesce(nullif(a.policy_snapshot ->> 'standard_start', '')::time,
      case when r.id is not null and not r.is_off then r.start_time end,
      nullif(w.role_overrides -> u.role::text ->> 'standard_start', '')::time, w.standard_start, '08:00'::time) as standard_start,
    coalesce(nullif(a.policy_snapshot ->> 'standard_end', '')::time,
      case when r.id is not null and not r.is_off then r.end_time end,
      nullif(w.role_overrides -> u.role::text ->> 'standard_end', '')::time, w.standard_end, '17:00'::time) as standard_end,
    coalesce(nullif(a.policy_snapshot ->> 'late_grace_minutes', '')::int,
      nullif(w.role_overrides -> u.role::text ->> 'late_grace_minutes', '')::int, w.late_grace_minutes, 15) as late_grace_minutes,
    coalesce(nullif(a.policy_snapshot ->> 'early_departure_grace_minutes', '')::int,
      nullif(w.role_overrides -> u.role::text ->> 'early_departure_grace_minutes', '')::int, w.early_departure_grace_minutes, 15) as early_departure_grace_minutes,
    coalesce(a.policy_snapshot ->> 'rota_override' = 'true', r.id is not null and not r.is_off) as rota_override,
    r.id as rota_id, w.working_days,
    leave.id as leave_id, leave.leave_type,
    coalesce(a.policy_snapshot ->> 'standard_start', '') <> '' as has_policy_snapshot
  from public.app_user u cross join days d
  left join lateral (select a.* from public.attendance a where a.staff_user_id = u.id and a.business_date = d.business_date order by a.updated_at desc limit 1) a on true
  left join lateral (select x.* from public.rota_entry x where x.staff_user_id = u.id and x.weekday = extract(dow from d.business_date)::smallint and x.effective_from <= d.business_date order by x.effective_from desc limit 1) r on true
  left join lateral (select p.* from public.work_hours_policy p where p.location_id = u.location_id and p.effective_from <= d.business_date order by p.effective_from desc limit 1) w on true
  left join lateral (select l.id, l.leave_type from public.leave_request l where l.staff_user_id = u.id and l.status = 'approved' and d.business_date between l.from_date and l.to_date order by l.created_at desc limit 1) leave on true
  where u.status = 'active' and u.role in ('staff','receptionist','manager','hr')
), scheduled as (
  select sd.*, (case when sd.rota_id is not null then sd.rota_override else extract(dow from sd.business_date)::smallint = any(coalesce(sd.working_days, array[1,2,3,4,5,6]::smallint[])) end) as is_rota_workday
  from staff_days sd
), break_totals as (
  select bp.attendance_id,
    coalesce(sum(greatest(0, extract(epoch from (coalesce(bp.ended_at, now()) - bp.started_at)) / 60)),0)::int as break_minutes
  from public.attendance_break_period bp where bp.ended_at is not null group by bp.attendance_id
), raw as (
  select s.*, coalesce(bt.break_minutes,0) + case when s.on_break and s.break_started_at is not null then greatest(0, extract(epoch from (now() - s.break_started_at)) / 60)::int else 0 end as total_break_minutes,
    extract(hour from (s.clock_in at time zone 'Africa/Kampala'))::int * 60 + extract(minute from (s.clock_in at time zone 'Africa/Kampala'))::int - (extract(hour from s.standard_start)::int * 60 + extract(minute from s.standard_start)::int) as arrival_offset,
    case when s.clock_out is not null then extract(hour from (s.clock_out at time zone 'Africa/Kampala'))::int * 60 + extract(minute from (s.clock_out at time zone 'Africa/Kampala'))::int - (extract(hour from s.standard_end)::int * 60 + extract(minute from s.standard_end)::int) end as departure_offset
  from scheduled s left join break_totals bt on bt.attendance_id = s.attendance_id
)
select r.staff_user_id, r.location_id, r.staff_name, r.role, r.business_date, r.attendance_id,
  r.clock_in, r.clock_out, r.absence_type, r.corrected_by, r.corrected_reason, r.updated_at,
  r.standard_start, r.standard_end, r.late_grace_minutes, r.early_departure_grace_minutes,
  r.rota_override, r.is_rota_workday, r.leave_type, r.total_break_minutes as break_minutes,
  case when r.clock_in is null then null else r.arrival_offset end as arrival_offset_minutes,
  case when r.clock_in is not null and r.arrival_offset > r.late_grace_minutes then r.arrival_offset - r.late_grace_minutes else 0 end as late_minutes,
  case when r.clock_out is null then null else r.departure_offset end as departure_offset_minutes,
  case when r.clock_out is not null and r.departure_offset < -r.early_departure_grace_minutes then abs(r.departure_offset) - r.early_departure_grace_minutes else 0 end as early_departure_minutes,
  case when r.clock_out is not null and r.departure_offset > 0 then r.departure_offset else 0 end as overtime_minutes,
  case when r.clock_in is not null and r.clock_out is not null and r.clock_out > r.clock_in
    then greatest(0, extract(epoch from (r.clock_out - r.clock_in)) / 60 - r.total_break_minutes)::numeric / 60
    when r.clock_in is not null and r.clock_out is null and r.business_date = (now() at time zone 'Africa/Kampala')::date
    then greatest(0, extract(epoch from (now() - r.clock_in)) / 60 - r.total_break_minutes)::numeric / 60
    else null end as hours_worked,
  case when r.leave_id is not null then 'on_leave'
    when r.attendance_id is null and not r.is_rota_workday then 'off_duty'
    when r.clock_in is null and r.absence_type = 'unapproved_absence' then 'unapproved_absence'
    when r.clock_in is null and r.absence_type = 'approved_leave' then 'on_leave'
    when r.clock_in is null then 'not_present'
    when r.clock_out is null and r.business_date < (now() at time zone 'Africa/Kampala')::date then 'missed_clock_out'
    when r.clock_out is null then 'in_progress'
    when r.arrival_offset > r.late_grace_minutes then 'late'
    when r.departure_offset < -r.early_departure_grace_minutes then 'early_departure'
    when r.departure_offset > 0 then 'overtime'
    else 'on_time' end as status,
  r.attendance_id is not null or r.leave_id is not null as has_attendance_record
from raw r
where r.is_rota_workday or r.attendance_id is not null or r.leave_id is not null;

create or replace view public.hr_leave_balance with (security_invoker = true) as
with policy_now as (
  select distinct on (location_id) * from public.annual_leave_policy
  where effective_from <= (now() at time zone 'Africa/Kampala')::date order by location_id, effective_from desc
), staff as (
  select u.*, p.entitlement_by_role, p.leave_year_start_month, p.leave_year_start_day, p.public_holidays,
    coalesce(o.entitlement_days, nullif(nullif(p.entitlement_by_role ->> u.role::text, ''), 'null')::numeric) as entitlement_days,
    make_date(extract(year from (now() at time zone 'Africa/Kampala'))::int, p.leave_year_start_month,
      least(p.leave_year_start_day, extract(day from (date_trunc('month', make_date(extract(year from (now() at time zone 'Africa/Kampala'))::int, p.leave_year_start_month, 1)) + interval '1 month - 1 day'))::int)) as this_year_start
  from public.app_user u left join policy_now p on p.location_id = u.location_id
  left join lateral (select x.entitlement_days from public.annual_leave_entitlement_override x where x.staff_user_id = u.id and x.effective_from <= (now() at time zone 'Africa/Kampala')::date order by x.effective_from desc limit 1) o on true
  where u.status = 'active' and u.role in ('staff','receptionist','manager','hr')
), years as (
  select s.*, case when (now() at time zone 'Africa/Kampala')::date >= s.this_year_start then s.this_year_start else (s.this_year_start - interval '1 year')::date end as year_start from staff s
), balances as (
  select y.*,
    coalesce((select sum(1) from public.leave_request l cross join lateral generate_series(l.from_date, l.to_date, interval '1 day') g(day)
      where l.staff_user_id = y.id and l.status = 'approved' and l.leave_type = 'annual_leave'
      and g.day::date <= (now() at time zone 'Africa/Kampala')::date
      and g.day::date >= y.year_start and g.day::date < (y.year_start + interval '1 year')::date
      and not (g.day::date = any(coalesce(y.public_holidays, array[]::date[])))
      and public.is_staff_workday(y.id, g.day::date)), 0)::numeric as days_taken,
    coalesce((select sum(1) from public.leave_request l cross join lateral generate_series(l.from_date, l.to_date, interval '1 day') g(day)
      where l.staff_user_id = y.id and l.status = 'approved' and l.leave_type = 'annual_leave'
      and g.day::date > (now() at time zone 'Africa/Kampala')::date
      and g.day::date >= y.year_start and g.day::date < (y.year_start + interval '1 year')::date
      and not (g.day::date = any(coalesce(y.public_holidays, array[]::date[])))
      and public.is_staff_workday(y.id, g.day::date)), 0)::numeric as days_approved_upcoming,
    coalesce((select sum(1) from public.leave_request l cross join lateral generate_series(l.from_date, l.to_date, interval '1 day') g(day)
      where l.staff_user_id = y.id and l.status = 'requested' and l.leave_type = 'annual_leave'
      and g.day::date >= y.year_start and g.day::date < (y.year_start + interval '1 year')::date
      and not (g.day::date = any(coalesce(y.public_holidays, array[]::date[])))
      and public.is_staff_workday(y.id, g.day::date)), 0)::numeric as days_pending
  from years y
)
select id as staff_user_id, location_id, full_name as staff_name, role, year_start as leave_year_start,
  entitlement_days, days_taken, days_approved_upcoming, days_pending,
  case when entitlement_days is null then null else greatest(0, entitlement_days - days_taken - days_approved_upcoming) end as days_remaining
from balances;

revoke all on public.work_hours_policy, public.annual_leave_policy, public.annual_leave_entitlement_override, public.attendance_break_period from public, anon, authenticated;
revoke all on public.hr_attendance_daily, public.hr_leave_balance from public, anon, authenticated;
grant select on public.hr_attendance_daily, public.hr_leave_balance to service_role;
grant all on public.work_hours_policy, public.annual_leave_policy, public.annual_leave_entitlement_override, public.attendance_break_period to service_role;
grant execute on function public.is_staff_workday(uuid,date) to service_role;
revoke all on function public.is_staff_workday(uuid,date) from public, anon, authenticated;

create or replace function public.save_work_hours_policy(
  p_actor_user_id uuid, p_standard_start time, p_standard_end time,
  p_late_grace_minutes smallint, p_early_departure_grace_minutes smallint,
  p_working_days smallint[], p_role_overrides jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare actor public.app_user%rowtype; old_policy public.work_hours_policy%rowtype; new_id uuid;
begin
  select * into actor from public.app_user where id=p_actor_user_id and status='active' and role='hr';
  if actor.id is null then raise exception 'Only active HR can change working hours policy' using errcode='42501'; end if;
  if p_standard_end <= p_standard_start or p_late_grace_minutes not between 0 and 240 or p_early_departure_grace_minutes not between 0 and 240 or cardinality(p_working_days)=0 then raise exception 'Invalid working hours policy' using errcode='22023'; end if;
  select * into old_policy from public.work_hours_policy where location_id=actor.location_id and effective_from <= (now() at time zone 'Africa/Kampala')::date order by effective_from desc limit 1;
  insert into public.work_hours_policy (organization_id,location_id,effective_from,standard_start,standard_end,late_grace_minutes,early_departure_grace_minutes,working_days,role_overrides,updated_by)
  values (actor.organization_id,actor.location_id,(now() at time zone 'Africa/Kampala')::date,p_standard_start,p_standard_end,p_late_grace_minutes,p_early_departure_grace_minutes,p_working_days,coalesce(p_role_overrides,'{}'::jsonb),actor.id)
  on conflict (location_id,effective_from) do update set standard_start=excluded.standard_start,standard_end=excluded.standard_end,late_grace_minutes=excluded.late_grace_minutes,early_departure_grace_minutes=excluded.early_departure_grace_minutes,working_days=excluded.working_days,role_overrides=excluded.role_overrides,updated_by=excluded.updated_by
  returning id into new_id;
  insert into public.audit_log (organization_id,location_id,actor_id,actor_role,action,entity_type,entity_id,category,reason,before,after)
  values(actor.organization_id,actor.location_id,actor.id,'hr','WORK_HOURS_POLICY_UPDATED','work_hours_policy',new_id::text,'people'::public.audit_category,'Updated working hours for future attendance days',to_jsonb(old_policy),jsonb_build_object('standard_start',p_standard_start,'standard_end',p_standard_end,'late_grace_minutes',p_late_grace_minutes,'early_departure_grace_minutes',p_early_departure_grace_minutes,'working_days',p_working_days,'role_overrides',coalesce(p_role_overrides,'{}'::jsonb)));
  return jsonb_build_object('success',true,'policy_id',new_id);
end $$;

