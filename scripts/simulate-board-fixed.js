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
  const rVisits = await fetch(`${url}/rest/v1/visit?select=id,ticket_code,status,business_day_id&status=in.(queued,in_service)&order=queued_at.asc`, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const visits = await rVisits.json();

  const rLines = await fetch(`${url}/rest/v1/visit_service?select=id,status,sequence_no,visit_id,staff_user_id&order=sequence_no.asc`, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const allLines = await rLines.json();

  console.log('Visits found:', visits.length);
  const nowServing = [];
  const nextUp = [];
  const waitingList = [];

  for (const v of visits) {
    const lines = (Array.isArray(allLines) ? allLines : []).filter(l => l.visit_id === v.id);
    const activeLine = lines.find(l => l.status === 'in_progress');
    const readyLine = lines.find(l => l.status === 'ready');
    if (activeLine) {
      nowServing.push({ ticket: v.ticket_code });
    } else if (readyLine) {
      nextUp.push({ ticket: v.ticket_code });
    } else {
      waitingList.push({ ticket: v.ticket_code });
    }
  }

  console.log('Simulated Board:');
  console.log('Now Serving count:', nowServing.length, nowServing);
  console.log('Next Up count:', nextUp.length, nextUp);
  console.log('Waiting List count:', waitingList.length, waitingList);
}

run().catch(console.error);
