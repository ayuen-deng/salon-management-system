-- Migration 00008: Add audience, image_url, subcategory to service; Add tier, premium tracking to customer; Add salon settings

-- 1. Catalogue Enhancements
do $$ begin
  create type service_audience as enum ('men', 'women', 'both');
exception when duplicate_object then null; end $$;

alter table if exists service
  add column if not exists audience service_audience not null default 'both',
  add column if not exists image_url text,
  add column if not exists subcategory text;

-- 2. Customer Premium Tiers
do $$ begin
  create type customer_tier as enum ('regular', 'premium');
exception when duplicate_object then null; end $$;

alter table if exists customer
  add column if not exists tier customer_tier not null default 'regular',
  add column if not exists premium_since timestamptz,
  add column if not exists premium_reason text;

-- 3. Settings table check & default branding
alter table if exists location
  alter column name set default 'Mbarara';

update location set name = 'Mbarara' where name like '%Mbarara%';
update organization set name = 'Mzuri Unisex Salon' where id = 'a0000000-0000-0000-0000-000000000001';

-- App settings for branding & premium rules
insert into app_setting (location_id, key, value)
values 
  ('b0000000-0000-0000-0000-000000000001', 'salon_name', '"Mzuri Unisex Salon"'::jsonb),
  ('b0000000-0000-0000-0000-000000000001', 'location_name', '"Mbarara"'::jsonb),
  ('b0000000-0000-0000-0000-000000000001', 'receipt_address', '""'::jsonb),
  ('b0000000-0000-0000-0000-000000000001', 'receipt_phone', '""'::jsonb),
  ('b0000000-0000-0000-0000-000000000001', 'receipt_footer', '""'::jsonb),
  ('b0000000-0000-0000-0000-000000000001', 'premium_rules', '{"min_lifetime_spend_ugx": 200000, "min_visits": 5}'::jsonb),
  ('b0000000-0000-0000-0000-000000000001', 'premium_benefit_note', '""'::jsonb)
on conflict (location_id, key) do update set value = excluded.value;
