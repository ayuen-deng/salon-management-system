'use client';

import { useCallback, useEffect, useState } from 'react';
import { subscribeToUserNotifications } from '../models/notification-realtime';
import type { AppNotification, MyNotifications } from '../models/notification.repository';

async function fetchNotifications() {
  const response = await fetch('/api/notifications', { cache: 'no-store' });
  if (!response.ok) return null;
  const result = await response.json() as { success: boolean; data?: MyNotifications };
  return result.success ? result.data || null : null;
}

export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await fetchNotifications();
    if (data) setItems(data.items);
    setLoading(false);
    return data;
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    let known = new Set<string>();
    void refresh().then((initial) => {
      if (!active) return;
      if (!initial) return;
      known = new Set(initial.items.map((item) => item.id));
      unsubscribe = subscribeToUserNotifications(initial.userId, (eventType) => {
        void fetchNotifications().then((data) => {
          if (!active || !data) return;
          const newest = data.items;
          const added = newest.find((item) => !known.has(item.id));
          newest.forEach((item) => known.add(item.id));
          setItems(newest);
          window.dispatchEvent(new CustomEvent('salon-notifications-updated'));
          if (eventType === 'INSERT' && added) {
            setToast(added.body);
            window.setTimeout(() => setToast(null), 5000);
          }
        });
      });
    });
    return () => { active = false; unsubscribe(); };
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    const response = await fetch(`/api/notifications/${encodeURIComponent(id)}`, { method: 'PATCH' });
    if (response.ok) {
      setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
      window.dispatchEvent(new CustomEvent('salon-notifications-updated'));
    }
    return response.ok;
  }, []);

  return { items, loading, toast, markRead };
}
