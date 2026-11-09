'use client';

import { showPrompt } from '@/shared/lib/toast';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { DetailModal } from '@/shared/views/ui/detail-modal';
import { AttendanceStatusChip } from '@/shared/views/ui/attendance-status-chip';
import {
  Users,
  UserCheck,
  CalendarOff,
  Clock,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  Shield,
  CheckCircle2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import {
  getHrOverviewStatsAction,
  getLeaveRecordsAction,
  decideLeaveRequestAction,
  getPendingManagerRevocationsAction,
  decideManagerRevocationAction,
  type HrOverviewStats,
} from '../controllers/hr.actions';

export function HrOverviewView() {
  const [stats, setStats] = useState<HrOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTile, setSelectedTile] = useState<'active' | 'present' | 'leave' | 'late' | 'not_present' | null>(null);
  const [attention, setAttention] = useState<'revocations' | 'leave' | 'corrections' | null>(null);
  const [attentionRows, setAttentionRows] = useState<any[]>([]);
  const [actionBusy, setActionBusy] = useState(false);
  const tileProps = (tile: NonNullable<typeof selectedTile>) => ({
    role: 'button' as const,
    tabIndex: 0,
    onClick: () => setSelectedTile(tile),
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedTile(tile); }
    },
    className: 'border-slate-200 shadow-xs cursor-pointer hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-primary',
  });

  async function openAttention(kind: NonNullable<typeof attention>) {
    setAttention(kind);
    setAttentionRows([]);
    if (kind === 'revocations') {
      const res = await getPendingManagerRevocationsAction();
      if (res.success && res.data) setAttentionRows(res.data);
    } else if (kind === 'leave') {
      const res = await getLeaveRecordsAction();
      if (res.success && res.data) setAttentionRows(res.data.filter((row) => row.status === 'requested'));
    } else {
      setAttentionRows((stats?.recentChanges || []).filter((row) => row.action === 'ATTENDANCE_CORRECTED'));
    }
  }

  async function decideAttention(type: 'revocation' | 'leave', row: any, decision: 'confirm' | 'reverse' | 'approved' | 'rejected') {
    const reason = type === 'revocation' ? await showPrompt('Enter a reason for this access decision:') : null;
    if (type === 'revocation' && !reason?.trim()) return;
    setActionBusy(true);
    try {
      if (type === 'leave') await decideLeaveRequestAction({ leaveId: row.id, decision: decision as 'approved' | 'rejected' });
      else await decideManagerRevocationAction({ userId: row.revoked_user_id, decision: decision as 'confirm' | 'reverse', reason: reason! });
      await loadData();
      await openAttention(type === 'leave' ? 'leave' : 'revocations');
    } finally { setActionBusy(false); }
  }

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getHrOverviewStatsAction();
      if (res.success && res.data) {
        setStats(res.data);
      } else if (!res.success) {
        setError(res.error?.message || 'Failed to load HR overview statistics.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading statistics');
    } finally {
      setLoading(false);
    }
  };
  useSalonLiveRefresh(() => { void loadData(); }, true, ['app_user', 'attendance', 'leave_request', 'rota_entry', 'work_hours_policy', 'audit_log', 'hr_people_access_audit']);


  useEffect(() => {
    loadData();
    const refreshAfterNotification = () => { void loadData(); };
    window.addEventListener('salon-notifications-updated', refreshAfterNotification);
    return () => window.removeEventListener('salon-notifications-updated', refreshAfterNotification);
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">People & Access Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational workforce directory, daily presence, leave status, and pending authorization reviews
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/hr/staff">
            <Button size="sm" className="bg-[#1F4FD8] hover:bg-[#E05910] text-white text-xs h-8 font-semibold">
              <Users className="w-3.5 h-3.5 mr-1.5" />
              Manage Staff
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 5 People Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Active people by role */}
        <Card {...tileProps('active')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-medium  tracking-normal">Active Staff</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900">
              {loading ? '—' : stats?.totalActive || 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-1">
              <span>{stats?.activeByRole.staff || 0} stylists/barbers</span>
              <span>• {stats?.activeByRole.receptionist || 0} rec</span>
              <span>• {stats?.activeByRole.manager || 0} mgr</span>
            </div>
          </CardContent>
        </Card>

        {/* Present today */}
        <Card {...tileProps('present')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-medium  tracking-normal">Present Today</span>
              <UserCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-700">
              {loading ? '—' : stats?.presentToday || 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {stats?.presentToday || 0} of {stats?.presence.length || 0} present
            </div>
          </CardContent>
        </Card>

        {/* On leave today */}
        <Card {...tileProps('leave')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-medium  tracking-normal">On Leave Today</span>
              <CalendarOff className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-extrabold text-indigo-700">
              {loading ? '—' : stats?.onLeaveToday || 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Approved leave scheduled
            </div>
          </CardContent>
        </Card>

        {/* Late today */}
        <Card {...tileProps('late')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-medium  tracking-normal">Late Arrivals</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-extrabold text-amber-700">
              {loading ? '—' : stats?.lateToday || 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              After rota start + grace
            </div>
          </CardContent>
        </Card>

        {/* Not in yet */}
        <Card {...tileProps('not_present')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-medium  tracking-normal">Not In Yet</span>
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-extrabold text-rose-700">
              {loading ? '—' : stats?.notInYet || 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Pending shift arrival
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Needs Attention Section */}
      <Card className="border-amber-200 bg-amber-50/40 shadow-xs">
        <CardHeader className="py-3 px-5 border-b border-amber-200/60 bg-amber-50/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              <CardTitle className="text-sm font-bold text-amber-900">Needs Attention</CardTitle>
            </div>
            <span className="text-[11px] text-amber-800 font-medium">Actionable items requiring HR review</span>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Manager Revocations */}
            <div role="button" tabIndex={0} onClick={() => openAttention('revocations')} onKeyDown={(e) => { if (e.key === 'Enter') openAttention('revocations'); }} className="p-4 bg-white border border-amber-200 rounded-xl flex flex-col justify-between cursor-pointer hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-primary">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-900">Manager Revocations</span>
                  {(stats?.pendingRevocationsCount || 0) > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      {stats?.pendingRevocationsCount} pending
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> All clear
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Manager emergency access revocations awaiting HR confirmation or reversal.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <Link onClick={(e) => e.stopPropagation()}
                  href="/hr/access"
                  className="text-xs font-semibold text-[#1F4FD8] hover:underline flex items-center gap-1"
                >
                  Review Access Revocations <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Leave to Approve */}
            <div role="button" tabIndex={0} onClick={() => openAttention('leave')} onKeyDown={(e) => { if (e.key === 'Enter') openAttention('leave'); }} className="p-4 bg-white border border-amber-200 rounded-xl flex flex-col justify-between cursor-pointer hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-primary">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-900">Leave Requests</span>
                  {(stats?.pendingLeaveCount || 0) > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                      {stats?.pendingLeaveCount} requested
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> All clear
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Pending leave requests submitted for review and approval.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <Link onClick={(e) => e.stopPropagation()}
                  href="/hr/leave"
                  className="text-xs font-semibold text-[#1F4FD8] hover:underline flex items-center gap-1"
                >
                  Manage Leave Requests <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Attendance Corrections this week */}
            <div role="button" tabIndex={0} onClick={() => openAttention('corrections')} onKeyDown={(e) => { if (e.key === 'Enter') openAttention('corrections'); }} className="p-4 bg-white border border-amber-200 rounded-xl flex flex-col justify-between cursor-pointer hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-primary">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-900">Attendance Corrections</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {stats?.attendanceCorrectionsThisWeek || 0} this week
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Timesheet adjustments and punctuality reason codes logged in the last 7 days.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <Link onClick={(e) => e.stopPropagation()}
                  href="/hr/attendance"
                  className="text-xs font-semibold text-[#1F4FD8] hover:underline flex items-center gap-1"
                >
                  View Attendance Logs <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent People and Access Changes */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-600" />
              <CardTitle className="text-sm font-bold text-slate-900">Recent People & Access Activity</CardTitle>
            </div>
            <Link href="/hr/audit" className="text-xs text-[#1F4FD8] font-semibold hover:underline">
              View Full Audit Log
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading recent activity...</div>
          ) : !stats?.recentChanges || stats.recentChanges.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No recent people or access changes recorded.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.recentChanges.map((log) => (
                <div key={log.id} className="p-4 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold  tracking-normal bg-slate-100 text-slate-700 border border-slate-200">
                        {log.category}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-slate-400">• by {log.actor_name} ({log.actor_role})</span>
                    </div>
                    {log.reason && (
                      <p className="text-xs text-slate-600 italic">
                        &ldquo;{log.reason}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="text-[11px] tabular-nums text-slate-400 shrink-0">
                    {new Date(log.at).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DetailModal
        isOpen={selectedTile !== null}
        onClose={() => setSelectedTile(null)}
        title={selectedTile === 'active' ? 'Active people' : selectedTile === 'present' ? 'Present today' : selectedTile === 'leave' ? 'On leave today' : selectedTile === 'late' ? 'Late arrivals' : 'Not present'}
        subtitle="Current Kampala workday · shared staff presence snapshot"
      >
        {selectedTile && <div className="space-y-2">
          {(stats?.presence || []).filter((person) => {
            if (selectedTile === 'active') return true;
            if (selectedTile === 'present') return person.status === 'present' || person.status === 'on_break';
            if (selectedTile === 'leave') return person.status === 'on_leave';
            if (selectedTile === 'not_present') return person.status === 'not_present';
            if (!person.clockInTime || !person.scheduledStartTime) return false;
            const actual = new Date(person.clockInTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Kampala' });
            const [ah, am] = actual.split(':').map(Number);
            const [sh, sm] = person.scheduledStartTime.split(':').map(Number);
            return ah * 60 + am > sh * 60 + sm + 15;
          }).map((person) => <div key={person.userId} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
            <div className="min-w-0"><p className="font-medium text-sm text-slate-900 truncate">{person.fullName || person.displayName}</p><p className="text-xs text-slate-500 capitalize">{person.role}</p>
              {(person.clockInTimeStr || person.clockOutTimeStr || person.breakStartedAtStr) && <p className="text-xs text-slate-600 mt-1">{person.clockInTimeStr ? `In ${person.clockInTimeStr}` : ''}{person.breakStartedAtStr ? ` · Break ${person.breakStartedAtStr}` : ''}{person.clockOutTimeStr ? ` · Out ${person.clockOutTimeStr}` : ''}</p>}
            </div><AttendanceStatusChip status={person.status} leaveType={person.leaveType} />
          </div>)}
          {selectedTile === 'late' && <p className="text-xs text-slate-500">Late arrival details are available to HR and in the Owner Staff summary. The shared presence status remains Present/On break.</p>}
        </div>}
      </DetailModal>
      <DetailModal isOpen={attention !== null} onClose={() => setAttention(null)}
        title={attention === 'revocations' ? 'Manager access revocations' : attention === 'leave' ? 'Leave requests' : 'Attendance corrections'}
        subtitle="People and access actions · Kampala time">
        {attentionRows.length === 0 ? <p className="text-sm text-slate-500 py-4">No items need review.</p> : <div className="space-y-3">
          {attentionRows.map((row, index) => <div key={row.audit_id || row.id || index} className="rounded-xl border border-slate-200 p-3 space-y-2">
            <div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{row.revoked_user_name || row.staff_name || row.actor_name || 'Staff record'}</strong><span className="text-xs text-slate-500">{row.at || row.from_date || ''}</span></div>
            <p className="text-sm text-slate-600">{row.reason || (row.from_date ? `${row.from_date} to ${row.to_date} · ${row.leave_type?.replaceAll('_', ' ')}` : row.action?.replaceAll('_', ' ') || 'Review recorded details')}</p>
            {attention === 'revocations' && <p className="text-xs text-slate-500">Requested by {row.revoked_by_name} ({row.revoked_by_role})</p>}
            {attention === 'revocations' && <div className="flex flex-wrap gap-2"><Button size="sm" disabled={actionBusy} onClick={() => decideAttention('revocation', row, 'confirm')}>Confirm revocation</Button><Button size="sm" variant="outline" disabled={actionBusy} onClick={() => decideAttention('revocation', row, 'reverse')}>Reverse</Button></div>}
            {attention === 'leave' && <div className="flex flex-wrap gap-2"><Button size="sm" disabled={actionBusy} onClick={() => decideAttention('leave', row, 'approved')}>Approve</Button><Button size="sm" variant="outline" disabled={actionBusy} onClick={() => decideAttention('leave', row, 'rejected')}>Reject</Button></div>}
          </div>)}
        </div>}
      </DetailModal>
    </div>
  );
}
