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
  const r = await fetch(url + '/rest/v1/visit?select=id,ticket_code,status,business_day_id&status=in.(queued,in_service)', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  console.log('Active visits in DB:', await r.json());

  const rLines = await fetch(url + '/rest/v1/visit_service?select=id,status,sequence_no,visit_id,staff_user_id&status=in.(in_progress,ready,blocked)', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  console.log('Active lines in DB:', await rLines.json());
}

run().catch(console.error);
