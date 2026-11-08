# Supabase SQL Migrations Execution Order

Please apply the SQL migrations in your Supabase project's **SQL Editor** in this exact order:

1. **`20261004000001_initial_schema.sql`**
   - File path: [`supabase/migrations/20261004000001_initial_schema.sql`](file:///c:/Users/PC/Desktop/salon-system/supabase/migrations/20261004000001_initial_schema.sql)
   - Creates enums, tables, foreign keys, check constraints, append-only triggers on `audit_log` and `payment`.

2. **`20261004000002_rls_policies.sql`**
   - File path: [`supabase/migrations/20261004000002_rls_policies.sql`](file:///c:/Users/PC/Desktop/salon-system/supabase/migrations/20261004000002_rls_policies.sql)
   - Enables RLS on all tables and applies the Section 7 permission matrix (HR isolation, Owner read-only, Manager full operations, Staff limited scope).

3. **`20261004000003_rpc_functions.sql`**
   - File path: [`supabase/migrations/20261004000003_rpc_functions.sql`](file:///c:/Users/PC/Desktop/salon-system/supabase/migrations/20261004000003_rpc_functions.sql)
   - Installs server-side business rules: `normalize_ug_phone`, `next_ticket_code`, `open_business_day`, `begin_close_day`, `confirm_close_day`, `undo_close`, `confirm_visit`, `start_service_line`, `finish_service_line`, `record_payment`, `enter_from_paper`.

4. **`20261004000004_seed_data.sql`**
   - File path: [`supabase/migrations/20261004000004_seed_data.sql`](file:///c:/Users/PC/Desktop/salon-system/supabase/migrations/20261004000004_seed_data.sql)
   - Seeds initial organization, Mbarara location, staff roster (Joan, Mary, David, Grace, Sarah, Peter, Rose), services with UGX pricing, variants, skills, and default settings.
