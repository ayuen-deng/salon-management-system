import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://akwxbwhbaeckwmiwsxcf.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running latency-check.');

const client = createClient(supabaseUrl, serviceKey);

async function measureQuery(label, queryFn) {
  const start = performance.now();
  try {
    const res = await queryFn();
    const duration = performance.now() - start;
    if (res.error) {
      console.log(`❌ ${label.padEnd(30)} Error: ${res.error.message} (${duration.toFixed(1)}ms)`);
      return { label, duration, ok: false, error: res.error.message };
    }
    console.log(`✅ ${label.padEnd(30)} ${duration.toFixed(1)}ms (${Array.isArray(res.data) ? res.data.length + ' rows' : 'OK'})`);
    return { label, duration, ok: true };
  } catch (err) {
    const duration = performance.now() - start;
    console.log(`❌ ${label.padEnd(30)} Exception: ${err.message} (${duration.toFixed(1)}ms)`);
    return { label, duration, ok: false, error: err.message };
  }
}

async function runLatencyCheck() {
  console.log('======================================================');
  console.log('SUPABASE REALTIME & QUERY LATENCY BENCHMARK (MBARARA/KAMPALA)');
  console.log(`Endpoint: ${supabaseUrl}`);
  console.log('======================================================\n');

  // 1. Health Ping
  const ping = await measureQuery('Database Health Ping', () => client.from('business_day').select('id').limit(1));

  // 2. Queue Screen Query (Receptionist / TV)
  const queue = await measureQuery('Reception Queue Feed', () =>
    client.from('visit').select('id, ticket_code, status, queued_at').in('status', ['queued', 'in_service', 'ready_for_checkout'])
  );

  // 3. Customer Tablet Mirror
  const tablet = await measureQuery('Customer Tablet Mirror', () =>
    client.from('visit').select('id, ticket_code, status').limit(5)
  );

  // 4. Manager Approvals Inbox
  const approvals = await measureQuery('Manager Approvals Inbox', () =>
    client.from('approval_request').select('id, kind, status').eq('status', 'pending')
  );

  // 5. Owner Monitor Summary & Revenue
  const owner = await measureQuery('Owner Dashboard Aggregates', () =>
    client.from('payment').select('amount_ugx, method').limit(50)
  );

  console.log('\n------------------------------------------------------');
  const validPings = [ping, queue, tablet, approvals, owner].filter(p => p.ok);
  const avg = validPings.reduce((sum, p) => sum + p.duration, 0) / validPings.length;
  console.log(`Average Query Latency: ${avg.toFixed(1)}ms`);
  if (avg < 500) {
    console.log('Status: EXCELLENT (Suitable for responsive multi-device live demo)');
  } else if (avg < 1500) {
    console.log('Status: ACCEPTABLE (Simulated real-world East Africa network roundtrip)');
  } else {
    console.log('Status: HIGH LATENCY (Recommend preloading caches or local proxy)');
  }
  console.log('======================================================');
}

runLatencyCheck();
