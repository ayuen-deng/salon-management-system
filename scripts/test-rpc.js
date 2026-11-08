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

async function checkRpc() {
  const r = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/', {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
  });
  console.log('RPC endpoint status:', r.status);
}

checkRpc().catch(console.error);
