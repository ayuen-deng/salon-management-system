-- Kiosk tablets have a paired device token but no authenticated staff session.
-- Announce only that business-day status changed; never publish row contents.
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

  if TG_TABLE_NAME = 'business_day' then
    perform realtime.send(
      '{}'::jsonb,
      'business_day_status_changed',
      'salon:kiosk-day-status',
      false
    );
  end if;

  return null;
end;
$$;

revoke all on function public.broadcast_salon_table_change() from public, anon, authenticated;
