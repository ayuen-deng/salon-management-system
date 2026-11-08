create extension if not exists pgtap with schema extensions;

begin;

select plan(5);

select has_view('public', 'staff_presence_today', 'shared daily staff presence view exists');

select ok(
  has_table_privilege('service_role', 'public.staff_presence_today', 'select')
  and not has_table_privilege('authenticated', 'public.staff_presence_today', 'select'),
  'presence snapshot is server-side only'
);

select ok(
  not exists (
    select 1 from public.staff_presence_today
    where status not in ('present', 'on_break', 'out', 'not_present', 'on_leave')
  ),
  'presence view emits only the five shared statuses'
);

select has_trigger(
  'public', 'audit_log', 'trg_enforce_audit_action_category',
  'audit action category is enforced on insert'
);

select ok(
  exists (select 1 from public.audit_action_category where action = 'EXPORT_CLIENT_PROFILE' and category = 'customer')
  and exists (select 1 from public.audit_action_category where action = 'MANAGER_REVOKE_STAFF' and category = 'access'),
  'sensitive actions have canonical categories'
);

select * from finish();
rollback;
