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
  const r = await fetch(url + '/rest/v1/app_setting?select=*&key=eq.service_metadata', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  console.log('Query service_metadata:', await r.text());

  const testInsert = await fetch(url + '/rest/v1/app_setting', {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      organization_id: 'a0000000-0000-0000-0000-000000000001',
      location_id: 'b0000000-0000-0000-0000-000000000001',
      key: 'service_metadata',
      value: { test: true }
    })
  });
  console.log('Insert response:', testInsert.status, await testInsert.text());
}

run().catch(console.error);
