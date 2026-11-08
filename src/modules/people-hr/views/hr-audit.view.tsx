'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import Link from 'next/link';
import { Card } from '@/shared/views/ui/card';
import { DetailModal } from '@/shared/views/ui/detail-modal';
import { ShieldAlert, Search, Filter, Key, Users, Clock, ArrowUpRight } from 'lucide-react';
import { getPeopleAuditLogsAction, type HrAuditEntry } from '../controllers/hr.actions';
import { HrExportMenu } from './hr-export-menu';

const ACTION_LABELS: Record<string, string> = {
  CREATE_ACCOUNT: 'Staff account created', EDIT_STAFF_PROFILE: 'Staff profile updated',
  CHANGE_USER_ROLE: 'Staff role changed', DEACTIVATE_USER: 'Staff account deactivated',
  REACTIVATE_USER: 'Staff account reactivated', RESET_PIN: 'Staff PIN reset',
  ATTENDANCE_CORRECTED: 'Attendance record corrected', STAFF_ATTENDANCE_OVERRIDE: 'Attendance overridden',
  ROTA_UPDATED: 'Staff rota updated', ROTA_COPIED: 'Rota copied',
  LEAVE_APPROVED: 'Leave approved', LEAVE_REJECTED: 'Leave declined', LEAVE_RECORDED: 'Leave recorded',
  DEVICE_PAIRED: 'Device paired', DEVICE_REVOKED: 'Device access revoked', REVOKE_DEVICE: 'Device access revoked',
  REVOKE_HR: 'HR access revoked', HR_CONFIRM_REVOCATION: 'Access revocation confirmed',
  HR_REVERSE_REVOCATION: 'Access revocation reversed', HR_ACCESS_UPDATED: 'Access settings updated',
  STAFF_STATUS_UPDATE: 'Staff status updated', STAFF_SKILLS_ASSIGNED: 'Staff skills updated',
};

const SAFE_FIELDS: Record<string, string> = {
  status: 'Status', role: 'Role', phone: 'Phone', start_date: 'Start date',
  from_date: 'From date', to_date: 'To date', leave_type: 'Leave type',
  weekday: 'Weekday', start: 'Shift start', end: 'Shift end', is_off: 'Day off',
  confirmed: 'Confirmed', reason_code: 'Reason code',
};

function humanAction(action: string) {
  return ACTION_LABELS[action] || action.toLowerCase().replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Africa/Kampala', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StateFields({ title, state }: { title: string; state?: Record<string, unknown> }) {
  const fields = Object.entries(state || {}).filter(([key]) => SAFE_FIELDS[key]);
  return (
    <section className="rounded-xl border border-slate-200 p-3 min-w-0">
      <h4 className="text-xs font-semibold text-slate-600 mb-2">{title}</h4>
      {fields.length ? <dl className="space-y-2">{fields.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-2 text-sm">
          <dt className="text-slate-500">{SAFE_FIELDS[key]}</dt>
          <dd className="text-slate-900 break-words">{String(value ?? '—')}</dd>
        </div>
      ))}</dl> : <p className="text-sm text-slate-500">No readable details recorded.</p>}
    </section>
  );
}

export function HrAuditView() {
  const [logs, setLogs] = useState<HrAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'people' | 'access'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<HrAuditEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshAudit = () => {
    setLoading(true);
    getPeopleAuditLogsAction({ category: categoryFilter }).then((res) => {
      if (res.success && res.data) setLogs(res.data);
      else setError(('error' in res && res.error?.message) || 'Failed to load audit records.');
      setLoading(false);
    });
  };

  useSalonLiveRefresh(refreshAudit);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPeopleAuditLogsAction({ category: categoryFilter }).then((res) => {
      if (!active) return;
      if (res.success && res.data) setLogs(res.data);
      else setError(('error' in res && res.error?.message) || 'Failed to load audit records.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [categoryFilter]);

  const filteredLogs = useMemo(() => logs.filter((log) => {
    const text = `${humanAction(log.action)} ${log.actor_name} ${log.target_name || ''} ${log.reason || ''}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  }), [logs, searchTerm]);

  return (
    <div className="space-y-5 p-1 sm:p-0">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">People &amp; Access Audit Ledger</h2>
        <p className="text-sm text-muted-foreground mt-1">Read-only history of staff, attendance, leave, and access changes.</p>
      </div>
      <div className="p-3.5 rounded-xl border border-border/80 bg-muted/30 flex items-start gap-3 text-xs text-muted-foreground">
        <ShieldAlert className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <span><strong>People and access only.</strong> Database action mapping and row security exclude sales, billing, customer records, and other audit categories.</span>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <label className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input aria-label="Search audit records" placeholder="Search action, actor, target, or reason..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} className="w-full text-sm rounded-lg border border-border bg-background pl-9 pr-4 py-2" />
        </label>
        <label className="flex items-center gap-2 w-full sm:w-auto text-sm">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select aria-label="Audit category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)} className="w-full sm:w-auto rounded-lg border border-border bg-background px-3 py-2">
            <option value="all">All People &amp; Access</option><option value="people">People</option><option value="access">Access</option>
          </select>
        </label>
        <HrExportMenu title="People and access audit" filename="people-access-audit" rows={filteredLogs} filters={`Search: ${searchTerm || 'all'} · Category: ${categoryFilter}`} columns={[{ label: 'Date and time', value: (r) => formatTime(r.at) }, { label: 'Action', value: (r) => humanAction(r.action) }, { label: 'Category', value: (r) => r.category }, { label: 'Actor', value: (r) => `${r.actor_name} (${r.actor_role})` }, { label: 'Target', value: (r) => r.target_name || r.entity_type }, { label: 'Reason', value: (r) => r.reason || '—' }]} />
      </div>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <Card className="rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="divide-y divide-border/50">
          {loading ? <p className="py-12 text-center text-muted-foreground">Loading people and access records…</p> : filteredLogs.length === 0 ?
            <p className="py-12 text-center text-muted-foreground">No matching audit records found.</p> : filteredLogs.map((log) => (
              <button key={log.id} type="button" onClick={() => setSelectedEntry(log)} className="w-full text-left p-4 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border ${log.category === 'access' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-indigo-50 text-indigo-800 border-indigo-200'}`}>
                        {log.category === 'access' ? <Key className="w-3 h-3" /> : <Users className="w-3 h-3" />}{log.category === 'access' ? 'Access' : 'People'}
                      </span>
                      <span className="font-medium text-sm text-slate-900">{humanAction(log.action)}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{log.actor_name} · {log.actor_role}{log.target_name ? ` · ${log.target_name}` : ''}</p>
                    {log.reason && <p className="text-sm text-slate-700 mt-2 break-words">{log.reason}</p>}
                  </div>
                  <span className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3.5 h-3.5" />{formatTime(log.at)}</span>
                </div>
              </button>
            ))}
        </div>
      </Card>
      <DetailModal isOpen={Boolean(selectedEntry)} onClose={() => setSelectedEntry(null)} title={selectedEntry ? humanAction(selectedEntry.action) : 'Audit record'} subtitle={selectedEntry ? formatTime(selectedEntry.at) : undefined}>
        {selectedEntry && <div className="space-y-4 min-w-0">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-slate-500">Action by</dt><dd className="font-medium">{selectedEntry.actor_name} · {selectedEntry.actor_role}</dd></div>
            <div><dt className="text-xs text-slate-500">Target</dt><dd className="font-medium">{selectedEntry.target_name || 'Recorded staff or access item'}</dd></div>
          </dl>
          {selectedEntry.reason && <p className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm break-words"><strong>Reason:</strong> {selectedEntry.reason}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><StateFields title="Before" state={selectedEntry.before} /><StateFields title="After" state={selectedEntry.after} /></div>
          <Link href="/hr/staff" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Open staff directory <ArrowUpRight className="w-4 h-4" /></Link>
        </div>}
      </DetailModal>
    </div>
  );
}
