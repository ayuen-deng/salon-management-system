create extension if not exists pgtap with schema extensions;

begin;

select extensions.plan(4);

select extensions.ok(
  to_regprocedure('public.set_staff_skills(uuid,uuid,uuid[])') is not null
  and to_regprocedure('public.set_service_staff_skills(uuid,uuid,uuid[])') is not null,
  'staff and service skill assignment RPCs exist'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.set_staff_skills(uuid,uuid,uuid[])', 'execute')
  and not has_function_privilege('authenticated', 'public.set_staff_skills(uuid,uuid,uuid[])', 'execute')
  and has_function_privilege('service_role', 'public.set_service_staff_skills(uuid,uuid,uuid[])', 'execute')
  and not has_function_privilege('authenticated', 'public.set_service_staff_skills(uuid,uuid,uuid[])', 'execute'),
  'skill assignment RPCs are restricted to the server role'
);

select extensions.ok(
  exists (select 1 from public.audit_action_category where action = 'STAFF_SKILLS_ASSIGNED' and category = 'people')
  and exists (select 1 from public.audit_action_category where action = 'HR_REPORT_EXPORTED' and category = 'people'),
  'skill changes and HR exports are classified as people data'
);

select extensions.ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'staff_skill'),
  'staff skill changes are available to realtime subscribers'
);

select * from extensions.finish();
rollback;
