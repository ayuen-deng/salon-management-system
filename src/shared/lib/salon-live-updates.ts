'use client';

import { useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export type SalonChange = { table: string };

const CHANGE_EVENT = 'salon:data-changed';
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

function getBrowserClient() {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return undefined;
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}

/** Subscribe once per app shell to private, data-free table invalidation messages. */
export function subscribeToSalonLiveChanges(onChange: (change: SalonChange) => void) {
  const client = getBrowserClient();
  if (!client) return () => {};

  const channel = client
    .channel('salon:changes', { config: { private: true } })
    .on('broadcast', { event: 'salon_data_changed' }, ({ payload }) => {
      if (payload && typeof payload.table === 'string') onChange({ table: payload.table });
    })
    .subscribe();

  return () => { void client.removeChannel(channel); };
}

/** Refresh this view's server-backed data without remounting forms or pending actions. */
export function useSalonLiveRefresh(refresh: () => void, enabled = true) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    const handler = (event: Event) => {
      event.preventDefault();
      refreshRef.current();
    };
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, [enabled]);
}

/** Returns true when an active page hook handled the invalidation locally. */
export function dispatchSalonDataChanged(change: SalonChange): boolean {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent<SalonChange>(CHANGE_EVENT, { detail: change, cancelable: true });
    return !window.dispatchEvent(event);
  }
  return false;
}
