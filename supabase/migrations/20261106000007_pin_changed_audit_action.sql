-- The PIN finalization RPC appends a PIN_CHANGED audit row. Register its
-- category so the audit guard accepts that event during first-time setup.
insert into public.audit_action_category (action, category)
values ('PIN_CHANGED', 'access')
on conflict (action) do nothing;
