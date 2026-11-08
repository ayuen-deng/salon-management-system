-- Receipt contact details and footer stay blank until an owner configures them.
create sequence if not exists public.receipt_no_seq start with 1001;

create table if not exists public.receipt (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.location(id) on delete cascade,
  visit_id uuid not null references public.visit(id) on delete cascade,
  receipt_no text not null unique,
  issued_at timestamptz not null default now(),
  issued_by uuid not null references public.app_user(id),
  snapshot jsonb not null default '{}'::jsonb,
  print_count int not null default 1,
  last_printed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.receipt enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'receipt' and policyname = 'receipt_select'
  ) then
    create policy receipt_select on public.receipt for select using (
      (select role from public.app_user where id = auth.uid()) in ('owner', 'manager', 'receptionist')
    );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'receipt' and policyname = 'receipt_manage'
  ) then
    create policy receipt_manage on public.receipt for all using (
      (select role from public.app_user where id = auth.uid()) in ('manager', 'receptionist')
    );
  end if;
end $$;

update public.app_setting
set value = '""'::jsonb
where key in ('receipt_address', 'receipt_phone', 'receipt_footer')
  and value in (
    '"High Street, Mbarara, Uganda"'::jsonb,
    '"+256 772 123 456"'::jsonb,
    '"Thank you for visiting Mzuri Unisex Salon!"'::jsonb
  );

insert into public.app_setting (location_id, key, value)
values (
  'b0000000-0000-0000-0000-000000000001',
  'receipt_fiscal_disclaimer_enabled',
  'true'::jsonb
)
on conflict (location_id, key) do nothing;

create unique index if not exists idx_receipt_one_per_visit
  on public.receipt (visit_id);

create or replace function public.mark_receipt_reprint(
  p_visit_id uuid,
  p_actor_id uuid,
  p_actor_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt public.receipt%rowtype;
  v_actor_role text;
  v_print_count integer;
  v_reprinted_at timestamptz := now();
begin
  select u.role::text
    into v_actor_role
    from public.app_user u
   where u.id = p_actor_id
     and u.status = 'active';

  if v_actor_role is null
     or v_actor_role <> p_actor_role
     or v_actor_role not in ('receptionist', 'manager') then
    raise exception 'forbidden: receipt reprint requires an active receptionist or manager';
  end if;

  select r.*
    into v_receipt
    from public.receipt r
   where r.visit_id = p_visit_id
   for update;

  if not found then
    raise exception 'not_found: receipt does not exist for visit %', p_visit_id;
  end if;

  v_print_count := v_receipt.print_count + 1;

  update public.receipt
     set print_count = v_print_count,
         last_printed_at = v_reprinted_at
   where id = v_receipt.id;

  insert into public.audit_log (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    category,
    reason,
    before,
    after
  ) values (
    p_actor_id,
    v_actor_role,
    'RECEIPT_REPRINTED',
    'receipt',
    v_receipt.receipt_no,
    'money'::public.audit_category,
    'Receipt ' || v_receipt.receipt_no || ' reprinted',
    jsonb_build_object('print_count', v_receipt.print_count),
    jsonb_build_object('print_count', v_print_count, 'reprinted_at', v_reprinted_at)
  );

  return jsonb_build_object(
    'print_count', v_print_count,
    'reprinted_at', v_reprinted_at
  );
end;
$$;

revoke all on function public.mark_receipt_reprint(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.mark_receipt_reprint(uuid, uuid, text) to service_role;
