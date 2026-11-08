import { createClient } from '@supabase/supabase-js';
import { createPerfTimedFetch } from './perf-timing';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// Only repositories inside models/ are permitted to import this client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: createPerfTimedFetch() } });

export function getServiceRoleClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for administrative backend execution.');
  }
  return createClient(supabaseUrl, serviceKey, { global: { fetch: createPerfTimedFetch() } });
}
