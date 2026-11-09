create extension if not exists pgtap with schema extensions;

begin;

select extensions.plan(7);

select extensions.ok(
  to_regclass('public.hr_attendance_daily') is not null
  and to_regclass('public.hr_leave_balance') is not null,
  'HR attendance and leave balance views exist'
);

select extensions.ok(
  to_regclass('public.work_hours_policy') is not null
  and to_regclass('public.annual_leave_policy') is not null
  and to_regclass('public.attendance_break_period') is not null,
  'effective dated policies and break facts exist'
);

select extensions.ok(
  to_regprocedure('public.save_work_hours_policy(uuid,time,time,smallint,smallint,smallint[],jsonb)') is not null
  and to_regprocedure('public.save_annual_leave_policy(uuid,jsonb,smallint,smallint,date[])') is not null
  and to_regprocedure('public.save_person_leave_entitlement(uuid,uuid,numeric)') is not null,
  'HR policy update RPCs exist'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.save_work_hours_policy(uuid,time,time,smallint,smallint,smallint[],jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.save_work_hours_policy(uuid,time,time,smallint,smallint,smallint[],jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.save_annual_leave_policy(uuid,jsonb,smallint,smallint,date[])', 'execute')
  and not has_function_privilege('authenticated', 'public.save_annual_leave_policy(uuid,jsonb,smallint,smallint,date[])', 'execute'),
  'policy writes are restricted to the server role'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.work_hours_policy', 'select')
  and not has_table_privilege('authenticated', 'public.annual_leave_policy', 'select')
  and has_table_privilege('service_role', 'public.work_hours_policy', 'select')
  and has_table_privilege('service_role', 'public.annual_leave_policy', 'select'),
  'policy tables are isolated from authenticated clients'
);

select extensions.ok(
  exists (select 1 from public.annual_leave_policy where entitlement_by_role = '{}'::jsonb)
  and exists (select 1 from public.annual_leave_policy where leave_year_start_month = 1 and leave_year_start_day = 1),
  'initial policy has no assumed entitlement and starts the leave year on January 1'
);

select extensions.ok(
  exists (select 1 from public.audit_action_category where action = 'WORK_HOURS_POLICY_UPDATED' and category = 'people')
  and exists (select 1 from public.audit_action_category where action = 'LEAVE_POLICY_UPDATED' and category = 'people')
  and exists (select 1 from public.audit_action_category where action = 'LEAVE_ENTITLEMENT_UPDATED' and category = 'people'),
  'working hours and leave policy changes are classified as people audit events'
);

select * from extensions.finish();
rollback;
