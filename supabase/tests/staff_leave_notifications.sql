create extension if not exists pgtap with schema extensions;

begin;

select extensions.plan(8);

select extensions.ok(
  to_regprocedure('public.preview_my_leave_request(uuid,date,date,text)') is not null
  and to_regprocedure('public.request_my_leave(uuid,date,date,text)') is not null
  and to_regprocedure('public.cancel_my_leave_request(uuid,uuid)') is not null,
  'staff leave preview, request, and cancellation RPCs exist'
);

select extensions.ok(
  has_function_privilege('service_role','public.request_my_leave(uuid,date,date,text)','execute')
  and not has_function_privilege('authenticated','public.request_my_leave(uuid,date,date,text)','execute')
  and has_function_privilege('service_role','public.cancel_my_leave_request(uuid,uuid)','execute')
  and not has_function_privilege('authenticated','public.cancel_my_leave_request(uuid,uuid)','execute'),
  'staff leave writes run only through server-authorized RPCs'
);

select extensions.ok(
  not has_table_privilege('authenticated','public.leave_request','insert')
  and not has_table_privilege('authenticated','public.leave_request','update')
  and not has_table_privilege('authenticated','public.leave_request','delete')
  and has_table_privilege('authenticated','public.leave_request','select'),
  'staff can read permitted leave rows but cannot bypass request validation'
);

select extensions.ok(
  exists(select 1 from pg_catalog.pg_enum e join pg_catalog.pg_type t on t.oid=e.enumtypid
    where t.typname='leave_request_status' and e.enumlabel='cancelled'),
  'leave status supports cancellation'
);

select extensions.ok(
  exists(select 1 from pg_catalog.pg_trigger where tgname='trg_notify_leave_changes' and not tgisinternal),
  'leave status changes create in-app notifications'
);

select extensions.ok(
  exists(select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='notification'
    and policyname='notification_own_in_app_read' and qual ilike '%recipient_user_id%auth.uid%'),
  'notification row access is scoped to the signed-in recipient'
);

select extensions.ok(
  to_regprocedure('public.mark_my_notification_read(uuid,uuid)') is not null
  and has_function_privilege('service_role','public.mark_my_notification_read(uuid,uuid)','execute')
  and not has_function_privilege('authenticated','public.mark_my_notification_read(uuid,uuid)','execute'),
  'notification read state is server-stamped and user-scoped'
);

select extensions.ok(
  exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notification'),
  'in-app notifications are available through realtime'
);

select * from extensions.finish();
rollback;
