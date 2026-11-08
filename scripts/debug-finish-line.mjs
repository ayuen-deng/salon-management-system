import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
const s = createClient(url, key);

async function run() {
  const lineId = '181d3749-90a8-470e-81f9-49d532611c84';
  const visitId = '545e37f6-d91c-4977-b74f-524377fbfd07';

  const { data: line } = await s.from('visit_service').select('id, visit_id, sequence_no, status').eq('id', lineId).single();
  console.log('Line in DB:', line);

  const { data: remainingLines, error: remErr } = await s
    .from('visit_service')
    .select('id, status')
    .eq('visit_id', line.visit_id)
    .not('status', 'in', '("done","cancelled","skipped")');
  console.log('Remaining lines query result:', remainingLines, 'error:', remErr?.message);

  const { data: payRecords } = await s.from('payment').select('id, status').eq('visit_id', line.visit_id).eq('status', 'confirmed');
  console.log('Pay records:', payRecords);

  const { data: testUpd, error: updErr } = await s
    .from('visit')
    .update({ status: 'completed' })
    .eq('id', visitId)
    .select();
  console.log('Test update visit result:', testUpd, 'error:', updErr?.message);
}

run();
