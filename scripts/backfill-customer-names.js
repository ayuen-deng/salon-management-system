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
const { createClient } = require('@supabase/supabase-js');
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function normalizeCustomerName(rawName) {
  if (!rawName) return '';
  const clean = rawName.trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return clean
    .split(' ')
    .map(word => {
      return word
        .split('-')
        .map(part => {
          return part
            .split("'")
            .map(subpart => {
              if (!subpart) return '';
              return subpart.charAt(0).toUpperCase() + subpart.slice(1).toLowerCase();
            })
            .join("'");
        })
        .join('-');
    })
    .join(' ');
}

async function run() {
  console.log('Querying customers with lowercase or unnormalized names...');
  const { data: customers } = await client.from('customer').select('id, first_name');
  let updatedCount = 0;
  for (const c of customers || []) {
    const normalized = normalizeCustomerName(c.first_name);
    if (normalized && normalized !== c.first_name) {
      console.log(`Normalizing "${c.first_name}" -> "${normalized}"`);
      await client.from('customer').update({ first_name: normalized }).eq('id', c.id);
      updatedCount++;
    }
  }
  console.log(`Backfilled ${updatedCount} customer names.`);
}

run().catch(console.error);
