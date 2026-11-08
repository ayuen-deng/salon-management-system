'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import { Activity, Clock3, Scissors, Shield, Users } from 'lucide-react';
import { Card } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { getStaffPerformanceReportAction, type PerformanceRole, type StaffPerformanceMetric, type StaffPerformanceReport } from '@/modules/staff-performance';

type Period = 'today' | 'week' | 'month';

function kampalaDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function periodRange(period: Period) {
  const today = kampalaDate();
  if (period === 'today') return { fromDate: today, toDate: today };
  const start = new Date(`${today}T12:00:00+03:00`);
  if (period === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  else start.setDate(1);
  return { fromDate: kampalaDate(start), toDate: today };
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums">{value}</p></div>;
}

function ServiceCard({ person }: { person: StaffPerformanceMetric }) {
  return <Card className="space-y-3 p-4">
    <div className="flex items-start justify-between gap-3"><div><h4 className="font-medium">{person.name}</h4><p className="text-xs text-muted-foreground">Service staff</p></div><Scissors className="h-4 w-4 text-primary" /></div>
    <div className="grid grid-cols-2 gap-2 text-sm">
      <Metric label="Services completed" value={person.services_completed ?? 0}/>
      <Metric label="People served" value={person.customers_served ?? 0}/>
      <Metric label="Measured / expected" value={person.avg_service_minutes == null ? '—' : `${person.avg_service_minutes.toFixed(1)} / ${person.avg_expected_minutes?.toFixed(1) ?? '—'} min`}/>
      <Metric label="Utilisation" value={person.utilization_pct == null ? '—' : `${person.utilization_pct.toFixed(1)}%`}/>
      <Metric label="Days present" value={person.days_present}/>
      <Metric label="Hours worked" value={person.hours_worked.toFixed(1)}/>
      <Metric label="On-time rate" value={person.on_time_rate_pct == null ? '—' : `${person.on_time_rate_pct.toFixed(1)}%`}/>
      <Metric label="Target progress" value={person.target_goal ? `${person.target_current ?? 0} / ${person.target_goal}` : '—'}/>
    </div>
    <p className="text-xs text-muted-foreground">Top service categories: {person.top_categories.map((category) => category.category).join(', ') || '—'}</p>
  </Card>;
}

function SupportCard({ person }: { person: StaffPerformanceMetric }) {
  const role = person.role === 'hr' ? 'HR' : person.role === 'manager' ? 'Manager' : 'Receptionist';
  return <Card className="space-y-3 p-4">
    <div className="flex items-start justify-between gap-3"><div><h4 className="font-medium">{person.name}</h4><p className="text-xs text-muted-foreground">{role}</p></div><Shield className="h-4 w-4 text-primary" /></div>
    <div className="grid grid-cols-2 gap-2 text-sm">
      <Metric label="Days present" value={person.days_present}/>
      <Metric label="Hours worked" value={person.hours_worked.toFixed(1)}/>
      <Metric label="On-time rate" value={person.on_time_rate_pct == null ? '—' : `${person.on_time_rate_pct.toFixed(1)}%`}/>
      <Metric label="Unapproved absences" value={person.unapproved_absences}/>
    </div>
    <p className="text-xs text-muted-foreground">Service measures are not applicable for this role.</p>
  </Card>;
}

export function OwnerStaffView() {
  const [period, setPeriod] = useState<Period>('today');
  const [report, setReport] = useState<StaffPerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const range = useMemo(() => periodRange(period), [period]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await getStaffPerformanceReportAction({ ...range, role: 'all' as PerformanceRole | 'all' });
    if (result.success && result.data) setReport(result.data);
    else if (!result.success) setError(result.error?.message || 'Could not load staff metrics.');
    setLoading(false);
  }, [range]);

  useSalonLiveRefresh(() => { void load(); });

  useEffect(() => { void load(); }, [load]);

  const serviceStaff = report?.people.filter((person) => person.is_service_staff) || [];
  const supportStaff = report?.people.filter((person) => !person.is_service_staff) || [];

  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-base font-semibold">Staff performance</h2><p className="mt-1 text-xs text-muted-foreground">The same measured service and attendance source used by HR.</p></div>
      <div className="flex gap-1">{(['today', 'week', 'month'] as const).map((value) => <Button key={value} type="button" size="sm" variant={period === value ? 'default' : 'outline'} onClick={() => setPeriod(value)}>{value === 'today' ? 'Today' : value === 'week' ? 'This week' : 'This month'}</Button>)}</div>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Services completed" value={report?.team.services_completed ?? '—'}/>
      <Metric label="People served" value={report?.team.customers_served ?? '—'}/>
      <Metric label="Average service time" value={report?.team.avg_service_minutes == null ? '—' : `${report.team.avg_service_minutes.toFixed(1)} min`}/>
      <Metric label="On-time rate" value={report?.team.on_time_rate_pct == null ? '—' : `${report.team.on_time_rate_pct.toFixed(1)}%`}/>
      <Metric label="Hours worked" value={report?.team.hours_worked.toFixed(1) ?? '—'}/>
    </div>

    <section className="space-y-3"><div className="flex items-center gap-2"><Scissors className="h-4 w-4 text-primary"/><h3 className="text-sm font-semibold">Service staff</h3><span className="text-xs text-muted-foreground">{serviceStaff.length}</span></div>
      {loading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[1,2,3].map((n)=><div key={n} className="h-48 animate-pulse rounded-xl border bg-muted"/>)}</div> : serviceStaff.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{serviceStaff.map((person)=><ServiceCard key={person.staff_id} person={person}/>)}</div> : <Card className="p-8 text-center text-sm text-muted-foreground">No service staff in this period.</Card>}
    </section>
    <section className="space-y-3"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary"/><h3 className="text-sm font-semibold">Management and support</h3><span className="text-xs text-muted-foreground">{supportStaff.length}</span></div>
      {loading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[1,2,3].map((n)=><div key={n} className="h-40 animate-pulse rounded-xl border bg-muted"/>)}</div> : supportStaff.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{supportStaff.map((person)=><SupportCard key={person.staff_id} person={person}/>)}</div> : <Card className="p-8 text-center text-sm text-muted-foreground">No support staff in this period.</Card>}
    </section>
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="h-3.5 w-3.5"/><Clock3 className="h-3.5 w-3.5"/>Measured service lines use Start and Done taps. Paper-entered and corrected service times are excluded.</p>
  </div>;
}
