-- The report's nested location/date-dependent CTE uses highly selective
-- parameters. PostgreSQL's cached generic plan caused local repeat calls to
-- exceed 6 seconds, while custom plans completed in about 0.1-0.2 seconds.
-- Scope custom planning to this RPC so pooled sessions cannot retain the slow
-- generic plan; PostgreSQL restores the caller's setting after each call.
alter function public.get_staff_performance_report(uuid, date, date, text, uuid)
  set plan_cache_mode = force_custom_plan;
