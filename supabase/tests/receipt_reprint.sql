begin;

select plan(3);

select has_function(
  'public',
  'mark_receipt_reprint',
  array['uuid', 'uuid', 'text'],
  'receipt reprint uses a database function'
);

select ok(
  has_function_privilege('service_role', 'public.mark_receipt_reprint(uuid, uuid, text)', 'EXECUTE'),
  'service role can invoke the receipt reprint function'
);

select ok(
  not has_function_privilege('authenticated', 'public.mark_receipt_reprint(uuid, uuid, text)', 'EXECUTE'),
  'authenticated clients cannot bypass the server authorization check'
);

select * from finish();
rollback;
