-- Paired kiosks can learn the public-safe day state without reading salon data.
create or replace function public.kiosk_business_day_status(p_session_hash text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  kiosk record;
  current_day date := (now() at time zone 'Africa/Kampala')::date;
begin
  select d.id, d.location_id, l.opening_hours
    into kiosk
  from public.kiosk_device_session s
  join public.device d on d.id = s.device_id
  join public.location l on l.id = d.location_id
  where s.session_hash = p_session_hash
    and s.expires_at > now()
    and d.revoked_at is null
    and d.kind = 'reception_tablet'
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'code', 'DEVICE_SESSION_REQUIRED');
  end if;

  return jsonb_build_object(
    'success', true,
    'is_open', exists (
      select 1 from public.business_day b
      where b.location_id = kiosk.location_id
        and b.business_date = current_day
        and b.status = 'open'
    ),
    'business_date', current_day,
    'expected_open', coalesce(kiosk.opening_hours->>'open', '08:00')
  );
end;
$$;

revoke all on function public.kiosk_business_day_status(text) from public, anon, authenticated;
grant execute on function public.kiosk_business_day_status(text) to service_role;

create or replace function public.list_reception_kiosk_orders_page(
  p_actor_id uuid, p_status text default 'waiting', p_search text default '',
  p_limit integer default 50, p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor public.app_user%rowtype;
  result jsonb;
  query_text text := lower(btrim(coalesce(p_search, '')));
begin
  select * into actor from public.app_user where id = p_actor_id and status = 'active';
  if not found or actor.role not in ('manager','receptionist') then
    raise exception 'Only reception or management can view kiosk orders' using errcode = '42501';
  end if;
  if p_status not in ('waiting','handling','expired','cancelled') then
    raise exception 'Invalid kiosk order status' using errcode = '22023';
  end if;

  with filtered as (
    select v.*, u.display_name as claimant_name
    from public.visit v
    left join public.app_user u on u.id = v.claimed_by
    where v.location_id = actor.location_id
      and v.created_via = 'desk_tablet'
      and case p_status
        when 'waiting' then v.status = 'draft' and (v.claimed_by is null or v.claimed_at <= now() - interval '2 minutes')
        when 'handling' then v.status = 'draft' and v.claimed_by is not null and v.claimed_at > now() - interval '2 minutes'
        when 'expired' then v.status = 'expired'
        when 'cancelled' then v.status = 'cancelled'
      end
      and (query_text = '' or lower(v.order_code || ' ' || v.draft_first_name || ' ' || v.draft_phone_e164) like '%' || query_text || '%')
  ),
  page as (
    select f.*,
      coalesce((select jsonb_agg(jsonb_build_object(
        'variant_name', sv.name, 'service_name', s.name
      ) order by vs.sequence_no) from public.visit_service vs
        join public.service_variant sv on sv.id=vs.service_variant_id
        join public.service s on s.id=sv.service_id where vs.visit_id=f.id), '[]'::jsonb) as services
    from filtered f
    order by f.created_at asc
    limit greatest(1,least(100,coalesce(p_limit,50))) offset greatest(0,coalesce(p_offset,0))
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'order_code', order_code, 'first_name', draft_first_name,
      'phone', draft_phone_e164, 'total_ugx', total_final_ugx, 'created_at', created_at,
      'claimed_by', claimed_by, 'claimed_at', claimed_at, 'claimant_name', claimant_name,
      'status', status, 'services', services
    ) order by created_at asc), '[]'::jsonb)
  ) into result from page;
  return result;
end;
$$;

revoke all on function public.list_reception_kiosk_orders_page(uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.list_reception_kiosk_orders_page(uuid,text,text,integer,integer) to service_role;

create index if not exists visit_kiosk_status_search_idx
  on public.visit (location_id, status, created_at)
  where created_via = 'desk_tablet';

notify pgrst, 'reload schema';
