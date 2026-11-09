create extension if not exists pgtap with schema extensions;

begin;

select extensions.plan(6);

select extensions.ok(
  to_regprocedure('public.get_staff_performance_report(uuid,date,date,text,uuid)') is not null,
  'shared staff performance report function exists'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.get_staff_performance_report(uuid,date,date,text,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.get_staff_performance_report(uuid,date,date,text,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_staff_performance_report(uuid,date,date,text,uuid)', 'execute'),
  'performance report execution is server-only'
);

select extensions.ok(
  to_regclass('public.hr_attendance_daily') is not null,
  'performance report is backed by the shared attendance view'
);

select extensions.is(
  (public.get_staff_performance_report(
    (select id from public.app_user where status = 'active' and role = 'hr' limit 1),
    (now() at time zone 'Africa/Kampala')::date - 365,
    (now() at time zone 'Africa/Kampala')::date,
    null,
    null
  )->'team'->>'services_completed')::int,
  (select count(*)::int
   from public.visit_service vs
   join public.visit v on v.id = vs.visit_id
   join public.business_day bd on bd.id = v.business_day_id
   join public.app_user u on u.id = vs.staff_user_id
   where u.status = 'active' and u.role = 'staff'
     and u.location_id = (select location_id from public.app_user where status = 'active' and role = 'hr' limit 1)
     and v.status in ('paid', 'closed') and v.total_final_ugx > 0
     and bd.business_date between (now() at time zone 'Africa/Kampala')::date - 365 and (now() at time zone 'Africa/Kampala')::date
     and vs.status = 'done' and vs.times_source = 'measured' and v.entered_via = 'live'
     and vs.started_at is not null and vs.ended_at is not null and vs.ended_at > vs.started_at
     and extract(epoch from (vs.ended_at - vs.started_at)) / 60.0 <= 300
     and exists (select 1 from public.visit_service x where x.visit_id = v.id and x.price_source <> 'complimentary')
     and not exists (select 1 from public.payment p join public.payment_adjustment pa on pa.payment_id = p.id where p.visit_id = v.id and pa.adjustment_type in ('refund', 'void'))),
  'service total matches measured eligible database lines'
);

select extensions.ok(
  public.get_staff_performance_report(
    (select id from public.app_user where status = 'active' and role = 'hr' limit 1),
    (now() at time zone 'Africa/Kampala')::date - 365,
    (now() at time zone 'Africa/Kampala')::date,
    null,
    null
  )::text !~* 'customer_id|phone|revenue|ugx|commission_base_percent|list_price_ugx',
  'report contains no customer identities or financial/pay data'
);

select extensions.ok(
  not exists (
    select 1
    from jsonb_array_elements(public.get_staff_performance_report(
      (select id from public.app_user where status = 'active' and role = 'hr' limit 1),
      (now() at time zone 'Africa/Kampala')::date - 365,
      (now() at time zone 'Africa/Kampala')::date,
      null,
      null
    )->'people') p
    where p->>'role' <> 'staff'
      and (p->'services_completed' <> 'null'::jsonb or p->'customers_served' <> 'null'::jsonb
        or p->'avg_service_minutes' <> 'null'::jsonb or p->'measured_minutes' <> 'null'::jsonb
        or p->'target_goal' <> 'null'::jsonb or p->'target_current' <> 'null'::jsonb)
  ),
  'non-service roles expose attendance measures only'
);

select * from extensions.finish();
rollback;
