'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import { Activity, Clock3, ShieldCheck, Users, X } from 'lucide-react';
import { Card } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { DetailModal } from '@/shared/views/ui/detail-modal';
import { HrExportMenu } from './hr-export-menu';
import {
  getStaffPerformanceReportAction,
  type PerformanceRole,
  type StaffPerformanceMetric,
  type StaffPerformancePersonDetail,
  type StaffPerformanceReport,
} from '@/modules/staff-performance';

type Preset = 'today' | 'week' | 'month' | 'custom';

function kampalaDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function rangeFor(preset: Preset, from: string, to: string) {
  const today = kampalaDate();
  if (preset === 'custom') return { fromDate: from || today, toDate: to || today };
  if (preset === 'today') return { fromDate: today, toDate: today };
  const todayAtNoon = new Date(`${today}T12:00:00+03:00`);
  const start = new Date(todayAtNoon);
  if (preset === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  else start.setDate(1);
  return { fromDate: kampalaDate(start), toDate: today };
}

function roleLabel(role: string) {
  return role === 'hr' ? 'HR' : role === 'staff' ? 'Service staff' : role === 'manager' ? 'Manager' : 'Receptionist';
}

function duration(value: number | null) {
  return value === null ? '—' : `${value.toFixed(1)} min`;
}

function MetricTile({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint?: string; icon: React.ElementType }) {
  return <Card className="flex items-start gap-3 p-4">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
    <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</div>
  </Card>;
}

function BarList({ rows, label, suffix = '' }: { rows: Array<{ label: string; value: number }>; label: (row: { label: string; value: number }) => string; suffix?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <div className="space-y-3">
    {rows.length ? rows.map((row) => <div key={row.label}>
      <div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate">{row.label}</span><span className="shrink-0 tabular-nums text-muted-foreground">{label(row)}{suffix}</span></div>
      <div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${Math.max(row.value > 0 ? 3 : 0, Math.min(100, row.value / max * 100))}%` }} /></div>
    </div>) : <p className="text-sm text-muted-foreground">No measured service data in this period.</p>}
  </div>;
}

function PersonDetail({ detail, metric }: { detail: StaffPerformancePersonDetail | null; metric: StaffPerformanceMetric }) {
  if (!detail) return <p className="text-sm text-muted-foreground">No detail is available for this period.</p>;
  const days = detail.services_by_day.map((row) => ({ label: row.date, value: row.services }));
  const categories = detail.category_durations.map((row) => ({ label: row.category, value: row.avg_actual_minutes }));
  const hours = detail.time_of_day.map((row) => ({ label: `${String(row.hour).padStart(2, '0')}:00`, value: row.services }));
  return <div className="space-y-6">
    {metric.is_service_staff ? <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Services</p><p className="mt-1 font-semibold tabular-nums">{metric.services_completed ?? 0}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">People served</p><p className="mt-1 font-semibold tabular-nums">{metric.customers_served ?? 0}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Average time</p><p className="mt-1 font-semibold tabular-nums">{duration(metric.avg_service_minutes)}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Team average</p><p className="mt-1 font-semibold tabular-nums">{duration(detail.team_average.avg_service_minutes)}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Utilisation / team average</p><p className="mt-1 font-semibold tabular-nums">{metric.utilization_pct == null ? '—' : `${metric.utilization_pct.toFixed(1)}%`} / {detail.team_average.utilization_pct == null ? '—' : `${detail.team_average.utilization_pct.toFixed(1)}%`}</p></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border p-4"><h3 className="mb-4 font-medium">Services by day</h3><BarList rows={days} label={(row) => String(row.value)} /></section>
        <section className="rounded-xl border p-4"><h3 className="mb-4 font-medium">Average service time by category</h3><div className="space-y-3">{detail.category_durations.length ? detail.category_durations.map((row) => <div key={row.category} className="flex items-center justify-between gap-4 border-b pb-2 text-sm last:border-0"><span>{row.category}</span><span className="text-right tabular-nums">{row.avg_actual_minutes.toFixed(1)} / {row.avg_expected_minutes.toFixed(1)} min <span className="text-xs text-muted-foreground">actual / expected</span></span></div>) : <p className="text-sm text-muted-foreground">No category data for this period.</p>}</div></section>
        <section className="rounded-xl border p-4 lg:col-span-2"><h3 className="mb-4 font-medium">Start time pattern</h3><BarList rows={hours} label={(row) => String(row.value)} suffix=" services" /></section>
      </div>
      <section className="rounded-xl border p-4">
        <h3 className="mb-3 font-medium">Target progress</h3>
        {detail.target.goal ? <><p className="text-sm tabular-nums">{detail.target.current ?? 0} of {detail.target.goal} people · {detail.target.period || 'target'}{detail.target.deadline ? ` · due ${detail.target.deadline}` : ''}</p><div className="mt-3 h-2 overflow-hidden rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${detail.target.progress_pct ?? 0}%` }} /></div></> : <p className="text-sm text-muted-foreground">No target is configured.</p>}
      </section>
    </> : <p className="rounded-lg border p-4 text-sm text-muted-foreground">Service measures are not applicable for this role. This view contains attendance only.</p>}
    <section className="rounded-xl border p-4">
      <h3 className="mb-3 font-medium">Attendance summary</h3>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Days present</p><p className="mt-1 font-medium tabular-nums">{detail.attendance.days_present}</p></div>
        <div><p className="text-xs text-muted-foreground">Hours worked</p><p className="mt-1 font-medium tabular-nums">{detail.attendance.hours_worked.toFixed(1)}</p></div>
        <div><p className="text-xs text-muted-foreground">On-time rate</p><p className="mt-1 font-medium tabular-nums">{detail.attendance.on_time_rate_pct === null ? '—' : `${detail.attendance.on_time_rate_pct.toFixed(1)}%`}</p></div>
        <div><p className="text-xs text-muted-foreground">Unapproved absences</p><p className="mt-1 font-medium tabular-nums">{detail.attendance.unapproved_absences}</p></div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Team on-time average: {detail.team_average.on_time_rate_pct === null ? '—' : `${detail.team_average.on_time_rate_pct.toFixed(1)}%`}</p>
    </section>
  </div>;
}

export function HrPerformanceView() {
  const today = kampalaDate();
  const [preset, setPreset] = useState<Preset>('month');
  const [fromDraft, setFromDraft] = useState(`${today.slice(0, 7)}-01`);
  const [toDraft, setToDraft] = useState(today);
  const [role, setRole] = useState<PerformanceRole | 'all'>('all');
  const [report, setReport] = useState<StaffPerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<StaffPerformanceMetric | null>(null);
  const [detail, setDetail] = useState<StaffPerformancePersonDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const range = useMemo(() => rangeFor(preset, fromDraft, toDraft), [preset, fromDraft, toDraft]);

  const loadReport = useCallback(async (staffId?: string) => {
    setLoading(!staffId);
    setError('');
    const result = await getStaffPerformanceReportAction({ ...range, role, ...(staffId ? { staffId } : {}) });
    if (result.success && result.data) {
      if (staffId) setDetail(result.data.person_detail);
      else setReport(result.data);
    } else if (!result.success) setError(result.error?.message || 'Could not load staff performance.');
    setLoading(false);
    setDetailLoading(false);
  }, [range, role]);

  useSalonLiveRefresh(() => { void loadReport(); }, true, ['app_user', 'business_day', 'visit', 'visit_service', 'service_variant', 'service', 'payment', 'payment_adjustment', 'attendance', 'rota_entry', 'work_hours_policy', 'leave_request', 'app_setting']);

  useEffect(() => { void loadReport(); }, [loadReport]);

  const openPerson = async (metric: StaffPerformanceMetric) => {
    setSelected(metric);
    setDetail(null);
    setDetailLoading(true);
    await loadReport(metric.staff_id);
  };

  const exportColumns = [
    { label: 'Staff member', value: (row: StaffPerformanceMetric) => row.name },
    { label: 'Role', value: (row: StaffPerformanceMetric) => roleLabel(row.role) },
    { label: 'Services completed', value: (row: StaffPerformanceMetric) => row.is_service_staff ? row.services_completed : 'Not applicable' },
    { label: 'People served', value: (row: StaffPerformanceMetric) => row.is_service_staff ? row.customers_served ?? 0 : 'Not applicable' },
    { label: 'Average service minutes', value: (row: StaffPerformanceMetric) => row.avg_service_minutes ?? 'Not applicable' },
    { label: 'Expected minutes', value: (row: StaffPerformanceMetric) => row.avg_expected_minutes ?? 'Not applicable' },
    { label: 'Utilisation percent', value: (row: StaffPerformanceMetric) => row.utilization_pct ?? 'Not applicable' },
    { label: 'On-time rate percent', value: (row: StaffPerformanceMetric) => row.on_time_rate_pct ?? '—' },
    { label: 'Days present', value: (row: StaffPerformanceMetric) => row.days_present },
    { label: 'Hours worked', value: (row: StaffPerformanceMetric) => row.hours_worked.toFixed(1) },
    { label: 'Target progress', value: (row: StaffPerformanceMetric) => row.target_goal ? `${row.target_current ?? 0} / ${row.target_goal}` : 'No target' },
    { label: 'Top service categories', value: (row: StaffPerformanceMetric) => row.top_categories.map((category) => `${category.category} (${category.services})`).join('; ') || '—' },
  ];

  const team = report?.team;
  const people = report?.people || [];

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div><h2 className="text-2xl font-semibold tracking-tight">Staff performance</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Read-only service and attendance measures. Service time uses Start and Done taps; paper-entered and corrected times are excluded.</p></div>
      <HrExportMenu title="Staff performance" filename="staff-performance" rows={people} filters={`${range.fromDate} to ${range.toDate} · Role: ${role === 'all' ? 'all' : roleLabel(role)}`} columns={exportColumns} />
    </div>

    <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3.5 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span><strong>People-only report.</strong> Customer identities, contact details, prices and revenue are excluded. “People served” counts eligible completed visits only.</span></div>

    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex flex-wrap gap-1">{(['today', 'week', 'month', 'custom'] as const).map((item) => <Button key={item} type="button" size="sm" variant={preset === item ? 'default' : 'outline'} onClick={() => setPreset(item)}>{item === 'today' ? 'Today' : item === 'week' ? 'This week' : item === 'month' ? 'This month' : 'Custom'}</Button>)}</div>
      {preset === 'custom' && <div className="flex flex-wrap items-center gap-2 text-sm"><label className="sr-only" htmlFor="performance-from">From</label><input id="performance-from" aria-label="From date" type="date" value={fromDraft} onChange={(event) => setFromDraft(event.target.value)} className="rounded-lg border bg-background px-3 py-2"/><span className="text-muted-foreground">to</span><label className="sr-only" htmlFor="performance-to">To</label><input id="performance-to" aria-label="To date" type="date" value={toDraft} onChange={(event) => setToDraft(event.target.value)} className="rounded-lg border bg-background px-3 py-2"/></div>}
      <label className="flex items-center gap-2 text-sm sm:ml-auto"><span className="text-muted-foreground">Role</span><select value={role} onChange={(event) => setRole(event.target.value as PerformanceRole | 'all')} className="rounded-lg border bg-background px-3 py-2"><option value="all">All roles</option><option value="staff">Service staff</option><option value="receptionist">Receptionist</option><option value="manager">Manager</option><option value="hr">HR</option></select></label>
    </div>

    {error && <div role="alert" className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}<button aria-label="Dismiss error" onClick={() => setError('')}><X className="h-4 w-4" /></button></div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MetricTile label="Services completed" value={team?.services_completed ?? '—'} hint="Measured staff lines" icon={Activity}/>
      <MetricTile label="People served" value={team?.customers_served ?? '—'} hint="Distinct paid visits" icon={Users}/>
      <MetricTile label="Average service time" value={team?.avg_service_minutes == null ? '—' : `${team.avg_service_minutes.toFixed(1)} min`} hint="Measured lines" icon={Clock3}/>
      <MetricTile label="On-time rate" value={team?.on_time_rate_pct == null ? '—' : `${team.on_time_rate_pct.toFixed(1)}%`} hint="Clock-in days" icon={Activity}/>
      <MetricTile label="Hours worked" value={team?.hours_worked == null ? '—' : team.hours_worked.toFixed(1)} hint="Recorded attendance" icon={Clock3}/>
    </div>

    <Card className="overflow-hidden">
      {loading ? <div className="space-y-3 p-5" aria-label="Loading performance report">{[1, 2, 3, 4].map((n) => <div key={n} className="h-10 animate-pulse rounded bg-muted" />)}</div> : people.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">No staff records match this period and role.</div> : <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-3">Staff member</th><th className="px-3 py-3">Role</th><th className="px-3 py-3 text-right">Services</th><th className="px-3 py-3 text-right">People served</th><th className="px-3 py-3 text-right">Average / expected</th><th className="px-3 py-3 text-right">Utilisation</th><th className="px-3 py-3 text-right">On-time rate</th><th className="px-3 py-3 text-right">Days present</th><th className="px-3 py-3 text-right">Hours worked</th><th className="px-4 py-3">Target progress</th><th className="px-4 py-3">Top categories</th></tr></thead>
          <tbody className="divide-y">
            {people.map((person) => <tr key={person.staff_id} className="hover:bg-muted/30">
              <td className="px-4 py-3"><button type="button" onClick={() => void openPerson(person)} className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{person.name}</button></td>
              <td className="px-3 py-3 text-muted-foreground">{roleLabel(person.role)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{person.is_service_staff ? person.services_completed : 'Not applicable'}</td>
              <td className="px-3 py-3 text-right tabular-nums">{person.is_service_staff ? person.customers_served ?? 0 : 'Not applicable'}</td>
              <td className="px-3 py-3 text-right tabular-nums">{person.is_service_staff ? `${duration(person.avg_service_minutes)} / ${duration(person.avg_expected_minutes)}` : 'Not applicable'}</td>
              <td className="px-3 py-3 text-right tabular-nums">{person.is_service_staff ? person.utilization_pct == null ? '—' : `${person.utilization_pct.toFixed(1)}%` : 'Not applicable'}</td>
              <td className="px-3 py-3 text-right tabular-nums">{person.on_time_rate_pct == null ? '—' : `${person.on_time_rate_pct.toFixed(1)}%`}</td>
              <td className="px-3 py-3 text-right tabular-nums">{person.days_present}</td>
              <td className="px-3 py-3 text-right tabular-nums">{person.hours_worked.toFixed(1)}</td>
              <td className="px-4 py-3 text-xs tabular-nums">{person.is_service_staff && person.target_goal ? `${person.target_current ?? 0} / ${person.target_goal} (${person.target_progress_pct ?? 0}%)` : '—'}</td>
              <td className="max-w-48 px-4 py-3 text-xs text-muted-foreground">{person.is_service_staff ? person.top_categories.map((category) => category.category).join(', ') || '—' : 'Not applicable'}</td>
            </tr>)}
          </tbody>
        </table>
      </div>}
      <div className="border-t px-4 py-3 text-xs text-muted-foreground">Measured lines only. Paper-entered and corrected service times are excluded from service metrics.</div>
    </Card>

    <DetailModal isOpen={Boolean(selected)} onClose={() => { setSelected(null); setDetail(null); }} title={selected?.name || 'Staff performance'} subtitle={selected ? `${roleLabel(selected.role)} · ${range.fromDate} to ${range.toDate}` : undefined}>
      {detailLoading ? <div className="space-y-3 py-4">{[1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded bg-muted" />)}</div> : selected ? <PersonDetail detail={detail} metric={selected} /> : null}
    </DetailModal>
  </div>;
}
