'use client';

import { showToast } from '@/shared/lib/toast';
import { showConfirm } from '@/shared/lib/toast';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  getStaffListAction,
  toggleStaffStatusAction,
  setStaffTargetAction,
  resetManagerStaffPinAction,
  type ManagerStaffMember,
  type StaffTargetSetting,
} from '../controllers/manager-nav.actions';
import { Users, Shield, Phone, Calendar, CheckCircle2, Award, Target, TrendingUp, X } from 'lucide-react';
import { StaffSkillsEditor } from '@/shared/views/ui/staff-skills-editor';
import { getStaffSkillsEditorAction, saveStaffSkillsAction, type StaffSkillService } from '@/modules/staff-skills';
import { formatUgPhoneDisplay } from '@/shared/models/phone';
import { openCredentialSlip } from '@/shared/views/ui/credential-slip-actions';

export function ManagerStaffView() {
  const [staff, setStaff] = useState<ManagerStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Set Target Modal State
  const [targetModalStaff, setTargetModalStaff] = useState<ManagerStaffMember | null>(null);
  const [targetCustomers, setTargetCustomers] = useState<number>(50);
  const [targetPeriod, setTargetPeriod] = useState<'weekly' | 'monthly' | '3-month'>('monthly');
  const [targetDeadline, setTargetDeadline] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });
  const [commissionPercent, setCommissionPercent] = useState<number>(10);
  const [savingTarget, setSavingTarget] = useState(false);
  const [skillsMember, setSkillsMember] = useState<ManagerStaffMember | null>(null);
  const [skillServices, setSkillServices] = useState<StaffSkillService[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [savingSkills, setSavingSkills] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);
  const [resetPinResult, setResetPinResult] = useState<{ userName: string; username: string; role: string; pin: string } | null>(null);

  const loadStaff = async () => {
    setLoading(true);
    const res = await getStaffListAction();
    if (res.success && res.data) {
      setStaff(res.data);
    }
    setLoading(false);
  };
  useSalonLiveRefresh(() => { void loadStaff(); });


  useEffect(() => {
    loadStaff();
  }, []);

  const handleToggle = async (member: ManagerStaffMember) => {
    setTogglingId(member.id);
    const nextStatus = member.status === 'active' ? 'inactive' : 'active';
    const res = await toggleStaffStatusAction(member.id, nextStatus);
    if (res.success) {
      setFeedback(`Status for ${member.display_name} set to ${nextStatus.toUpperCase()}`);
      loadStaff();
    } else {
      showToast(`Error toggling staff status: ${res.error || 'Failed'}`);
    }
    setTogglingId(null);
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetModalStaff) return;
    setSavingTarget(true);
    const res = await setStaffTargetAction({
      staffId: targetModalStaff.id,
      targetCustomers: Number(targetCustomers),
      period: targetPeriod,
      deadline: targetDeadline,
      commissionBasePercent: Number(commissionPercent),
    });
    if (res.success) {
      setFeedback(`Target saved for ${targetModalStaff.display_name}: ${targetCustomers} customers (${targetPeriod})`);
      setTargetModalStaff(null);
      loadStaff();
    } else {
      showToast(`Error setting target: ${res.error || 'Failed'}`);
    }
    setSavingTarget(false);
  };

  const openTargetModal = (m: ManagerStaffMember) => {
    setTargetModalStaff(m);
    if (m.target) {
      setTargetCustomers(m.target.target_customers);
      setTargetPeriod(m.target.period);
      setTargetDeadline(m.target.deadline);
      setCommissionPercent(m.target.commission_base_percent || 10);
    } else {
      setTargetCustomers(50);
      setTargetPeriod('monthly');
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      setTargetDeadline(d.toISOString().split('T')[0]);
      setCommissionPercent(10);
    }
  };

  const openSkills = async (member: ManagerStaffMember) => {
    setSkillError(null);
    const result = await getStaffSkillsEditorAction(member.id);
    if (result.success && result.data) { setSkillServices(result.data.services); setSelectedSkillIds(result.data.selectedServiceIds); setSkillsMember(member); }
    else if (!result.success) setFeedback(result.error?.message || 'Could not load staff skills.');
  };
  const saveSkills = async (ids: string[]) => {
    if (!skillsMember) return;
    setSavingSkills(true); setSkillError(null);
    const result = await saveStaffSkillsAction(skillsMember.id, ids);
    if (result.success) { setFeedback(`Skills saved for ${skillsMember.display_name}.`); setSkillsMember(null); loadStaff(); }
    else setSkillError(result.error?.message || 'Could not save skills. Try again.');
    setSavingSkills(false);
  };
  const handleResetPin = async (member: ManagerStaffMember) => {
    if (!await showConfirm(`Reset the PIN for ${member.full_name}? They will need to choose a new PIN at their next sign-in.`)) return;
    const result = await resetManagerStaffPinAction(member.id);
    if (!result.success) {
      setFeedback(result.error.message || 'Could not reset this PIN.');
      return;
    }
    setResetPinResult({ userName: member.full_name, username: member.username, role: member.role, pin: result.data.newPin });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Staff Administration</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational personnel directory, targets, commission bases, and performance oversight
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStaff} disabled={loading}>
          Refresh Directory
        </Button>
      </div>

      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-700 font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {resetPinResult && (
        <Card className="border-amber-300 bg-amber-50 p-4 space-y-2">
          <div className="font-semibold text-amber-950">Temporary PIN reset for {resetPinResult.userName}</div>
          <p className="text-xs text-amber-900">This PIN is shown once. Give it privately to the staff member; they must choose a new PIN at sign-in.</p>
          <div className="text-2xl font-bold tracking-[0.25em] text-amber-950 [font-family:ui-monospace]">{resetPinResult.pin}</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(`Username: ${resetPinResult.username}\nTemporary PIN: ${resetPinResult.pin}`); setFeedback('Temporary credentials copied. Share them privately.'); }}>Copy credentials</Button>
            <Button size="sm" variant="outline" onClick={() => { if (!openCredentialSlip({ fullName: resetPinResult.userName, role: resetPinResult.role, username: resetPinResult.username, pin: resetPinResult.pin })) setFeedback('Allow the print window to open, then try again.'); }}>Print slip</Button>
            <Button size="sm" variant="ghost" onClick={() => setResetPinResult(null)}>Close</Button>
          </div>
        </Card>
      )}

      {/* Target Setting Modal */}
      {skillsMember && <StaffSkillsEditor staffName={skillsMember.display_name} services={skillServices} selectedIds={selectedSkillIds} isOpen saving={savingSkills} error={skillError} onClose={() => setSkillsMember(null)} onSave={saveSkills} />}
      {targetModalStaff && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-300">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                <span>Set Target: {targetModalStaff.display_name}</span>
              </h3>
              <button
                onClick={() => setTargetModalStaff(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTarget} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Target Number of Customers
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={targetCustomers}
                  onChange={(e) => setTargetCustomers(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Period</label>
                  <select
                    value={targetPeriod}
                    onChange={(e) => setTargetPeriod(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="3-month">3-Month</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Deadline</label>
                  <input
                    type="date"
                    required
                    value={targetDeadline}
                    onChange={(e) => setTargetDeadline(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Commission Base Rate (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  required
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Monthly customer volume acts as the commission baseline for staff pay calculation.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTargetModalStaff(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingTarget}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs"
                >
                  {savingTarget ? 'Saving...' : 'Save Target & Rate'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Team Roster ({staff.length} profiles)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading staff members...</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {staff.map((m) => {
                const currentProgress = m.customers_served_period || 0;
                const targetGoal = m.target?.target_customers || 0;
                const pct = targetGoal > 0 ? Math.min(100, Math.round((currentProgress / targetGoal) * 100)) : 0;

                return (
                  <div key={m.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/40">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{m.display_name}</span>
                        <span className="text-xs text-muted-foreground">({m.full_name})</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 ">
                          {m.role}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full  ${
                          m.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {m.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" /> {formatUgPhoneDisplay(m.phone)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> Started: {m.start_date}
                        </span>
                        {m.role === 'staff' && (
                          <span className="flex items-center gap-1 text-slate-700 font-medium">
                            <Award className="w-3.5 h-3.5 text-amber-500" /> {m.skill_count} certified skill(s)
                          </span>
                        )}
                      </div>

                      {/* Target & Commission Display */}
                      {m.role === 'staff' && (
                        <div className="pt-1 flex items-center gap-3 text-xs flex-wrap">
                          {m.target ? (
                            <div className="flex items-center gap-2 bg-blue-50/70 border border-blue-200 px-2.5 py-1 rounded-xl text-blue-900">
                              <Target className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="font-medium">
                                Target: <strong>{currentProgress}</strong> / {m.target.target_customers} clients ({pct}%)
                              </span>
                              <span className="text-[10px] text-blue-700  font-semibold">
                                • {m.target.period} (due {m.target.deadline})
                              </span>
                              {m.target.commission_base_percent && (
                                <span className="text-[10px] bg-blue-200 text-blue-900 px-1.5 py-0.2 rounded font-bold">
                                  {m.target.commission_base_percent}% Comm.
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No customer target set</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {m.status === 'active' && ['staff', 'receptionist'].includes(m.role) && <Button variant="outline" size="sm" onClick={() => handleResetPin(m)} className="h-8 text-xs">Reset PIN</Button>}
                      {m.role === 'staff' && m.status === 'active' && <Button variant="outline" size="sm" onClick={() => openSkills(m)} className="h-8 text-xs">Assign skills</Button>}
                      {m.role === 'staff' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTargetModal(m)}
                          className="h-8 text-xs font-semibold border-blue-200 text-blue-700 hover:bg-blue-50 flex items-center gap-1.5"
                        >
                          <Target className="w-3.5 h-3.5" />
                          <span>{m.target ? 'Edit Target' : 'Set Target'}</span>
                        </Button>
                      )}
                      <Button
                        variant={m.status === 'active' ? 'outline' : 'default'}
                        size="sm"
                        className={`h-8 text-xs font-semibold ${
                          m.status === 'active' ? 'text-rose-600 hover:bg-rose-50 border-rose-200' : 'bg-emerald-600 text-white'
                        }`}
                        onClick={() => handleToggle(m)}
                        disabled={togglingId === m.id || m.role === 'owner'}
                      >
                        {togglingId === m.id ? 'Updating...' : m.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
