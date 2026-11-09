'use client';

import { useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export type SalonChange = { table: string; tables?: readonly string[] };

export function salonChangeAffectsDependencies(change: SalonChange | undefined, dependencies?: readonly string[]) {
  if (!dependencies?.length) return true;
  const changedTables = change?.tables ?? [change?.table ?? ''];
  return changedTables.includes('*') || changedTables.some((table) => dependencies.includes(table));
}

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

/** Public kiosk signal carries no row data; paired tablets can refresh day status without staff auth. */
export function subscribeToKioskBusinessDayChanges(onChange: () => void) {
  const client = getBrowserClient();
  if (!client) return () => {};

  const channel = client
    .channel('salon:kiosk-day-status', { config: { private: false } })
    .on('broadcast', { event: 'business_day_status_changed' }, () => onChange())
    .subscribe();

  return () => { void client.removeChannel(channel); };
}

/** Refresh this view's server-backed data without remounting forms or pending actions. */
export function useSalonLiveRefresh(
  refresh: () => void,
  enabled = true,
  dependencies?: readonly string[],
) {
  const refreshRef = useRef(refresh);
  const dependencyKey = dependencies?.join('\0');
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    const handler = (event: Event) => {
      const change = (event as CustomEvent<SalonChange>).detail;
      if (!salonChangeAffectsDependencies(change, dependencies)) {
        // A mounted client view owns its own refresh path. Cancel the shell's
        // full RSC fallback for unrelated tables to avoid refetching the route.
        if (dependencies?.length) event.preventDefault();
        return;
      }
      event.preventDefault();
      refreshRef.current();
    };
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, [dependencyKey, enabled]);
}

/** Returns true when an active page hook handled the invalidation locally. */
export function dispatchSalonDataChanged(change: SalonChange): boolean {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent<SalonChange>(CHANGE_EVENT, { detail: change, cancelable: true });
    return !window.dispatchEvent(event);
  }
  return false;
}
