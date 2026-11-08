'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { getMyAttendanceLogsAction } from '../controllers/staff.actions';
import { Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { AttendanceStatusChip } from '@/shared/views/ui/attendance-status-chip';

export function StaffAttendanceView() {
  const [data, setData] = useState<{
    todayStatus: 'in' | 'break' | 'out';
    last7Days: { date: string; firstIn: string | null; lastOut: string | null; status: 'present' | 'out' | 'not_present' | 'on_leave' }[];
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadAttendance();
  }, []);

  async function loadAttendance() {
    try {
      const res = await getMyAttendanceLogsAction();
      if (res.success && res.data) {
        setData(res.data);
      }
    } finally {
      setLoading(false);
    }
  }
  useSalonLiveRefresh(() => { void loadAttendance(); });


  const logs = data?.last7Days || [];

  return (
    <div className="max-w-md mx-auto p-4 pb-24 md:pb-6 space-y-6 font-sans">
      <div>
        <h2 className="text-lg font-bold text-slate-900">My Attendance</h2>
        <p className="text-xs text-muted-foreground">
          Use the attendance control in the top bar to clock in, take breaks, and clock out.
        </p>
      </div>

      {/* 7 Days History Card */}
      <Card className="border border-slate-200 bg-white rounded-2xl shadow-xs overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold  tracking-normal text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-500" />
            Last 7 Days Record
          </CardTitle>
          <span className="text-[11px] text-muted-foreground">Personal only</span>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
              Loading attendance history...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No recent attendance logs recorded.
            </div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-900">{log.date}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>In: {log.firstIn || '—'}</span>
                    <span>•</span>
                    <span>Out: {log.lastOut || '—'}</span>
                  </div>
                </div>
                <AttendanceStatusChip status={log.status} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
