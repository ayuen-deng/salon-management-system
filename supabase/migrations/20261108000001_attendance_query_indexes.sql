-- pg-delta: transaction=false
-- Evidence from the local 5-year performance fixture: HR attendance filters
-- by location/date, and the daily view joins by staff/date ordered by update.
-- Keep these online for existing salon databases with CREATE INDEX CONCURRENTLY.
create index concurrently if not exists attendance_location_business_date_idx
  on public.attendance (location_id, business_date desc);

create index concurrently if not exists attendance_staff_business_date_updated_idx
  on public.attendance (staff_user_id, business_date, updated_at desc);
