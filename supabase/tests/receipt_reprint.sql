begin;

select extensions.plan(3);

select extensions.has_function(
  'public',
  'mark_receipt_reprint',
  array['uuid', 'uuid', 'text'],
  'receipt reprint uses a database function'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.mark_receipt_reprint(uuid, uuid, text)', 'EXECUTE'),
  'service role can invoke the receipt reprint function'
);

select extensions.ok(
  not has_function_privilege('authenticated', 'public.mark_receipt_reprint(uuid, uuid, text)', 'EXECUTE'),
  'authenticated clients cannot bypass the server authorization check'
);

select * from extensions.finish();
rollback;
