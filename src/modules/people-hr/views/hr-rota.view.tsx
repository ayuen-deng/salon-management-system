'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  Calendar,
  Clock,
  Copy,
  Save,
  CheckCircle2,
  AlertCircle,
  X,
  Users,
  Edit2,
  CalendarCheck,
} from 'lucide-react';
import {
  getWeeklyRotaAction,
  saveRotaEntryAction,
  copyLastWeekRotaAction,
  type HrWeeklyRota,
  type HrRotaCell,
} from '../controllers/hr.actions';
import { HrExportMenu } from './hr-export-menu';

const WEEKDAYS = [
  { index: 1, name: 'Monday' },
  { index: 2, name: 'Tuesday' },
  { index: 3, name: 'Wednesday' },
  { index: 4, name: 'Thursday' },
  { index: 5, name: 'Friday' },
  { index: 6, name: 'Saturday' },
  { index: 0, name: 'Sunday' },
];

export function HrRotaView() {
  const [rotas, setRotas] = useState<HrWeeklyRota[]>([]);
  const [expectedToday, setExpectedToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit Shift Modal
  const [editingCell, setEditingCell] = useState<{
    staffUserId: string;
    staffName: string;
    weekday: number;
    weekdayName: string;
    isOff: boolean;
    startTime: string;
    endTime: string;
    effectiveFrom: string;
  } | null>(null);

  // Copy Last Week Modal
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyEffectiveDate, setCopyEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  const loadData = async () => {
    setLoading(true);
    const res = await getWeeklyRotaAction();
    if (res.success && res.data) {
      setRotas(res.data.rotas);
      setExpectedToday(res.data.expectedToday);
    } else if (!res.success) {
      setFeedback({ type: 'error', message: res.error?.message || 'Failed to load weekly rota.' });
    }
    setLoading(false);
  };
  useSalonLiveRefresh(() => { void loadData(); }, true, ['app_user', 'rota_entry', 'work_hours_policy']);


  useEffect(() => {
    loadData();
  }, []);

  const handleSaveCell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCell) return;

    const res = await saveRotaEntryAction({
      staffUserId: editingCell.staffUserId,
      weekday: editingCell.weekday,
      isOff: editingCell.isOff,
      startTime: editingCell.startTime,
      endTime: editingCell.endTime,
      effectiveFrom: editingCell.effectiveFrom,
    });

    if (res.success) {
      setFeedback({ type: 'success', message: `Shift schedule updated for ${editingCell.staffName}.` });
      setEditingCell(null);
      loadData();
    } else {
      setFeedback({ type: 'error', message: res.error?.message || 'Failed to update shift.' });
    }
  };

  const handleCopyLastWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await copyLastWeekRotaAction({ effectiveFrom: copyEffectiveDate });
    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Successfully rolled over schedule (${res.data?.copiedCount ?? 0} shifts) effective from ${copyEffectiveDate}.`,
      });
      setShowCopyModal(false);
      loadData();
    } else {
      setFeedback({ type: 'error', message: res.error?.message || 'Failed to copy last week rota.' });
    }
  };

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

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Weekly Rota</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage scheduled shifts across all salon roles. Drives expected staffing counts and lateness rules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HrExportMenu title="Weekly rota" filename="rota" rows={rotas} filters="Current weekly rota" columns={[{ label: 'Staff', value: (r) => r.staff_name }, { label: 'Role', value: (r) => r.role }, { label: 'Effective from', value: (r) => r.effective_from }, ...['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day, index) => ({ label: day, value: (r: HrWeeklyRota) => { const d = r.days[[1,2,3,4,5,6,0][index]]; return d?.is_off ? 'Off' : d ? `${d.start_time}-${d.end_time}` : '—'; } }))]} />
          <Button
            variant="outline"
            onClick={() => setShowCopyModal(true)}
            className="flex items-center gap-2 border-border/80 shadow-sm"
          >
            <Copy className="w-4 h-4" />
            Copy Last Week
          </Button>
        </div>
      </div>

      {/* Rota Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 rounded-xl border border-border/60 shadow-sm bg-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Expected Staff Today</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">{expectedToday} People</p>
          </div>
        </Card>

        <Card className="p-4 rounded-xl border border-border/60 shadow-sm bg-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Active Roster Size</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">{rotas.length} Personnel</p>
          </div>
        </Card>

        <Card className="p-4 rounded-xl border border-border/60 shadow-sm bg-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Standard Salon Hours</p>
            <p className="text-sm font-semibold tracking-tight text-foreground">08:00 — 18:00 (Mon–Sat)</p>
          </div>
        </Card>
      </div>

      {/* Weekly Grid */}
      <Card className="rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-muted/40 text-muted-foreground font-medium border-b border-border/40">
              <tr>
                <th className="py-3 px-4 w-48 min-w-[12rem] sticky left-0 bg-muted/90 backdrop-blur-sm z-10">
                  Staff Member & Role
                </th>
                {WEEKDAYS.map((w) => (
                  <th key={w.index} className="py-3 px-3 text-center min-w-[8.5rem]">
                    {w.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    Loading weekly rota matrix...
                  </td>
                </tr>
              ) : rotas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    No active staff found in roster.
                  </td>
                </tr>
              ) : (
                rotas.map((r) => (
                  <tr key={r.staff_user_id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 sticky left-0 bg-background/95 backdrop-blur-sm border-r border-border/30 z-10">
                      <p className="font-medium text-foreground">{r.staff_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{r.role}</p>
                    </td>
                    {WEEKDAYS.map((w) => {
                      const cell = r.days[w.index];
                      const isOff = !cell || cell.is_off;

                      return (
                        <td key={w.index} className="p-2 text-center">
                          <button
                            onClick={() =>
                              setEditingCell({
                                staffUserId: r.staff_user_id,
                                staffName: r.staff_name,
                                weekday: w.index,
                                weekdayName: w.name,
                                isOff: isOff,
                                startTime: cell?.start_time || '08:00',
                                endTime: cell?.end_time || '18:00',
                                effectiveFrom: r.effective_from,
                              })
                            }
                            className={`w-full py-2.5 px-2 rounded-lg text-xs font-medium border transition-all text-center flex flex-col items-center justify-center gap-0.5 group ${
                              isOff
                                ? 'bg-muted/30 border-dashed border-border/70 text-muted-foreground hover:bg-muted/60'
                                : 'bg-primary/5 border-primary/20 text-foreground hover:bg-primary/10 hover:border-primary/40'
                            }`}
                          >
                            {isOff ? (
                              <span className="text-[11px] font-semibold text-muted-foreground  tracking-normal">
                                Off Duty
                              </span>
                            ) : (
                              <>
                                <span className="font-semibold text-primary">
                                  {cell.start_time} - {cell.end_time}
                                </span>
                                <span className="text-[10px] text-muted-foreground opacity-75 group-hover:opacity-100">
                                  Click to edit
                                </span>
                              </>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Edit Shift */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Edit Shift: {editingCell.weekdayName}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{editingCell.staffName}</p>
              </div>
              <button
                onClick={() => setEditingCell(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCell} className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                <input
                  type="checkbox"
                  id="isOffCheck"
                  checked={editingCell.isOff}
                  onChange={(e) => setEditingCell({ ...editingCell, isOff: e.target.checked })}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                />
                <label htmlFor="isOffCheck" className="text-sm font-medium text-foreground cursor-pointer">
                  Mark as Scheduled Day Off (Off Duty)
                </label>
              </div>

              {!editingCell.isOff && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1.5">Start Time</label>
                    <input
                      type="time"
                      value={editingCell.startTime}
                      onChange={(e) => setEditingCell({ ...editingCell, startTime: e.target.value })}
                      className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1.5">End Time</label>
                    <input
                      type="time"
                      value={editingCell.endTime}
                      onChange={(e) => setEditingCell({ ...editingCell, endTime: e.target.value })}
                      className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">Effective From Date</label>
                <input
                  type="date"
                  value={editingCell.effectiveFrom}
                  onChange={(e) => setEditingCell({ ...editingCell, effectiveFrom: e.target.value })}
                  className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  required
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Changes will be tracked in the people audit trail.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button type="button" variant="outline" onClick={() => setEditingCell(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Save Shift
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Copy Last Week */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Copy Last Week's Rota</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Roll over all currently assigned shift patterns to a new working week.
                </p>
              </div>
              <button
                onClick={() => setShowCopyModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCopyLastWeek} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Effective From Week Date
                </label>
                <input
                  type="date"
                  value={copyEffectiveDate}
                  onChange={(e) => setCopyEffectiveDate(e.target.value)}
                  className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button type="button" variant="outline" onClick={() => setShowCopyModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Confirm Rollover
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
