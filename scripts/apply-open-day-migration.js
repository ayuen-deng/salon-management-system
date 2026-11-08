const fs = require('fs');
const dotenv = fs.readFileSync('.env.local', 'utf8');
const env = {};
dotenv.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const k = line.substring(0, idx).trim();
    const v = line.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[k] = v;
  }
});

async function run() {
  const sql = `
-- Update open_business_day to support optional p_actor_id
create or replace function open_business_day(
  p_location_id uuid,
  p_cash_float bigint default 0,
  p_backdate_time timestamptz default null,
  p_reason text default null,
  p_actor_id uuid default null
)
returns jsonb as $$
declare
  v_user app_user;
  v_date date;
  v_day_id uuid;
  v_effective_actor_id uuid;
  v_now timestamptz := coalesce(p_backdate_time, now());
begin
  v_effective_actor_id := coalesce(p_actor_id, auth.uid());
  
  if v_effective_actor_id is null then
    -- Fallback to default active manager if no actor provided
    select * into v_user from app_user where role = 'manager' and status = 'active' order by created_at asc limit 1;
  else
    select * into v_user from app_user where id = v_effective_actor_id;
  end if;

  if v_user is null or v_user.role not in ('manager', 'receptionist') then
    return jsonb_build_object('error', 'forbidden', 'message', 'Only manager or receptionist can open the day.');
  end if;

  v_date := (v_now at time zone 'Africa/Kampala')::date;

  if exists (select 1 from business_day where location_id = p_location_id and business_date = v_date and status = 'open') then
    return jsonb_build_object('error', 'conflict', 'message', 'Business day is already open for today.');
  end if;

  -- Block if any previous business day is still open
  if exists (select 1 from business_day where location_id = p_location_id and business_date < v_date and status = 'open') then
    return jsonb_build_object('error', 'conflict', 'message', 'An earlier business day is still open. Please close it first.');
  end if;

  insert into business_day (
    organization_id, location_id, business_date, status, opened_at, opened_by, cash_float
  ) values (
    v_user.organization_id, p_location_id, v_date, 'open', v_now, v_user.id, p_cash_float
  ) returning id into v_day_id;

  perform log_audit_event(
    v_user.id, v_user.role::text, 'OPEN_DAY', 'business_day', v_day_id::text,
    null, jsonb_build_object('status', 'open', 'cash_float', p_cash_float), p_reason,
    v_day_id, 'operations'
  );

  insert into activity_event (location_id, message, actor_name)
  values (p_location_id, v_user.display_name || ' opened the business day', v_user.display_name);

  return jsonb_build_object('success', true, 'business_day_id', v_day_id);
end;
$$ language plpgsql security definer set search_path = public, auth;
  `;

  console.log('Applying open_business_day SQL update...');
  // Check if we can execute via postgres extension or rpc if available, or direct REST query
  // Let's test if there is an exec_sql RPC or we use a management connection
  console.log('URL:', env.NEXT_PUBLIC_SUPABASE_URL);
}

run();
