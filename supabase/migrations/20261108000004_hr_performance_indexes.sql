-- pg-delta: transaction=false
-- The report's target count probes completed lines per staff member and checks
-- visit eligibility by visit_id. These partial indexes are validated against
-- the local synthetic report workload; they exclude irrelevant service lines.
create index concurrently if not exists visit_service_staff_done_visit_idx
  on public.visit_service (staff_user_id, visit_id)
  where status = 'done';

create index concurrently if not exists visit_service_paid_visit_idx
  on public.visit_service (visit_id)
  where price_source <> 'complimentary';
