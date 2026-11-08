-- Phase 2: manager/HR skill assignment and auditable HR report exports.

insert into public.audit_action_category (action, category) values
  ('STAFF_SKILLS_ASSIGNED', 'people'),
  ('HR_REPORT_EXPORTED', 'people')
on conflict (action) do update set category = excluded.category;

create or replace function public.set_staff_skills(
  p_actor_user_id uuid,
  p_staff_user_id uuid,
  p_service_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.app_user%rowtype;
  target public.app_user%rowtype;
  old_ids uuid[];
  new_ids uuid[];
begin
  select * into actor from public.app_user where id = p_actor_user_id and status = 'active';
  if actor.id is null or actor.role not in ('owner', 'manager', 'hr') then
    raise exception 'Only active owners, managers, and HR can assign staff skills' using errcode = '42501';
  end if;

  select * into target from public.app_user
  where id = p_staff_user_id and role = 'staff' and status = 'active'
    and location_id = actor.location_id;
  if target.id is null then
    raise exception 'Target must be an active staff member at the same location' using errcode = '22023';
  end if;

  select coalesce(array_agg(ss.service_id order by ss.service_id), array[]::uuid[])
    into old_ids from public.staff_skill ss where ss.staff_user_id = target.id;
  select coalesce(array_agg(distinct requested.service_id order by requested.service_id), array[]::uuid[])
    into new_ids from unnest(coalesce(p_service_ids, array[]::uuid[])) as requested(service_id);

  if cardinality(new_ids) > 0 and (
    select count(*) from public.service s
    where s.id = any(new_ids) and s.location_id = actor.location_id and s.active
  ) <> cardinality(new_ids) then
    raise exception 'Every assigned service must be active and at the same location' using errcode = '22023';
  end if;

  delete from public.staff_skill where staff_user_id = target.id;
  insert into public.staff_skill (staff_user_id, service_id)
  select target.id, requested.service_id from unnest(new_ids) as requested(service_id);

  insert into public.audit_log (
    actor_id, actor_role, action, entity_type, entity_id, category, reason, before, after
  ) values (
    actor.id, actor.role::text, 'STAFF_SKILLS_ASSIGNED', 'app_user', target.id::text,
    'people'::public.audit_category, 'Staff skills updated',
    jsonb_build_object('service_ids', old_ids),
    jsonb_build_object('service_ids', new_ids, 'skill_count', cardinality(new_ids))
  );

  return jsonb_build_object('success', true, 'skill_count', cardinality(new_ids));
end;
$$;

create or replace function public.set_service_staff_skills(
  p_actor_user_id uuid,
  p_service_id uuid,
  p_staff_user_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.app_user%rowtype;
  target public.app_user%rowtype;
  current_ids uuid[];
  next_ids uuid[];
  wanted uuid[] := coalesce(p_staff_user_ids, array[]::uuid[]);
  changed_count integer := 0;
begin
  select * into actor from public.app_user where id = p_actor_user_id and status = 'active';
  if actor.id is null or actor.role not in ('owner', 'manager', 'hr') then
    raise exception 'Only active owners, managers, and HR can assign staff skills' using errcode = '42501';
  end if;
  if not exists (select 1 from public.service where id = p_service_id and location_id = actor.location_id and active) then
    raise exception 'Service must be active at the same location' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(wanted) requested(id)
    where not exists (select 1 from public.app_user u where u.id = requested.id and u.role = 'staff' and u.status = 'active' and u.location_id = actor.location_id)
  ) then
    raise exception 'Only active staff at the same location can receive a skill' using errcode = '22023';
  end if;

  for target in select * from public.app_user
    where location_id = actor.location_id and role = 'staff' and status = 'active'
  loop
    select coalesce(array_agg(service_id order by service_id), array[]::uuid[])
      into current_ids from public.staff_skill where staff_user_id = target.id and service_id <> p_service_id;
    if target.id = any(wanted) then
      next_ids := current_ids || p_service_id;
    else
      next_ids := current_ids;
    end if;
    perform public.set_staff_skills(actor.id, target.id, next_ids);
    changed_count := changed_count + 1;
  end loop;

  return jsonb_build_object('success', true, 'staff_updated', changed_count);
end;
$$;

revoke all on function public.set_staff_skills(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.set_service_staff_skills(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.set_staff_skills(uuid, uuid, uuid[]) to service_role;
grant execute on function public.set_service_staff_skills(uuid, uuid, uuid[]) to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'staff_skill'
    ) then
    execute 'alter publication supabase_realtime add table public.staff_skill';
  end if;
end $$;
