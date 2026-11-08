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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const r = await fetch(url + '/rest/v1/app_setting?select=*&limit=1', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const row = await r.json();
  console.log('Single row app_setting:', row);
}

run().catch(console.error);
