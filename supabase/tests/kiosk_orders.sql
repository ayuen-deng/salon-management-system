create extension if not exists pgtap with schema extensions;

begin;
select plan(10);

select ok(
  exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'visit_status' and e.enumlabel = 'expired'),
  'expired visit status is available'
);

select ok(
  (select is_nullable = 'YES' from information_schema.columns where table_schema = 'public' and table_name = 'visit' and column_name = 'customer_id')
  and (select is_nullable = 'YES' from information_schema.columns where table_schema = 'public' and table_name = 'visit' and column_name = 'ticket_code')
  and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'visit' and column_name = 'order_code'),
  'pending kiosk visits can omit customer and queue ticket while retaining an order code'
);

select ok(
  to_regprocedure('public.register_kiosk_device_session(text,text)') is not null
  and to_regprocedure('public.create_kiosk_order(text,text,text,text,jsonb)') is not null
  and to_regprocedure('public.expire_kiosk_orders()') is not null,
  'pairing, order creation, and expiry RPCs exist'
);

select ok(
  has_function_privilege('service_role', 'public.register_kiosk_device_session(text,text)', 'execute')
  and not has_function_privilege('anon', 'public.register_kiosk_device_session(text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.register_kiosk_device_session(text,text)', 'execute')
  and has_function_privilege('service_role', 'public.create_kiosk_order(text,text,text,text,jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.create_kiosk_order(text,text,text,text,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.create_kiosk_order(text,text,text,text,jsonb)', 'execute'),
  'kiosk RPCs are callable only by the server service role'
);

select ok(
  not has_table_privilege('anon', 'public.kiosk_device_session', 'select')
  and not has_table_privilege('authenticated', 'public.kiosk_device_session', 'select')
  and not has_table_privilege('anon', 'public.kiosk_order_request', 'select')
  and not has_table_privilege('authenticated', 'public.kiosk_order_request', 'select'),
  'device session and idempotency rows are not client-readable'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.kiosk_device_session'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.kiosk_order_request'::regclass),
  'private kiosk tables enforce row-level security'
);

select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'visit' and policyname = 'visit_select')
  and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'visit_service' and policyname = 'visit_service_select'),
  'visit and line read policies are defined with the kiosk isolation migration'
);

select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'visit_business_day_order_code_uidx')
  and exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'visit_kiosk_pending_created_idx'),
  'K order numbers are unique within a business day and pending orders are indexed'
);

select ok(
  exists (select 1 from public.app_setting where key = 'kiosk_order_expiry_minutes' and value = '20'::jsonb),
  'kiosk expiry defaults to 20 minutes'
);

select ok(
  exists (select 1 from cron.job where jobname = 'expire-kiosk-orders' and schedule = '* * * * *'),
  'unpaid kiosk order expiry is scheduled every minute'
);

select * from finish();
rollback;
