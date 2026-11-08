'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import { CalendarDays, CheckCircle2, Clock3, Loader2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { cancelMyLeaveRequestAction, getMyLeaveDataAction, previewMyLeaveRequestAction, requestMyLeaveAction, type StaffLeaveBalance, type StaffLeavePreview, type StaffLeaveRequest } from '../controllers/staff.actions';

type LeaveType = StaffLeaveRequest['leave_type'];
const todayInKampala = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
const leaveTypeLabel = (type: LeaveType) => type === 'annual_leave' ? 'Annual leave' : type === 'unpaid_leave' ? 'Unpaid leave' : 'Other approved leave';

export function StaffLeaveView() {
  const [balance, setBalance] = useState<StaffLeaveBalance | null>(null);
  const [requests, setRequests] = useState<StaffLeaveRequest[]>([]);
  const [leaveType, setLeaveType] = useState<LeaveType>('annual_leave');
  const [fromDate, setFromDate] = useState(todayInKampala());
  const [toDate, setToDate] = useState(todayInKampala());
  const [preview, setPreview] = useState<StaffLeavePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const load = useCallback(async () => {
    const result = await getMyLeaveDataAction();
    if (result.success && result.data) {
      setBalance(result.data.balance);
      setRequests(result.data.requests);
    } else if (!result.success) setFeedback({ type: 'error', message: result.error?.message || 'Could not load your leave records.' });
    setLoading(false);
  }, []);

  useSalonLiveRefresh(() => { void load(); });

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const refreshAfterNotification = () => {
      void load();
      void previewMyLeaveRequestAction({ fromDate, toDate, leaveType }).then((result) => {
        if (result.success) setPreview(result.data || null);
      });
    };
    window.addEventListener('salon-notifications-updated', refreshAfterNotification);
    return () => window.removeEventListener('salon-notifications-updated', refreshAfterNotification);
  }, [fromDate, toDate, leaveType, load]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true);
      const result = await previewMyLeaveRequestAction({ fromDate, toDate, leaveType });
      if (!active) return;
      setPreview(result.success ? result.data || null : null);
      if (!result.success) setFeedback({ type: 'error', message: result.error?.message || 'Could not estimate working days.' });
      setPreviewLoading(false);
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [fromDate, toDate, leaveType]);

  const today = todayInKampala();
  const upcoming = useMemo(() => requests.filter((item) => item.status === 'approved' && item.to_date >= today), [requests, today]);
  const history = useMemo(() => requests.filter((item) => item.status !== 'approved' || item.to_date < today), [requests, today]);
  const invalidRange = fromDate < today || toDate < fromDate;
  const blocked = invalidRange || previewLoading || !preview || preview.overlaps_existing || preview.exceeds_balance || preview.working_days === 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (blocked) return;
    setSubmitting(true);
    const result = await requestMyLeaveAction({ fromDate, toDate, leaveType });
    if (result.success) {
      setFeedback({ type: 'success', message: 'Your leave request was sent to HR.' });
      setPreview(result.data || null);
      await load();
      const refreshedPreview = await previewMyLeaveRequestAction({ fromDate, toDate, leaveType });
      if (refreshedPreview.success) setPreview(refreshedPreview.data || null);
    } else setFeedback({ type: 'error', message: result.error?.message || 'Could not submit leave request.' });
    setSubmitting(false);
  };

  const cancel = async (id: string) => {
    setCancellingId(id);
    const result = await cancelMyLeaveRequestAction(id);
    if (result.success) {
      setFeedback({ type: 'success', message: 'Pending request cancelled.' });
      await load();
      const refreshed = await previewMyLeaveRequestAction({ fromDate, toDate, leaveType });
      if (refreshed.success) setPreview(refreshed.data || null);
    } else setFeedback({ type: 'error', message: result.error?.message || 'Could not cancel this request.' });
    setCancellingId(null);
  };

  return <div className="mx-auto max-w-4xl space-y-5 p-4 pb-24 md:p-6">
    <div><h2 className="text-xl font-semibold text-foreground">My leave</h2><p className="mt-1 text-sm text-muted-foreground">Check your balance and send leave requests to HR.</p></div>
    {feedback && <div role="status" className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}><span>{feedback.message}</span><button onClick={() => setFeedback(null)} aria-label="Dismiss">×</button></div>}

    {loading ? <div className="grid grid-cols-2 gap-3" aria-busy="true">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-xl border border-border bg-muted/40" />)}</div> : <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4 text-primary" />Annual leave balance</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"><BalanceValue label="Entitlement" value={balance?.entitlement_days ?? null} /><BalanceValue label="Taken" value={balance?.days_taken ?? 0} /><BalanceValue label="Approved upcoming" value={balance?.days_approved_upcoming ?? 0} /><BalanceValue label="Pending" value={balance?.days_pending ?? 0} /><BalanceValue label="Remaining" value={balance?.days_remaining ?? null} /></div><p className="mt-3 text-xs text-muted-foreground">Leave year starts {balance?.leave_year_start ? new Date(`${balance.leave_year_start}T12:00:00+03:00`).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Kampala'}) : '1 January'}. {balance?.entitlement_days === null || !balance ? 'Your entitlement is not configured. Contact HR.' : 'Remaining days account for approved upcoming leave.'}</p></CardContent></Card>}

    <Card className="border-border"><CardHeader className="pb-3"><CardTitle className="text-sm">Request leave</CardTitle><p className="text-xs text-muted-foreground">The day count uses your rota or the salon working-day policy. Leave reasons and medical details are not collected.</p></CardHeader><CardContent><form onSubmit={submit} className="space-y-4">
      <label className="block text-xs font-medium">Leave type<select value={leaveType} onChange={(event) => setLeaveType(event.target.value as LeaveType)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value="annual_leave">Annual leave</option><option value="unpaid_leave">Unpaid leave</option><option value="other_approved_leave">Other approved leave</option></select></label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-xs font-medium">From<input type="date" min={today} value={fromDate} onChange={(event) => setFromDate(event.target.value)} required className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label><label className="text-xs font-medium">To<input type="date" min={fromDate} value={toDate} onChange={(event) => setToDate(event.target.value)} required className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label></div>
      {previewLoading ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Counting scheduled workdays…</p> : preview && <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-xs"><p>{preview.working_days} working {preview.working_days === 1 ? 'day' : 'days'} requested</p>{preview.overlaps_existing && <p className="text-rose-700">These dates overlap another pending or approved leave period.</p>}{preview.exceeds_balance && <p className="text-rose-700">This request exceeds your available annual balance. Contact HR.</p>}{preview.working_days === 0 && <p className="text-amber-700">The selected dates have no scheduled working days after holidays are excluded.</p>}</div>}
      <Button type="submit" disabled={blocked || submitting} className="w-full sm:w-auto">{submitting ? 'Sending request…' : 'Send leave request'}</Button>
    </form></CardContent></Card>

    <LeaveList title="Upcoming approved leave" items={upcoming} loading={loading} empty="You have no upcoming approved leave." />
    <Card className="border-border"><CardHeader className="pb-3"><CardTitle className="text-sm">Request history</CardTitle></CardHeader><CardContent className="space-y-2">{loading ? <p className="animate-pulse text-xs text-muted-foreground">Loading request history…</p> : history.length === 0 ? <p className="text-xs text-muted-foreground">No past or pending requests.</p> : history.map((item) => <LeaveRow key={item.id} item={item} onCancel={cancel} cancelling={cancellingId === item.id} />)}</CardContent></Card>
  </div>;
}

function BalanceValue({ label, value }: { label: string; value: number | null }) { return <div className="rounded-lg border border-border/70 bg-white p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value === null ? '—' : value}</p></div>; }

function LeaveList({ title, items, loading, empty }: { title: string; items: StaffLeaveRequest[]; loading: boolean; empty: string }) {
  return <Card className="border-border"><CardHeader className="pb-3"><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent className="space-y-2">{loading ? <p className="animate-pulse text-xs text-muted-foreground">Loading leave…</p> : items.length === 0 ? <p className="text-xs text-muted-foreground">{empty}</p> : items.map((item) => <LeaveRow key={item.id} item={item} />)}</CardContent></Card>;
}

function LeaveRow({ item, onCancel, cancelling = false }: { item: StaffLeaveRequest; onCancel?: (id: string) => void; cancelling?: boolean }) {
  const statusIcon = item.status === 'approved' ? <CheckCircle2 className="h-3.5 w-3.5" /> : item.status === 'rejected' ? <XCircle className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />;
  const statusStyle = item.status === 'approved' ? 'text-emerald-700' : item.status === 'rejected' ? 'text-rose-700' : item.status === 'cancelled' ? 'text-slate-500' : 'text-amber-700';
  const statusLabel = item.status === 'requested' ? 'Pending' : item.status.charAt(0).toUpperCase() + item.status.slice(1);
  return <div className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{leaveTypeLabel(item.leave_type)}</p><p className="mt-1 text-xs text-muted-foreground">{item.from_date} – {item.to_date}</p>{item.status === 'rejected' && <p className="mt-1 text-xs text-muted-foreground">Please contact HR for details.</p>}</div><div className="flex items-center justify-between gap-3 sm:justify-end"><span className={`inline-flex items-center gap-1 text-xs font-medium ${statusStyle}`}>{statusIcon}{statusLabel}</span>{item.status === 'requested' && onCancel && <Button type="button" size="sm" variant="outline" disabled={cancelling} onClick={() => onCancel(item.id)}>{cancelling ? 'Cancelling…' : 'Cancel request'}</Button>}</div></div>;
}
