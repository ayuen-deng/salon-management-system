begin;
select extensions.plan(5);

insert into public.app_user (
  id, organization_id, location_id, full_name, display_name, phone, role, status, start_date
) values (
  'c2000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'Gate Test User', 'Gate Test', '+256700000001', 'staff', 'active',
  (now() at time zone 'Africa/Kampala')::date
);

select extensions.is(
  public.is_user_clocked_in('c2000000-0000-0000-0000-000000000001'),
  false,
  'staff without a current attendance record is gated'
);

insert into public.attendance (
  organization_id, location_id, staff_user_id, business_date, clock_in, on_break, absence_type
) values (
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'c2000000-0000-0000-0000-000000000001',
  (now() at time zone 'Africa/Kampala')::date, now(), false, 'none'
);

select extensions.is(
  public.is_user_clocked_in('c2000000-0000-0000-0000-000000000001'),
  true,
  'staff with an active In record may open the workspace'
);

update public.attendance
set on_break = true, break_started_at = now()
where staff_user_id = 'c2000000-0000-0000-0000-000000000001'
  and business_date = (now() at time zone 'Africa/Kampala')::date;
select extensions.is(
  public.is_user_clocked_in('c2000000-0000-0000-0000-000000000001'),
  false,
  'staff on break is gated'
);

update public.attendance
set on_break = false, clock_out = now()
where staff_user_id = 'c2000000-0000-0000-0000-000000000001'
  and business_date = (now() at time zone 'Africa/Kampala')::date;
select extensions.is(
  public.is_user_clocked_in('c2000000-0000-0000-0000-000000000001'),
  false,
  'staff who clocked out is gated'
);

update public.app_user set role = 'owner'
where id = 'c2000000-0000-0000-0000-000000000001';
select extensions.is(
  public.is_user_clocked_in('c2000000-0000-0000-0000-000000000001'),
  true,
  'owner is exempt from the attendance gate'
);

select * from extensions.finish();
rollback;
