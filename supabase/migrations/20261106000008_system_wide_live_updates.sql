-- Broadcast only table names so clients can refresh authorized queries via RLS.
-- Never include row contents, identifiers, or financial/people data in Realtime payloads.
create or replace function public.broadcast_salon_table_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, realtime, public
as $$
begin
  perform realtime.send(
    jsonb_build_object('table', TG_TABLE_NAME),
    'salon_data_changed',
    'salon:changes',
    true
  );
  return null;
end;
$$;

revoke all on function public.broadcast_salon_table_change() from public, anon, authenticated;

do $$
declare
  table_row record;
begin
  for table_row in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname not in ('schema_migrations')
  loop
    execute format('drop trigger if exists salon_live_change on public.%I', table_row.relname);
    execute format(
      'create trigger salon_live_change after insert or update or delete on public.%I for each statement execute function public.broadcast_salon_table_change()',
      table_row.relname
    );
  end loop;
end;
$$;

drop policy if exists salon_authenticated_live_changes on realtime.messages;
create policy salon_authenticated_live_changes
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and realtime.topic() = 'salon:changes'
);
