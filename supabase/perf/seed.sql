-- Five-year synthetic dataset for local/scratch performance work only.
-- Never run this SQL against the salon's linked or production Supabase project.
begin;

create table if not exists public.__perf_seed_marker (
  marker text primary key,
  seeded_at timestamptz not null default now()
);
insert into public.__perf_seed_marker(marker) values ('mzuri-performance-v1');

do $$
begin
  if not exists (select 1 from public.organization where id = 'a0000000-0000-0000-0000-000000000001')
     or not exists (select 1 from public.location where id = 'b0000000-0000-0000-0000-000000000001')
     or not exists (select 1 from public.app_user where id = 'c0000000-0000-0000-0000-000000000002')
     or not exists (select 1 from public.service_variant limit 1) then
    raise exception 'Run the schema and standard seed migrations in this scratch database first.';
  end if;
end $$;

insert into public.app_user(id, organization_id, location_id, full_name, display_name, phone, role, status)
select (md5('mzuri-perf-staff-' || n))::uuid,
       'a0000000-0000-0000-0000-000000000001'::uuid,
       'b0000000-0000-0000-0000-000000000001'::uuid,
       'Synthetic Performance Staff ' || lpad(n::text, 2, '0'),
       'Perf Staff ' || lpad(n::text, 2, '0'),
       '+256790' || lpad(n::text, 6, '0'),
       'staff'::app_role,
       'active'
from generate_series(1, 32) as n;

insert into public.business_day(organization_id, location_id, business_date, status, opened_by, opened_at, closed_at, closed_by)
select 'a0000000-0000-0000-0000-000000000001'::uuid,
       'b0000000-0000-0000-0000-000000000001'::uuid,
       d::date,
       'closed'::business_day_status,
       'c0000000-0000-0000-0000-000000000002'::uuid,
       d::date + time '08:00',
       d::date + time '20:00',
       'c0000000-0000-0000-0000-000000000002'::uuid
from generate_series(current_date - 1824, current_date, interval '1 day') as d
on conflict (location_id, business_date) do nothing;

insert into public.customer(id, organization_id, location_id, phone_e164, first_name, created_by, created_at, updated_at)
select (md5('mzuri-perf-customer-' || n))::uuid,
       'a0000000-0000-0000-0000-000000000001'::uuid,
       'b0000000-0000-0000-0000-000000000001'::uuid,
       '+256790' || lpad(n::text, 6, '0'),
       'Perf Customer ' || lpad(n::text, 5, '0'),
       'c0000000-0000-0000-0000-000000000004'::uuid,
       now() - ((n % 1825) || ' days')::interval,
       now() - ((n % 1825) || ' days')::interval
from generate_series(1, 30000) as n;

create temporary table perf_refs on commit drop as
select row_number() over (order by c.id)::int as customer_no,
       c.id as customer_id
from public.customer c
where c.first_name like 'Perf Customer %';

insert into public.visit(id, organization_id, location_id, business_day_id, customer_id, status, source, entered_via, ticket_code, queued_at, created_via, total_list_ugx, total_discount_ugx, total_final_ugx, created_at, updated_at)
select (md5('mzuri-perf-visit-' || n))::uuid,
       'a0000000-0000-0000-0000-000000000001'::uuid,
       'b0000000-0000-0000-0000-000000000001'::uuid,
       bd.id,
       c.customer_id,
       'paid'::visit_status,
       'walk_in'::visit_source,
       'live'::entry_method,
       'PERF-' || lpad(n::text, 6, '0'),
       bd.business_date::timestamptz + time '09:00' + ((n % 600)::text || ' seconds')::interval,
       'receptionist'::creation_surface,
       10000,
       0,
       10000,
       bd.business_date::timestamptz + time '09:00' + ((n % 600)::text || ' seconds')::interval,
       bd.business_date::timestamptz + time '09:30' + ((n % 600)::text || ' seconds')::interval
from generate_series(1, 150000) as n
join perf_refs c on c.customer_no = ((n - 1) % 30000) + 1
join public.business_day bd on bd.location_id = 'b0000000-0000-0000-0000-000000000001'::uuid
  and bd.business_date = current_date - 1824 + ((n - 1) % 1825);

insert into public.visit_service(id, visit_id, service_variant_id, staff_user_id, assignment_mode, sequence_no, status, list_price_ugx, discount_ugx, final_price_ugx, price_source, started_at, ended_at, created_at)
select (md5('mzuri-perf-line-' || n))::uuid,
       v.id,
       sv.id,
       staff.id,
       'any'::assignment_mode,
       1,
       'done'::service_line_status,
       10000,
       0,
       10000,
       'catalogue'::price_source_type,
       v.created_at,
       v.created_at + interval '30 minutes',
       v.created_at
from generate_series(1, 150000) as n
join public.visit v on v.id = (md5('mzuri-perf-visit-' || n))::uuid
join public.service_variant sv on sv.id = (select id from public.service_variant order by id limit 1)
join lateral (
  select id from public.app_user
  where display_name like 'Perf Staff %'
  order by id limit 1 offset ((n - 1) % 32)
) staff on true;

insert into public.payment(organization_id, location_id, visit_id, business_day_id, method, provider, amount_ugx, status, confirmation_level, idempotency_key, recorded_by, created_at)
select v.organization_id,
       v.location_id,
       v.id,
       v.business_day_id,
       case when n % 4 = 0 then 'mobile_money'::payment_method else 'cash'::payment_method end,
       'manual',
       10000,
       'confirmed',
       'attested'::confirmation_level,
       'perf-payment-' || n,
       'c0000000-0000-0000-0000-000000000004'::uuid,
       v.created_at + interval '30 minutes'
from generate_series(1, 150000) as n
join public.visit v on v.id = (md5('mzuri-perf-visit-' || n))::uuid;

insert into public.appointment(organization_id, location_id, customer_id, staff_user_id, service_id, starts_at, expected_minutes, status, created_at)
select 'a0000000-0000-0000-0000-000000000001'::uuid,
       'b0000000-0000-0000-0000-000000000001'::uuid,
       c.customer_id,
       staff.id,
       (select service_id from public.service_variant order by id limit 1),
       now() - ((n % 1825) || ' days')::interval,
       30,
       case when n % 5 = 0 then 'arrived'::appointment_status else 'booked'::appointment_status end,
       now() - ((n % 1825) || ' days')::interval
from generate_series(1, 20000) as n
join perf_refs c on c.customer_no = ((n - 1) % 30000) + 1
join lateral (
  select id from public.app_user
  where display_name like 'Perf Staff %'
  order by id limit 1 offset ((n - 1) % 32)
) staff on true;

insert into public.attendance(organization_id, location_id, staff_user_id, business_date, clock_in, clock_out, absence_type)
select 'a0000000-0000-0000-0000-000000000001'::uuid,
       'b0000000-0000-0000-0000-000000000001'::uuid,
       staff.id,
       current_date - 1824 + ((n - 1) % 1825),
       (current_date - 1824 + ((n - 1) % 1825))::timestamptz + time '08:00',
       (current_date - 1824 + ((n - 1) % 1825))::timestamptz + time '17:00',
       'none'::attendance_absence_type
from generate_series(1, 60000) as n
join lateral (
  select id from public.app_user
  where display_name like 'Perf Staff %'
  order by id limit 1 offset ((n - 1) % 32)
) staff on true;

insert into public.audit_log(organization_id, location_id, actor_id, actor_role, action, entity_type, entity_id, after, business_day_id, category, at)
select 'a0000000-0000-0000-0000-000000000001'::uuid,
       'b0000000-0000-0000-0000-000000000001'::uuid,
       'c0000000-0000-0000-0000-000000000002'::uuid,
       'manager',
       'PERF_SEED_EVENT',
       'performance_fixture',
       n::text,
       jsonb_build_object('synthetic', true),
       bd.id,
       'operations'::audit_category,
       now() - ((n % 1825) || ' days')::interval
from generate_series(1, 100000) as n
join public.business_day bd on bd.location_id = 'b0000000-0000-0000-0000-000000000001'::uuid
  and bd.business_date = current_date - 1824 + ((n - 1) % 1825);

commit;

select 'customers' as dataset, count(*) as rows from public.customer where first_name like 'Perf Customer %'
union all select 'visits', count(*) from public.visit where ticket_code like 'PERF-%'
union all select 'payments', count(*) from public.payment where idempotency_key like 'perf-payment-%'
union all select 'appointments', count(*) from public.appointment where created_at < now() and customer_id in (select id from public.customer where first_name like 'Perf Customer %')
union all select 'attendance', count(*) from public.attendance where staff_user_id in (select id from public.app_user where display_name like 'Perf Staff %')
union all select 'audit', count(*) from public.audit_log where action = 'PERF_SEED_EVENT';
