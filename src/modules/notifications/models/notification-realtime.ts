'use client';

import { createBrowserClient } from '@supabase/ssr';

export function subscribeToUserNotifications(userId: string, onChange: (eventType: 'INSERT' | 'UPDATE') => void) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !userId) return () => {};
  const client = createBrowserClient(url, key);
  const channel = client.channel(`user-notifications-${userId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'notification',
      filter: `recipient_user_id=eq.${userId}`,
    }, (payload) => onChange(payload.eventType === 'INSERT' ? 'INSERT' : 'UPDATE'))
    .subscribe();
  return () => { void client.removeChannel(channel); };
}
