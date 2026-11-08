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
  const r = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/', {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
  });
  const data = await r.json();
  const tables = Object.keys(data.definitions || {});
  console.log('Available Supabase tables:', tables);
}

run().catch(console.error);
