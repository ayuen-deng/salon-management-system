'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  Calendar,
  Filter,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  AlertCircle,
  X,
  FileText,
  Save,
} from 'lucide-react';
import {
  getLeaveRecordsAction,
  recordLeaveAction,
  decideLeaveRequestAction,
  getStaffDirectoryAction,
  getAnnualLeavePolicyAction,
  saveAnnualLeavePolicyAction,
  getLeaveBalancesAction,
  savePersonLeaveEntitlementAction,
  type HrLeaveRecord,
  type HrStaffMember,
  type HrAnnualLeavePolicy,
  type HrLeaveBalance,
} from '../controllers/hr.actions';
import { HrExportMenu } from './hr-export-menu';

export function HrLeaveView() {
  const [leaves, setLeaves] = useState<HrLeaveRecord[]>([]);
  const [staffList, setStaffList] = useState<HrStaffMember[]>([]);
  const [annualPolicy, setAnnualPolicy] = useState<HrAnnualLeavePolicy>({ entitlement_by_role: {}, leave_year_start_month: 1, leave_year_start_day: 1, public_holidays: [] });
  const [balances, setBalances] = useState<HrLeaveBalance[]>([]);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>({});
  const [holidayDraft, setHolidayDraft] = useState('');
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'requests'>('upcoming');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Record Leave Modal
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [newLeave, setNewLeave] = useState({
    staffUserId: '',
    fromDate: new Date().toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
    leaveType: 'annual_leave' as 'annual_leave' | 'unpaid_leave' | 'other_approved_leave',
    status: 'approved' as 'requested' | 'approved',
  });

  // Decision Modal (for requested items)
  const [decidingLeave, setDecidingLeave] = useState<HrLeaveRecord | null>(null);
  const [decisionType, setDecisionType] = useState<'approved' | 'rejected'>('approved');

  const loadData = async () => {
    setLoading(true);
    const [leaveRes, staffRes, policyRes, balanceRes] = await Promise.all([
      getLeaveRecordsAction(),
      getStaffDirectoryAction(),
      getAnnualLeavePolicyAction(),
      getLeaveBalancesAction(),
    ]);

    if (leaveRes.success && leaveRes.data) {
      setLeaves(leaveRes.data);
    } else if (!leaveRes.success) {
      setFeedback({ type: 'error', message: leaveRes.error?.message || 'Failed to load leave records.' });
    }

    if (staffRes.success && staffRes.data) {
      const activeStaff = staffRes.data.filter((s) => s.status === 'active');
      setStaffList(activeStaff);
      if (activeStaff.length > 0 && !newLeave.staffUserId) {
        setNewLeave((prev) => ({ ...prev, staffUserId: activeStaff[0].id }));
      }
    }
    if (policyRes.success && policyRes.data) setAnnualPolicy(policyRes.data);
    if (balanceRes.success && balanceRes.data) setBalances(balanceRes.data);
    setLoading(false);
  };
  useSalonLiveRefresh(() => { void loadData(); }, true, ['app_user', 'staff_skill', 'service', 'app_setting', 'leave_request', 'annual_leave_policy', 'annual_leave_entitlement_override', 'attendance', 'rota_entry', 'work_hours_policy']);


  useEffect(() => {
    loadData();
    const refreshAfterNotification = () => { void loadData(); };
    window.addEventListener('salon-notifications-updated', refreshAfterNotification);
    return () => window.removeEventListener('salon-notifications-updated', refreshAfterNotification);
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const upcomingLeaves = useMemo(() => {
    return leaves.filter((l) => l.status === 'approved' && l.to_date >= today);
  }, [leaves, today]);

  const pastLeaves = useMemo(() => {
    return leaves.filter((l) => l.to_date < today || l.status === 'rejected' || l.status === 'cancelled');
  }, [leaves, today]);

  const requestedLeaves = useMemo(() => {
    return leaves.filter((l) => l.status === 'requested');
  }, [leaves]);

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeave.staffUserId) {
      setFeedback({ type: 'error', message: 'Please select a staff member.' });
      return;
    }
    const res = await recordLeaveAction({ ...newLeave, reason: `HR recorded ${newLeave.leaveType}` });
    if (res.success) {
      setFeedback({ type: 'success', message: 'Leave record saved successfully.' });
      setShowRecordModal(false);
      setNewLeave({
        staffUserId: staffList[0]?.id || '',
        fromDate: today,
        toDate: today,
        leaveType: 'annual_leave',
        status: 'approved',
      });
      loadData();
    } else {
      setFeedback({ type: 'error', message: res.error?.message || 'Failed to record leave.' });
    }
  };

  const handleDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decidingLeave) return;
    const res = await decideLeaveRequestAction({
      leaveId: decidingLeave.id,
      decision: decisionType,
    });

    if (res.success) {
      setFeedback({ type: 'success', message: `Leave request has been marked as ${decisionType}.` });
      setDecidingLeave(null);
      loadData();
    } else {
      setFeedback({ type: 'error', message: res.error?.message || 'Failed to update leave request.' });
    }
  };

  const savePolicy = async () => {
    setSavingPolicy(true);
    const result = await saveAnnualLeavePolicyAction(annualPolicy);
    setFeedback(result.success
      ? { type: 'success', message: 'Leave policy saved.' }
      : { type: 'error', message: result.error?.message || 'Could not save leave policy.' });
    setSavingPolicy(false);
    if (result.success) loadData();
  };

  const saveOverride = async (staffUserId: string) => {
    const raw = overrideDrafts[staffUserId] ?? '';
    const days = raw.trim() === '' ? null : Number(raw);
    if (days !== null && (!Number.isFinite(days) || days < 0 || days > 365)) {
      setFeedback({ type: 'error', message: 'Enter an entitlement from 0 to 365 days, or leave blank to use the role policy.' });
      return;
    }
    const result = await savePersonLeaveEntitlementAction(staffUserId, days);
    setFeedback(result.success
      ? { type: 'success', message: 'Staff entitlement saved.' }
      : { type: 'error', message: result.error?.message || 'Could not save staff entitlement.' });
    if (result.success) loadData();
  };

  const currentDisplayList =
    activeTab === 'upcoming' ? upcomingLeaves : activeTab === 'past' ? pastLeaves : requestedLeaves;

  return (
    <div className="space-y-6">
      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            )}
            <p className="text-sm font-medium">{feedback.message}</p>
          </div>
          <button onClick={() => setFeedback(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Leave Management</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Record, approve, and track staff leaves and scheduled absences. Approved leave removes staff from expected roster counts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HrExportMenu title="Leave records" filename="leave" rows={currentDisplayList} filters={`View: ${activeTab}`} columns={[{ label: 'Staff', value: (r) => r.staff_name }, { label: 'Role', value: (r) => r.role }, { label: 'From', value: (r) => r.from_date }, { label: 'To', value: (r) => r.to_date }, { label: 'Leave type', value: (r) => r.leave_type }, { label: 'Status', value: (r) => r.status }, { label: 'Requested by', value: (r) => r.requested_by_name }, { label: 'Decided by', value: (r) => r.decided_by_name || '—' }]} />
          <HrExportMenu title="Leave balances" filename="leave-balances" rows={balances} filters="Current leave year" columns={[{ label: 'Staff', value: (r) => r.staff_name }, { label: 'Role', value: (r) => r.role }, { label: 'Entitlement days', value: (r) => r.entitlement_days ?? 'Not configured' }, { label: 'Taken days', value: (r) => r.days_taken }, { label: 'Approved upcoming days', value: (r) => r.days_approved_upcoming }, { label: 'Pending days', value: (r) => r.days_pending }, { label: 'Remaining days', value: (r) => r.days_remaining ?? 'Not configured' }]} />
          <Button
            onClick={() => setShowRecordModal(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Record Leave
          </Button>
        </div>
      </div>

      <Card className="rounded-xl border border-border/60 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Annual leave policy & balances</CardTitle>
          <p className="text-xs text-muted-foreground">Set entitlements only after confirming the salon’s policy. No statutory entitlement is assumed. Balances count approved annual leave on scheduled working days, excluding listed public holidays.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['staff','receptionist','manager','hr'] as const).map((role) => <label key={role} className="text-xs font-medium capitalize">{role} annual days
              <input aria-label={`${role} annual leave days`} type="number" min="0" max="365" step="0.5" value={annualPolicy.entitlement_by_role[role] ?? ''} placeholder="Not configured" onChange={(event) => setAnnualPolicy((current) => ({ ...current, entitlement_by_role: { ...current.entitlement_by_role, [role]: event.target.value === '' ? null : Number(event.target.value) } }))} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>)}
            <label className="text-xs font-medium">Leave year starts (month/day)
              <div className="mt-1 flex gap-2"><input aria-label="Leave year start month" type="number" min="1" max="12" value={annualPolicy.leave_year_start_month} onChange={(event) => setAnnualPolicy({ ...annualPolicy, leave_year_start_month: Number(event.target.value) })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /><input aria-label="Leave year start day" type="number" min="1" max="31" value={annualPolicy.leave_year_start_day} onChange={(event) => setAnnualPolicy({ ...annualPolicy, leave_year_start_day: Number(event.target.value) })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></div>
            </label>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <label className="text-xs font-medium flex-1">Public holiday date
              <input type="date" value={holidayDraft} onChange={(event) => setHolidayDraft(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <Button type="button" variant="outline" disabled={!holidayDraft} onClick={() => { if (!annualPolicy.public_holidays.includes(holidayDraft)) setAnnualPolicy({ ...annualPolicy, public_holidays: [...annualPolicy.public_holidays, holidayDraft].sort() }); setHolidayDraft(''); }}>Add date</Button>
            <Button type="button" disabled={savingPolicy} onClick={savePolicy} className="gap-2"><Save className="w-4 h-4" />{savingPolicy ? 'Saving…' : 'Save policy'}</Button>
          </div>
          {annualPolicy.public_holidays.length > 0 && <div className="flex flex-wrap gap-2">{annualPolicy.public_holidays.map((date) => <span key={date} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">{date}<button type="button" aria-label={`Remove ${date}`} onClick={() => setAnnualPolicy({ ...annualPolicy, public_holidays: annualPolicy.public_holidays.filter((day) => day !== date) })}><X className="h-3 w-3" /></button></span>)}</div>}
          <div className="overflow-x-auto rounded-lg border border-border/60"><table className="w-full min-w-[800px] text-sm"><thead className="bg-muted/40"><tr>{['Staff','Role','Entitlement','Taken','Approved upcoming','Pending','Remaining','Person override'].map((heading) => <th key={heading} className="px-3 py-2 text-left text-xs font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-border/40">{balances.map((row) => <tr key={row.staff_user_id}><td className="px-3 py-2 font-medium">{row.staff_name}</td><td className="px-3 py-2 capitalize">{row.role}</td><td className="px-3 py-2">{row.entitlement_days ?? 'Not configured'}</td><td className="px-3 py-2">{row.days_taken}</td><td className="px-3 py-2">{row.days_approved_upcoming}</td><td className="px-3 py-2">{row.days_pending}</td><td className="px-3 py-2">{row.days_remaining ?? '—'}</td><td className="px-3 py-2"><div className="flex gap-2"><input aria-label={`${row.staff_name} entitlement override`} type="number" min="0" max="365" step="0.5" placeholder="Role default" value={overrideDrafts[row.staff_user_id] ?? ''} onChange={(event) => setOverrideDrafts({ ...overrideDrafts, [row.staff_user_id]: event.target.value })} className="w-28 rounded-md border border-border bg-background px-2 py-1" /><Button type="button" size="sm" variant="outline" onClick={() => saveOverride(row.staff_user_id)}>Save</Button></div><p className="mt-1 text-[10px] text-muted-foreground">Blank uses role default</p></td></tr>)}{balances.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No balance rows available.</td></tr>}</tbody></table></div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-border/60 gap-8">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'upcoming'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Upcoming & Current
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
            {upcomingLeaves.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'past'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="w-4 h-4" />
          Past & Completed
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
            {pastLeaves.length}
          </span>
        </button>
        {requestedLeaves.length > 0 && (
          <button
            onClick={() => setActiveTab('requests')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'requests'
                ? 'border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            Requests
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
              {requestedLeaves.length}
            </span>
          </button>
        )}
      </div>

      {/* Leave List Card */}
      <Card className="rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/40 text-muted-foreground font-medium border-b border-border/40">
              <tr>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">From Date</th>
                <th className="py-3 px-4">To Date</th>
                <th className="py-3 px-4">Leave Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Requested By</th>
                <th className="py-3 px-4">Decided By</th>
                {activeTab === 'requests' && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loading ? (
                <tr>
                  <td colSpan={activeTab === 'requests' ? 9 : 8} className="py-12 text-center text-muted-foreground">
                    Loading leave records...
                  </td>
                </tr>
              ) : currentDisplayList.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'requests' ? 9 : 8} className="py-12 text-center text-muted-foreground">
                    No leave entries found in this view.
                  </td>
                </tr>
              ) : (
                currentDisplayList.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground">{l.staff_name}</td>
                    <td className="py-3 px-4 capitalize text-muted-foreground">{l.role}</td>
                    <td className="py-3 px-4 tabular-nums text-xs">{l.from_date}</td>
                    <td className="py-3 px-4 tabular-nums text-xs">{l.to_date}</td>
                    <td className="py-3 px-4">
                      <span className="capitalize px-2 py-0.5 rounded-full text-xs font-medium border bg-muted/30">
                        {l.leave_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {l.status === 'approved' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                        </span>
                      )}
                      {l.status === 'requested' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <Clock className="w-3.5 h-3.5" /> Pending
                        </span>
                      )}
                      {l.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800">
                          <XCircle className="w-3.5 h-3.5" /> Rejected
                        </span>
                      )}
                      {l.status === 'cancelled' && <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">Cancelled</span>}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{l.requested_by_name}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {l.decided_by_name ? `${l.decided_by_name}` : '—'}
                    </td>
                    {activeTab === 'requests' && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
                            onClick={() => {
                              setDecidingLeave(l);
                              setDecisionType('approved');
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
                            onClick={() => {
                              setDecidingLeave(l);
                              setDecisionType('rejected');
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Record Leave */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Record Leave or Absence</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Record an approved or pending leave period. Do not enter reasons or medical details.
                </p>
              </div>
              <button
                onClick={() => setShowRecordModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateLeave} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">Staff Member</label>
                <select
                  value={newLeave.staffUserId}
                  onChange={(e) => setNewLeave({ ...newLeave, staffUserId: e.target.value })}
                  className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  required
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">From Date</label>
                  <input
                    type="date"
                    value={newLeave.fromDate}
                    onChange={(e) => setNewLeave({ ...newLeave, fromDate: e.target.value })}
                    className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">To Date</label>
                  <input
                    type="date"
                    value={newLeave.toDate}
                    onChange={(e) => setNewLeave({ ...newLeave, toDate: e.target.value })}
                    className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">Leave Type</label>
                  <select
                    value={newLeave.leaveType}
                    onChange={(e) =>
                      setNewLeave({
                        ...newLeave,
                        leaveType: e.target.value as 'annual_leave' | 'unpaid_leave' | 'other_approved_leave',
                      })
                    }
                    className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  >
                    <option value="annual_leave">Annual leave</option>
                    <option value="unpaid_leave">Unpaid leave</option>
                    <option value="other_approved_leave">Other approved leave (not counted)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">Status</label>
                  <select
                    value={newLeave.status}
                    onChange={(e) =>
                      setNewLeave({ ...newLeave, status: e.target.value as 'requested' | 'approved' })
                    }
                    className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  >
                    <option value="approved">Approved Immediately</option>
                    <option value="requested">Pending Request</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button type="button" variant="outline" onClick={() => setShowRecordModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Save Leave Record
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Decide Leave Request */}
      {decidingLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {decisionType === 'approved' ? 'Approve Leave Request' : 'Reject Leave Request'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {decidingLeave.staff_name} ({decidingLeave.from_date} to {decidingLeave.to_date})
                </p>
              </div>
              <button
                onClick={() => setDecidingLeave(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleDecision} className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">{decisionType === 'rejected' ? 'The staff member will be asked to contact HR for details. Do not enter leave reasons or medical information.' : 'Approve this request. No leave reason is collected.'}</p>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button type="button" variant="outline" onClick={() => setDecidingLeave(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className={
                    decisionType === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }
                >
                  Confirm {decisionType === 'approved' ? 'Approval' : 'Rejection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
