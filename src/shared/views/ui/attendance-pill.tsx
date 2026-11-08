'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { AttendanceStatus } from '@/modules/day';
import { useAttendance } from '@/shared/lib/attendance-context';

export function AttendancePill() {
  const { status, loading, pendingStatus, setStatus } = useAttendance();

  // If status is still resolving from server, show a neutral skeleton
  if (status === null) {
    return (
      <div
        role="group"
        aria-label="Attendance Status Control"
        className="inline-flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs shadow-xs animate-pulse"
      >
        <span className="h-6 w-12 bg-slate-200/80 rounded" />
        <span className="h-6 w-14 bg-slate-200/60 rounded ml-1" />
        <span className="h-6 w-12 bg-slate-200/80 rounded ml-1" />
      </div>
    );
  }

  async function handleStatusChange(newStatus: AttendanceStatus) {
    await setStatus(newStatus);
  }

  return (
    <div
      role="group"
      aria-label="Attendance Status Control"
      className="inline-flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs shadow-xs"
    >
      {/* IN BUTTON */}
      <button
        type="button"
        disabled={loading}
        onClick={() => handleStatusChange('in')}
        className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
          status === 'in'
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
        } disabled:opacity-75`}
      >
        {loading && pendingStatus === 'in' ? (
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
        ) : (
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              status === 'in' ? 'bg-white' : 'bg-emerald-500'
            }`}
          />
        )}
        <span>In</span>
      </button>

      {/* BREAK BUTTON */}
      <button
        type="button"
        disabled={loading}
        onClick={() => handleStatusChange('break')}
        className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
          status === 'break'
            ? 'bg-amber-600 text-white shadow-xs'
            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
        } disabled:opacity-75`}
      >
        {loading && pendingStatus === 'break' ? (
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
        ) : (
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              status === 'break' ? 'bg-white' : 'bg-amber-500'
            }`}
          />
        )}
        <span>Break</span>
      </button>

      {/* OUT BUTTON */}
      <button
        type="button"
        disabled={loading}
        onClick={() => handleStatusChange('out')}
        className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
          status === 'out'
            ? 'bg-slate-700 text-white shadow-xs'
            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
        } disabled:opacity-75`}
      >
        {loading && pendingStatus === 'out' ? (
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
        ) : (
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              status === 'out' ? 'bg-white' : 'bg-slate-400'
            }`}
          />
        )}
        <span>Out</span>
      </button>
    </div>
  );
}
