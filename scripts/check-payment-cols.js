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

async function check() {
  const r = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/payment?select=*&limit=1', {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
  });
  const data = await r.json();
  console.log('Payment columns:', Object.keys(data[0] || {}));
  console.log('Sample payment:', data[0]);
}

check().catch(console.error);
