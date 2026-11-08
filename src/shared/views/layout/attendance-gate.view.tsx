'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AttendanceStatus, setMyAttendanceAction } from '@/modules/day';
import { AppRole } from '@/shared/models/roles';
import { useAttendance } from '@/shared/lib/attendance-context';

export interface AttendanceGateDetails {
  displayName: string;
  role: AppRole;
  status: AttendanceStatus;
  clockInTime: string | null;
  scheduledStartTime: string | null;
  businessDate: string;
  now: string;
}

export function AttendanceGateView({ details, next }: { details: AttendanceGateDetails; next: string }) {
  const router = useRouter();
  const { refresh } = useAttendance();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isReturn = Boolean(details.clockInTime);
  const actionLabel = isReturn ? 'I’m back' : 'I’m in';

  async function markIn() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await setMyAttendanceAction('in');
      if (!result.success) {
        setError(result.error || 'Could not update attendance. Please try again.');
        return;
      }
      await refresh();
      router.replace(next);
      router.refresh();
    } catch {
      setError('Could not update attendance. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const roleLabel = details.role === 'hr' ? 'HR' : details.role[0].toUpperCase() + details.role.slice(1);
  const heading = details.status === 'break' ? 'You’re on a break' : isReturn ? 'You’re currently out' : 'You haven’t clocked in';
  const description = details.status === 'break'
    ? 'When you are ready to return to work, mark yourself as back in.'
    : isReturn
      ? 'Mark yourself back in to continue using your workspace.'
      : 'Mark yourself in before opening your work tools.';

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 flex items-center justify-center">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="text-sm font-semibold text-blue-700">Mzuri Unisex Salon · Mbarara</div>
        <h1 className="mt-4 text-2xl font-bold text-slate-950">Attendance check</h1>
        <p className="mt-2 text-slate-600">{details.displayName} · {roleLabel}</p>
        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <div className="flex justify-between gap-4"><span>Today</span><span>{details.businessDate}</span></div>
          <div className="mt-2 flex justify-between gap-4"><span>Current time</span><span>{details.now}</span></div>
          {details.scheduledStartTime && <div className="mt-2 flex justify-between gap-4"><span>Scheduled start</span><span>{details.scheduledStartTime}</span></div>}
          <div className="mt-2 flex justify-between gap-4"><span>Status</span><span className="font-semibold">{details.status === 'break' ? 'Break' : details.status === 'out' ? 'Out' : 'Not in'}</span></div>
        </div>
        <h2 className="mt-6 text-lg font-semibold text-slate-950">{heading}</h2>
        <p className="mt-1 text-slate-600">{description}</p>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button onClick={markIn} disabled={loading} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:opacity-70">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? 'Updating attendance…' : actionLabel}
        </button>
        <button onClick={async () => { await fetch('/api/auth/signout', { method: 'POST' }); router.replace('/login'); }} className="mt-3 min-h-11 w-full text-sm font-medium text-slate-600 hover:text-slate-950">Sign out</button>
      </section>
    </main>
  );
}
