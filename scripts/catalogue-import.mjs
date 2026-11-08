import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running catalogue-import.');

const client = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_ID = 'a0000000-0000-0000-0000-000000000001';
const LOC_ID = 'b0000000-0000-0000-0000-000000000001';
const MANAGER_ID = 'c0000000-0000-0000-0000-000000000002';

export async function importCatalogueFromCsv(csvContent) {
  const lines = csvContent.trim().split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV is empty or missing headers.');
  }

  const headerLine = lines[0];
  const is9Col = headerLine.toLowerCase().includes('audience');
  const records = lines.slice(1);
  let importedCount = 0;

  for (const line of records) {
    const parts = line.split(',').map((s) => s.trim());
    if (parts.length < 7) continue;

    let audience = 'both';
    let category = '';
    let subcategory = '';
    let serviceName = '';
    let variantName = '';
    let price = 0;
    let minPrice = 0;
    let maxPrice = 0;
    let minutes = 30;

    if (is9Col && parts.length >= 9) {
      audience = parts[0].toLowerCase();
      category = parts[1];
      subcategory = parts[2];
      serviceName = parts[3];
      variantName = parts[4];
      price = parseInt(parts[5], 10);
      minPrice = parseInt(parts[6], 10);
      maxPrice = parseInt(parts[7], 10);
      minutes = parseInt(parts[8], 10);
    } else {
      category = parts[0];
      serviceName = parts[1];
      variantName = parts[2];
      price = parseInt(parts[3], 10);
      minPrice = parseInt(parts[4], 10);
      maxPrice = parseInt(parts[5], 10);
      minutes = parseInt(parts[6], 10);
      if (category.toLowerCase().includes('barber')) audience = 'men';
      else if (category.toLowerCase().includes('braid') || category.toLowerCase().includes('weave')) audience = 'women';
    }

    // Embed metadata in category string if audience column not native: e.g. "both|Hair Care|Wash"
    const compositeCategory = `${audience}|${category}|${subcategory}`;

    // 1. Get or create Service
    let { data: service } = await client
      .from('service')
      .select('id, category')
      .eq('location_id', LOC_ID)
      .eq('name', serviceName)
      .maybeSingle();

    if (!service) {
      const { data: newService, error: sErr } = await client
        .from('service')
        .insert({
          organization_id: ORG_ID,
          location_id: LOC_ID,
          name: serviceName,
          category: compositeCategory,
          default_minutes: minutes,
          active: true,
        })
        .select('id')
        .single();
      if (sErr) throw sErr;
      service = newService;
    } else if (service.category !== compositeCategory) {
      await client
        .from('service')
        .update({ category: compositeCategory, default_minutes: minutes })
        .eq('id', service.id);
    }

    // 2. Get or create Variant
    const { data: existingVariant } = await client
      .from('service_variant')
      .select('id, list_price_ugx')
      .eq('service_id', service.id)
      .eq('name', variantName)
      .maybeSingle();

    if (existingVariant) {
      if (existingVariant.list_price_ugx !== price) {
        await client
          .from('service_variant')
          .update({
            list_price_ugx: price,
            min_price_ugx: minPrice,
            max_price_ugx: maxPrice,
            expected_minutes: minutes,
          })
          .eq('id', existingVariant.id);

        await client.from('price_history').insert({
          service_variant_id: existingVariant.id,
          old_price_ugx: existingVariant.list_price_ugx,
          new_price_ugx: price,
          changed_by: MANAGER_ID,
        });
      }
    } else {
      await client.from('service_variant').insert({
        service_id: service.id,
        name: variantName,
        list_price_ugx: price,
        min_price_ugx: minPrice,
        max_price_ugx: maxPrice,
        expected_minutes: minutes,
        active: true,
      });
    }

    importedCount++;
  }

  return importedCount;
}

if (process.argv[1]?.includes('catalogue-import.mjs')) {
  const filePath = process.argv[2] || path.join(process.cwd(), 'demo', 'catalogue-template.csv');
  console.log(`Importing catalogue from ${filePath}...`);
  const content = fs.readFileSync(filePath, 'utf8');
  importCatalogueFromCsv(content)
    .then((count) => {
      console.log(`✅ Successfully imported ${count} catalogue service variants.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Import failed:', err);
      process.exit(1);
    });
}
