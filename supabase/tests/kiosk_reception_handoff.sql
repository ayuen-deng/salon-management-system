create extension if not exists pgtap with schema extensions;

begin;
select plan(10);

select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='visit' and column_name='claimed_by')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='visit' and column_name='claimed_at'),
  'kiosk drafts retain claim owner and server timestamp'
);

select ok(
  to_regprocedure('public.list_reception_kiosk_orders(uuid)') is not null
  and to_regprocedure('public.claim_reception_kiosk_order(uuid,uuid)') is not null
  and to_regprocedure('public.touch_reception_kiosk_claim(uuid,uuid)') is not null
  and to_regprocedure('public.release_reception_kiosk_order(uuid,uuid)') is not null
  and to_regprocedure('public.cancel_reception_kiosk_order(uuid,uuid,text)') is not null,
  'list, claim, refresh, release and cancel RPCs exist'
);

select ok(
  to_regprocedure('public.confirm_reception_kiosk_order(uuid,uuid,text,text,jsonb,bigint,text,text,text,text,boolean)') is not null,
  'single-transaction kiosk payment RPC exists'
);

select ok(
  has_function_privilege('service_role','public.list_reception_kiosk_orders(uuid)','execute')
  and has_function_privilege('service_role','public.claim_reception_kiosk_order(uuid,uuid)','execute')
  and has_function_privilege('service_role','public.confirm_reception_kiosk_order(uuid,uuid,text,text,jsonb,bigint,text,text,text,text,boolean)','execute'),
  'server role can call the receptionist RPCs'
);

select ok(
  not has_function_privilege('anon','public.confirm_reception_kiosk_order(uuid,uuid,text,text,jsonb,bigint,text,text,text,text,boolean)','execute')
  and not has_function_privilege('authenticated','public.confirm_reception_kiosk_order(uuid,uuid,text,text,jsonb,bigint,text,text,text,text,boolean)','execute'),
  'browser roles cannot confirm kiosk payments directly'
);

select ok(
  exists (select 1 from pg_indexes where schemaname='public' and indexname='visit_kiosk_claim_idx'),
  'pending order claim lookup is indexed'
);

select ok(
  to_regprocedure('public.confirm_close_day(uuid,bigint)') is not null,
  'day-close RPC expires pending kiosk drafts'
);

select ok(
  exists (select 1 from pg_trigger where tgrelid='public.payment'::regclass and not tgisinternal)
  and exists (select 1 from pg_trigger where tgrelid='public.audit_log'::regclass and not tgisinternal),
  'existing immutable payment and audit protections remain installed'
);

select ok(
  (select count(*) = 6 from public.audit_action_category
   where action in ('KIOSK_ORDER_CREATED','KIOSK_ORDER_CLAIMED','KIOSK_ORDER_RELEASED','KIOSK_ORDER_CANCELLED','KIOSK_ORDER_EXPIRED','KIOSK_ORDER_PAYMENT_CONFIRMED'))
  and (select category = 'operations' from public.audit_action_category where action = 'KIOSK_ORDER_CREATED')
  and (select category = 'operations' from public.audit_action_category where action = 'KIOSK_ORDER_CLAIMED')
  and (select category = 'operations' from public.audit_action_category where action = 'KIOSK_ORDER_RELEASED')
  and (select category = 'operations' from public.audit_action_category where action = 'KIOSK_ORDER_CANCELLED')
  and (select category = 'operations' from public.audit_action_category where action = 'KIOSK_ORDER_EXPIRED')
  and (select category = 'money' from public.audit_action_category where action = 'KIOSK_ORDER_PAYMENT_CONFIRMED'),
  'all kiosk handoff audit actions map to one canonical category'
);

select ok(
  to_regprocedure('public.kiosk_business_day_status(text)') is not null
  and has_function_privilege('service_role','public.kiosk_business_day_status(text)','execute')
  and not has_function_privilege('anon','public.kiosk_business_day_status(text)','execute')
  and not has_function_privilege('authenticated','public.kiosk_business_day_status(text)','execute'),
  'only the server can read paired-kiosk business-day status'
);

select * from finish();
rollback;
