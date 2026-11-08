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

async function check() {
  const r1 = await fetch(url + '/rest/v1/service?select=*&limit=1', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  console.log('Service status:', r1.status, await r1.json());

  const r2 = await fetch(url + '/rest/v1/service_category?select=*&limit=1', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  console.log('service_category status:', r2.status, await r2.json());

  const r3 = await fetch(url + '/rest/v1/app_setting?key=eq.service_metadata', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  console.log('service_metadata status:', r3.status, await r3.json());
}

check();
