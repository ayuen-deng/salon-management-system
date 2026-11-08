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
  const rServices = await fetch(`${url}/rest/v1/service?select=id,name,category`, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const services = await rServices.json();
  console.log(`Total services: ${services.length}`);
  const catMap = {};
  for (const s of services) {
    catMap[s.category] = (catMap[s.category] || 0) + 1;
  }
  console.log('Category distribution in DB:', catMap);
}

check().catch(console.error);
