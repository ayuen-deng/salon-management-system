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
  const r = await fetch(url + '/rest/v1/service?select=id,name,category', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const services = await r.json();
  console.log('Total services:', services.length);
  const categories = [...new Set(services.map(s => s.category))];
  console.log('Current categories:', categories);
  console.log('Sample services:', services.slice(0, 10));
}

check();
