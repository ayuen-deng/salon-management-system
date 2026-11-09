-- pg-delta: transaction=false
-- HR performance report joins each eligible visit to completed measured service
-- lines by visit_id. A partial covering index lets PostgreSQL avoid scanning
-- every visit_service row for that join while excluding complimentary and
-- unmeasured lines from the index.
create index concurrently if not exists visit_service_done_measured_visit_idx
  on public.visit_service (visit_id)
  include (staff_user_id, service_variant_id, started_at, ended_at)
  where status = 'done'
    and times_source = 'measured'
    and started_at is not null
    and ended_at is not null;
