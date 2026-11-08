'use client';

import { createClient } from '@supabase/supabase-js';

export function subscribeToStaffSkillChanges(onChange: () => void) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return () => {};
  const client = createClient(url, key);
  const channel = client.channel('staff-skill-queue-refresh')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_skill' }, onChange)
    .subscribe();
  return () => { void client.removeChannel(channel); };
}
