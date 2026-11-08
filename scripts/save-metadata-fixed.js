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

// Canonical categories
const canonicalCategories = [
  'Haircuts',
  'Hair care and treatments',
  'Colour',
  'Braids and styling',
  'Massage',
  'Makeup',
  'Nails',
  'Skin and facials',
  'Brows and lashes'
];

async function run() {
  const r = await fetch(url + '/rest/v1/service?select=id,name,category', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const services = await r.json();

  const metadata = {};
  for (const s of services) {
    let img = null;
    let featured = false;
    let sort_order = 10;
    const catLower = (s.category || '').toLowerCase();
    const nameLower = (s.name || '').toLowerCase();

    if (catLower.includes('haircut') || nameLower.includes('haircut') || nameLower.includes('fade') || catLower.includes('barber') || nameLower.includes('beard') || nameLower.includes('shave')) {
      img = `${url}/storage/v1/object/public/catalogue-images/demo/haircuts.jpg`;
      featured = nameLower.includes('regular') || nameLower.includes('fade');
      sort_order = 1;
    } else if (catLower.includes('braid') || nameLower.includes('braid') || nameLower.includes('cornrow') || catLower.includes('weave') || nameLower.includes('weave') || nameLower.includes('styling')) {
      img = `${url}/storage/v1/object/public/catalogue-images/demo/braids.jpg`;
      featured = nameLower.includes('braiding') || nameLower.includes('cornrows');
      sort_order = 2;
    } else if (catLower.includes('massage') || nameLower.includes('massage')) {
      img = `${url}/storage/v1/object/public/catalogue-images/demo/massage.jpg`;
      sort_order = 5;
    } else if (catLower.includes('nail') || nameLower.includes('manicure') || nameLower.includes('pedicure')) {
      img = `${url}/storage/v1/object/public/catalogue-images/demo/nails.jpg`;
      featured = true;
      sort_order = 4;
    } else if (catLower.includes('makeup') || nameLower.includes('makeup') || catLower.includes('lash') || nameLower.includes('lash') || nameLower.includes('brow')) {
      img = `${url}/storage/v1/object/public/catalogue-images/demo/makeup.jpg`;
      sort_order = 6;
    } else if (catLower.includes('skin') || catLower.includes('facial') || nameLower.includes('facial')) {
      img = `${url}/storage/v1/object/public/catalogue-images/demo/skincare.jpg`;
      sort_order = 7;
    } else if (catLower.includes('treatment') || catLower.includes('hair care') || nameLower.includes('wash') || nameLower.includes('shampoo') || catLower.includes('colour') || nameLower.includes('colour') || nameLower.includes('chemical')) {
      img = `${url}/storage/v1/object/public/catalogue-images/demo/treatments.jpg`;
      sort_order = 3;
    }

    metadata[s.id] = {
      image_url: img,
      featured,
      sort_order
    };
  }

  // Insert or update service_metadata with location_id
  const rMeta = await fetch(url + '/rest/v1/app_setting?select=id&key=eq.service_metadata', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const metaExisting = await rMeta.json();
  if (metaExisting && metaExisting.length > 0) {
    const patchRes = await fetch(url + `/rest/v1/app_setting?id=eq.${metaExisting[0].id}`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: metadata })
    });
    console.log('PATCH service_metadata:', patchRes.status);
  } else {
    const postRes = await fetch(url + '/rest/v1/app_setting', {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        location_id: 'b0000000-0000-0000-0000-000000000001',
        key: 'service_metadata',
        value: metadata
      })
    });
    console.log('POST service_metadata:', postRes.status, await postRes.text());
  }

  // Also check direct service.image_url column if supported
  console.log('Completed metadata mapping for services count:', Object.keys(metadata).length);
}

run().catch(console.error);
