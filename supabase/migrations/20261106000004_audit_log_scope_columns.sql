-- HR policy and leave audit writes are tenant/location scoped. The original
-- audit_log table predated those fields, so add them without rewriting history.
alter table public.audit_log
  add column if not exists organization_id uuid,
  add column if not exists location_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.audit_log'::regclass
      and conname = 'audit_log_organization_id_fkey'
  ) then
    alter table public.audit_log
      add constraint audit_log_organization_id_fkey
      foreign key (organization_id) references public.organization(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.audit_log'::regclass
      and conname = 'audit_log_location_id_fkey'
  ) then
    alter table public.audit_log
      add constraint audit_log_location_id_fkey
      foreign key (location_id) references public.location(id) on delete set null;
  end if;
end;
$$;

-- Keep existing audit rows immutable. Fill scope only on future insertions when
-- a caller omits it, using the actor first and the business day as a fallback.
do $migration$
begin
  if to_regprocedure('public.populate_audit_log_scope()') is null then
    execute $function$
      create function public.populate_audit_log_scope()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $body$
      declare
        actor_organization_id uuid;
        actor_location_id uuid;
        day_organization_id uuid;
        day_location_id uuid;
      begin
        if new.actor_id is not null then
          select u.organization_id, u.location_id
            into actor_organization_id, actor_location_id
          from public.app_user u
          where u.id = new.actor_id;
        end if;

        if new.business_day_id is not null then
          select d.organization_id, d.location_id
            into day_organization_id, day_location_id
          from public.business_day d
          where d.id = new.business_day_id;
        end if;

        new.organization_id := coalesce(new.organization_id, actor_organization_id, day_organization_id);
        new.location_id := coalesce(new.location_id, actor_location_id, day_location_id);
        return new;
      end;
      $body$;
    $function$;
  end if;
end;
$migration$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.audit_log'::regclass
      and tgname = 'trg_populate_audit_log_scope'
      and not tgisinternal
  ) then
    create trigger trg_populate_audit_log_scope
    before insert on public.audit_log
    for each row execute function public.populate_audit_log_scope();
  end if;
end;
$$;

create index if not exists audit_log_organization_at_idx
  on public.audit_log (organization_id, at desc);
create index if not exists audit_log_location_at_idx
  on public.audit_log (location_id, at desc);
