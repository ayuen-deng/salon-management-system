'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { getMyAttendanceAction, setMyAttendanceAction, AttendanceStatus } from '@/modules/day';

interface AttendanceContextValue {
  status: AttendanceStatus | null; // null = loading
  loading: boolean;
  pendingStatus: AttendanceStatus | null;
  setStatus: (status: AttendanceStatus) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextValue | undefined>(undefined);

export function AttendanceProvider({
  children,
  initialStatus,
}: {
  children: React.ReactNode;
  initialStatus?: AttendanceStatus;
}) {
  const [status, setLocalStatus] = useState<AttendanceStatus | null>(initialStatus ?? null);
  const [loading, setLoading] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<AttendanceStatus | null>(null);
  const pathname = usePathname();

  const syncState = useCallback((newStatus: AttendanceStatus | null) => {
    setLocalStatus(newStatus);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await getMyAttendanceAction();
      if (res.success && res.data) {
        syncState(res.data.status);
      }
    } catch (e) {
      console.error('Failed to fetch attendance state:', e);
    }
  }, [syncState]);

  useEffect(() => {
    // The provider lives above route pages, so moving between tabs keeps the
    // already-resolved state. Re-check after entering an authenticated area;
    // sign-in routes clear the previous account's state first.
    if (pathname === '/login' || pathname === '/choose-pin') {
      setLocalStatus(null);
      return;
    }
    if (/^\/(owner|manager|hr|reception|staff)(\/|$)/.test(pathname) && status === null) {
      void refresh();
    }
  }, [pathname, refresh, status]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handleSalonChange = (event: Event) => {
      const table = (event as CustomEvent<{ table?: string }>).detail?.table;
      if (table && table !== '*' && table !== 'attendance') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refresh(); }, 80);
    };
    window.addEventListener('salon:data-changed', handleSalonChange);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('salon:data-changed', handleSalonChange);
    };
  }, [refresh]);

  const setAttendance = useCallback(
    async (targetStatus: AttendanceStatus): Promise<boolean> => {
      if (loading || targetStatus === status) return false;
      const previous = status;
      setLoading(true);
      setPendingStatus(targetStatus);

      // Optimistic update
      syncState(targetStatus);

      try {
        const res = await setMyAttendanceAction(targetStatus);
        if (res.success && res.data) {
          syncState(res.data.status);
          return true;
        } else {
          // Rollback on error
          syncState(previous);
          return false;
        }
      } catch (e) {
        syncState(previous);
        return false;
      } finally {
        setLoading(false);
        setPendingStatus(null);
      }
    },
    [loading, status, syncState]
  );

  return (
    <AttendanceContext.Provider
      value={{
        status,
        loading,
        pendingStatus,
        setStatus: setAttendance,
        refresh,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
}
