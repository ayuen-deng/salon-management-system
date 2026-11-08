-- Migration 00004: Seed Data for Mbarara Salon Prototype
-- Default organization, Mbarara location, users, skills, services, variants, settings, and initial rota

do $$
declare
  v_org_id uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_loc_id uuid := 'b0000000-0000-0000-0000-000000000001'::uuid;

  -- Users
  v_owner_id uuid := 'c0000000-0000-0000-0000-000000000001'::uuid;
  v_manager_id uuid := 'c0000000-0000-0000-0000-000000000002'::uuid;
  v_hr_id uuid := 'c0000000-0000-0000-0000-000000000003'::uuid;
  v_reception_id uuid := 'c0000000-0000-0000-0000-000000000004'::uuid;
  v_grace_id uuid := 'c0000000-0000-0000-0000-000000000005'::uuid;
  v_sarah_id uuid := 'c0000000-0000-0000-0000-000000000006'::uuid;
  v_peter_id uuid := 'c0000000-0000-0000-0000-000000000007'::uuid;
  v_rose_id uuid := 'c0000000-0000-0000-0000-000000000008'::uuid;

  -- Services
  v_wash_id uuid := 'd0000000-0000-0000-0000-000000000001'::uuid;
  v_treatment_id uuid := 'd0000000-0000-0000-0000-000000000002'::uuid;
  v_blowdry_id uuid := 'd0000000-0000-0000-0000-000000000003'::uuid;
  v_braiding_id uuid := 'd0000000-0000-0000-0000-000000000004'::uuid;
  v_haircut_id uuid := 'd0000000-0000-0000-0000-000000000005'::uuid;
begin
  -- Organization & Location
  insert into organization (id, name)
  values (v_org_id, 'Kembabazi Unisex Salon Mbarara')
  on conflict (id) do nothing;

  insert into location (id, organization_id, name, timezone, opening_hours)
  values (v_loc_id, v_org_id, 'Mbarara High Street Branch', 'Africa/Kampala', '{"open":"08:00","close":"20:00"}'::jsonb)
  on conflict (id) do nothing;

  -- Staff and Management Profiles
  insert into app_user (id, organization_id, location_id, full_name, display_name, phone, role)
  values
    (v_owner_id, v_org_id, v_loc_id, 'Godfrey Mugisha', 'Owner', '+256772000001', 'owner'),
    (v_manager_id, v_org_id, v_loc_id, 'Joan Tumusiime', 'Joan (Manager)', '+256772000002', 'manager'),
    (v_hr_id, v_org_id, v_loc_id, 'David Kato', 'David (HR)', '+256772000003', 'hr'),
    (v_reception_id, v_org_id, v_loc_id, 'Mary Namubiru', 'Mary (Reception)', '+256772000004', 'receptionist'),
    (v_grace_id, v_org_id, v_loc_id, 'Grace Atuhaire', 'Grace', '+256772000005', 'staff'),
    (v_sarah_id, v_org_id, v_loc_id, 'Sarah Kobusingye', 'Sarah', '+256772000006', 'staff'),
    (v_peter_id, v_org_id, v_loc_id, 'Peter Byamukama', 'Peter (Barber)', '+256772000007', 'staff'),
    (v_rose_id, v_org_id, v_loc_id, 'Rose Kyomugisha', 'Rose (Wash)', '+256772000008', 'staff')
  on conflict (id) do nothing;

  -- Services
  insert into service (id, organization_id, location_id, name, category, default_minutes)
  values
    (v_wash_id, v_org_id, v_loc_id, 'Shampoo & Rinse', 'Hair Care', 20),
    (v_treatment_id, v_org_id, v_loc_id, 'Deep-Conditioning Treatment', 'Hair Care', 30),
    (v_blowdry_id, v_org_id, v_loc_id, 'Blow-dry & Styling', 'Styling', 35),
    (v_braiding_id, v_org_id, v_loc_id, 'Braiding', 'Braids & Weaves', 180),
    (v_haircut_id, v_org_id, v_loc_id, 'Men Haircut & Beard', 'Barbering', 30)
  on conflict (id) do nothing;

  -- Variants with UGX Pricing
  insert into service_variant (service_id, name, list_price_ugx, min_price_ugx, max_price_ugx, expected_minutes)
  values
    (v_wash_id, 'Standard Hair Wash', 15000, 15000, 20000, 20),
    (v_treatment_id, 'Moisture Treatment', 35000, 30000, 45000, 30),
    (v_treatment_id, 'Protein Repair', 50000, 45000, 60000, 35),
    (v_blowdry_id, 'Blow-dry & Silk Press', 50000, 45000, 65000, 35),
    (v_braiding_id, 'Knotless Braids Medium', 120000, 100000, 150000, 180),
    (v_haircut_id, 'Fade Haircut & Beard Trim', 20000, 20000, 30000, 30)
  on conflict do nothing;

  -- Staff Skills
  insert into staff_skill (staff_user_id, service_id)
  values
    (v_rose_id, v_wash_id),
    (v_rose_id, v_treatment_id),
    (v_grace_id, v_blowdry_id),
    (v_grace_id, v_braiding_id),
    (v_sarah_id, v_blowdry_id),
    (v_sarah_id, v_braiding_id),
    (v_peter_id, v_haircut_id)
  on conflict do nothing;

  -- Discount Reasons
  insert into discount_reason (organization_id, location_id, code, label)
  values
    (v_org_id, v_loc_id, 'returning_customer', 'Returning Loyal Customer'),
    (v_org_id, v_loc_id, 'staff_friend', 'Staff Friend / Family'),
    (v_org_id, v_loc_id, 'price_dispute', 'Price Dispute Resolution'),
    (v_org_id, v_loc_id, 'promo', 'Promotional Campaign')
  on conflict do nothing;

  -- App Settings
  insert into app_setting (location_id, key, value)
  values
    (v_loc_id, 'discounts_enabled', 'true'::jsonb),
    (v_loc_id, 'receptionist_discount_max_ugx', '5000'::jsonb),
    (v_loc_id, 'receptionist_daily_discount_ugx', '25000'::jsonb),
    (v_loc_id, 'appointment_grace_minutes', '15'::jsonb),
    (v_loc_id, 'between_services_warn_minutes', '10'::jsonb),
    (v_loc_id, 'between_services_escalate_minutes', '25'::jsonb),
    (v_loc_id, 'wash_hold_limit', '2'::jsonb),
    (v_loc_id, 'auto_close_hour', '"23:00"'::jsonb),
    (v_loc_id, 'undo_close_minutes', '15'::jsonb),
    (v_loc_id, 'summary_delay_minutes', '15'::jsonb),
    (v_loc_id, 'review_thresholds', '{"discount_ugx": 10000, "flag_all_reopens": true, "flag_all_voids": true}'::jsonb)
  on conflict (location_id, key) do update set value = excluded.value;

end $$;
