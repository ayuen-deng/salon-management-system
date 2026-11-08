import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log('Testing open_business_day RPC directly with service client...');
  const res = await client.rpc('open_business_day', {
    p_location_id: 'b0000000-0000-0000-0000-000000000001',
    p_cash_float: 50000,
  });
  console.log('RPC result with service key (no auth.uid()):', res);
}

run().catch(console.error);
