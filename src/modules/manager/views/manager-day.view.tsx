'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  closeBusinessDayAction,
  beginCloseDayAction,
  cancelClosingAction,
  undoCloseAction,
  reopenBusinessDayAction,
  getReconciliationDataAction,
  type ManagerReconciliationData,
} from '../controllers/manager-nav.actions';
import {
  getTodayDayAction,
  getOlderOpenDayAction,
  getDayHistoryAction,
  BusinessDayState,
  DayHistoryRecord,
  OpenDayModal,
} from '@/modules/day';
import { formatUgx } from '@/shared/models/money';
import { formatDuration, getKampalaDateString } from '@/shared/lib/format-duration';
import {
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Calendar,
  Clock,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

export function ManagerDayView() {
  const [todayState, setTodayState] = useState<BusinessDayState | null>(null);
  const [olderOpenDay, setOlderOpenDay] = useState<BusinessDayState | null>(null);
  const [reconciliation, setReconciliation] = useState<ManagerReconciliationData | null>(null);
  const [history, setHistory] = useState<DayHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & controls
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [closingModalOpen, setClosingModalOpen] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [cashCounted, setCashCounted] = useState<number>(50000);
  const [closeNotes, setCloseNotes] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Undo window countdown
  const [undoSecondsLeft, setUndoSecondsLeft] = useState<number>(0);

  const loadAll = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [todayRes, olderRes, reconRes, histRes] = await Promise.all([
        getTodayDayAction(),
        getOlderOpenDayAction(),
        getReconciliationDataAction(),
        getDayHistoryAction(10),
      ]);

      const tDay = todayRes.success ? todayRes.data : null;
      setTodayState(tDay);
      setOlderOpenDay(olderRes.success ? olderRes.data : null);
      if (reconRes.success && reconRes.data) {
        setReconciliation(reconRes.data);
        setCashCounted(reconRes.data.recorded_cash_ugx + (tDay?.cash_float || 50000));
      } else {
        setReconciliation(null);
      }
      if (histRes.success) {
        setHistory(histRes.data);
      }

      // Check undo countdown if today was just closed
      if (tDay && tDay.status === 'closed' && tDay.closed_at) {
        const closedAtMs = new Date(tDay.closed_at).getTime();
        const diffSec = Math.floor((Date.now() - closedAtMs) / 1000);
        const remaining = 15 * 60 - diffSec;
        setUndoSecondsLeft(remaining > 0 ? remaining : 0);
      } else {
        setUndoSecondsLeft(0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load day operations';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };
  useSalonLiveRefresh(() => { void loadAll(); }, true, ['business_day', 'payment', 'statement_import', 'reconciliation_entry', 'visit', 'audit_log']);


  useEffect(() => {
    loadAll();
  }, []);

  // Timer for undo countdown
  useEffect(() => {
    if (undoSecondsLeft <= 0) return;
    const interval = setInterval(() => {
      setUndoSecondsLeft((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [undoSecondsLeft]);

  // Two-step closing actions
  const handleBeginClose = async () => {
    if (!todayState) return;
    setProcessing(true);
    setErrorMsg(null);
    const res = await beginCloseDayAction(todayState.id);
    if (res.success) {
      setClosingModalOpen(true);
      await loadAll();
    } else {
      setErrorMsg(res.error || 'Failed to initiate day closing.');
    }
    setProcessing(false);
  };

  const handleCancelClosing = async () => {
    if (!todayState) return;
    setProcessing(true);
    setErrorMsg(null);
    const res = await cancelClosingAction(todayState.id);
    if (res.success) {
      setClosingModalOpen(false);
      setFeedback('Closing cancelled. Salon operations resumed.');
      await loadAll();
    } else {
      setErrorMsg(res.error || 'Failed to cancel closing.');
    }
    setProcessing(false);
  };

  const handleConfirmClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!todayState) return;
    setProcessing(true);
    setErrorMsg(null);
    const res = await closeBusinessDayAction(todayState.id, cashCounted, closeNotes);
    if (res.success) {
      setFeedback('Business day successfully closed! Register totals and drawer count verified.');
      setClosingModalOpen(false);
      await loadAll();
    } else {
      setErrorMsg(res.error || 'Failed to finalize day closing.');
    }
    setProcessing(false);
  };

  const handleUndoClose = async () => {
    if (!todayState) return;
    setProcessing(true);
    setErrorMsg(null);
    const res = await undoCloseAction(todayState.id);
    if (res.success) {
      setFeedback('Day close reverted. Operations are open again.');
      await loadAll();
    } else {
      setErrorMsg(res.error || 'Undo window has expired or close could not be reverted.');
    }
    setProcessing(false);
  };

  const handleEmergencyReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!todayState || !reopenReason.trim()) {
      setErrorMsg('A valid reason is required to emergency reopen the day.');
      return;
    }
    setProcessing(true);
    setErrorMsg(null);
    const res = await reopenBusinessDayAction(todayState.id, reopenReason);
    if (res.success) {
      setFeedback('Business day successfully reopened! Incident logged in audit.');
      setReopenModalOpen(false);
      setReopenReason('');
      await loadAll();
    } else {
      setErrorMsg(res.error || 'Failed to emergency reopen the day.');
    }
    setProcessing(false);
  };

  const handleCloseOlderDay = async (olderDayId: string) => {
    setProcessing(true);
    setErrorMsg(null);
    const res = await closeBusinessDayAction(olderDayId, 50000, 'Auto-closed unclosed older day');
    if (res.success) {
      setFeedback('Stale business day closed. You may now open today.');
      await loadAll();
    } else {
      setErrorMsg(res.error || 'Failed to close stale business day.');
    }
    setProcessing(false);
  };

  const todayDateStr = getKampalaDateString();

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Page Header (No duplicate Title) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Operations & Closeout</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Morning float verification, active day management, drawer reconciliation, and end-of-day lock
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Africa/Kampala •</span>
          <span className="text-xs font-bold text-slate-900 tabular-nums">{todayDateStr}</span>
        </div>
      </div>

      {/* FEEDBACK & ERROR ALERTS */}
      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-700 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-700 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* STALE OLDER DAY WARNING BANNER */}
      {olderOpenDay && (
        <div className="bg-amber-50 border-2 border-amber-400 text-amber-900 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">
                Unclosed Stale Business Day: {olderOpenDay.business_date}
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                A business day from {olderOpenDay.business_date} was left open overnight. Supabase rules require previous days to be closed before opening today.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => handleCloseOlderDay(olderOpenDay.id)}
            disabled={processing}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shrink-0"
          >
            Close {olderOpenDay.business_date} Day Now
          </Button>
        </div>
      )}

      {/* MAIN LIFECYCLE CARD */}
      {loading ? (
        <Card className="border border-slate-200">
          <CardContent className="p-12 text-center text-xs text-muted-foreground">
            <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <div>Loading business day status...</div>
          </CardContent>
        </Card>
      ) : !todayState ? (
        /* STATE 1: NO DAY OPEN FOR TODAY */
        <Card className="border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="bg-slate-900 text-white p-6">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
              <Calendar className="w-4 h-4" />
              <span>TODAY IS NOT OPEN YET</span>
            </div>
            <h3 className="text-xl font-bold mt-1">Open Salon Business Day</h3>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Physical cash float must be counted and confirmed before tickets can be issued. Both the Manager and Receptionist have permission to open the day.
            </p>
          </div>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs text-slate-500 font-semibold">Calendar Date</span>
                <div className="text-lg font-bold text-slate-900 tabular-nums">{todayDateStr}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Africa/Kampala standard timezone</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs text-slate-500 font-semibold">Standard Cash Float</span>
                <div className="text-lg font-bold text-slate-900 tabular-nums">UGX 50,000</div>
                <div className="text-xs text-muted-foreground mt-0.5">Change in reception register</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs text-slate-500 font-semibold">Standard Hours</span>
                <div className="text-lg font-bold text-slate-900">08:00 – 20:00</div>
                <div className="text-xs text-muted-foreground mt-0.5">Auto-close reminder at 23:00</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                Ready to open doors? Click the button to set cash float and begin receiving guests.
              </div>
              <Button
                onClick={() => setOpenModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Open the Day
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : todayState.status === 'open' ? (
        /* STATE 2: DAY IS OPEN */
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold text-muted-foreground">Active Business Date</span>
                <span className="tabular-nums text-sm font-bold text-slate-900">{todayState.business_date}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  OPEN & ACTIVE
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Salon Operations in Progress</h3>
              <p className="text-xs text-muted-foreground">
                Opened at {new Date(todayState.opened_at).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' })} • Cash float: UGX {todayState.cash_float.toLocaleString()}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleBeginClose}
                disabled={processing}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                <Lock className="w-3.5 h-3.5 mr-1.5" />
                Begin Day Close
              </Button>
            </div>
          </div>

          {/* Reconciliation Financial Snapshot */}
          {reconciliation && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border rounded-2xl p-5 space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Morning Float</span>
                <div className="text-xl font-bold text-slate-900 tabular-nums">
                  UGX {todayState.cash_float.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Drawer starting cash</div>
              </div>

              <div className="bg-white border rounded-2xl p-5 space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Cash Receipts</span>
                <div className="text-xl font-bold text-emerald-600 tabular-nums">
                  {formatUgx(reconciliation.recorded_cash_ugx)}
                </div>
                <div className="text-xs text-muted-foreground">Live cash taken today</div>
              </div>

              <div className="bg-white border rounded-2xl p-5 space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Mobile Money Receipts</span>
                <div className="text-xl font-bold text-blue-600 tabular-nums">
                  {formatUgx(reconciliation.recorded_momo_ugx)}
                </div>
                <div className="text-xs text-muted-foreground">MTN & Airtel MoMo</div>
              </div>

              <div className="bg-white border rounded-2xl p-5 space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Total Revenue</span>
                <div className="text-xl font-bold text-slate-900 tabular-nums">
                  {formatUgx(reconciliation.recorded_total_ugx)}
                </div>
                <div className="text-xs text-muted-foreground">Combined collections</div>
              </div>
            </div>
          )}
        </div>
      ) : todayState.status === 'closing' ? (
        /* STATE 3: DAY IN CLOSING REVIEW */
        <Card className="border-2 border-amber-400 bg-amber-50/20 shadow-xs">
          <CardHeader className="bg-amber-100/60 border-b border-amber-200 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-amber-700" />
                <div>
                  <CardTitle className="text-base font-bold text-amber-950">Day Close in Progress</CardTitle>
                  <p className="text-xs text-amber-800">Review closing checklist and confirm register counts</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelClosing}
                disabled={processing}
                className="text-xs border-amber-300 bg-white hover:bg-amber-50 text-amber-900"
              >
                Cancel Closing & Resume Operations
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-2">Drawer Cash Count Verification</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-500">System Expected Cash in Drawer</span>
                  <div className="text-lg font-bold text-slate-900 tabular-nums">
                    UGX {((reconciliation?.recorded_cash_ugx || 0) + (todayState.cash_float || 50000)).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Float + Cash Collections</div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Physical Cash Counted (UGX)</label>
                  <input
                    type="number"
                    value={cashCounted}
                    onChange={(e) => setCashCounted(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Closing Notes / Discrepancy Reason</label>
              <textarea
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes for daily closeout audit log..."
                className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                onClick={handleConfirmClose}
                disabled={processing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm Drawer & Close Day
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* STATE 4: DAY IS CLOSED */
        <div className="space-y-6">
          <Card className="border border-slate-200 shadow-xs bg-white">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-slate-200 text-slate-700 rounded-xl">
                  <Lock className="w-5 h-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-slate-900">Business Day Closed</CardTitle>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {todayState.business_date}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Closed at {todayState.closed_at ? new Date(todayState.closed_at).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' }) : 'Evening'} • Cash counted: UGX {(todayState.cash_counted || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Undo Close window or Emergency Reopen */}
              <div className="flex items-center gap-2">
                {undoSecondsLeft > 0 ? (
                  <Button
                    onClick={handleUndoClose}
                    disabled={processing}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs gap-2 shadow-xs"
                    size="sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Undo Close ({Math.floor(undoSecondsLeft / 60)}:{(undoSecondsLeft % 60).toString().padStart(2, '0')})
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setReopenModalOpen(true)}
                    className="border-amber-300 text-amber-800 hover:bg-amber-50 text-xs gap-2"
                    size="sm"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    Emergency Reopen
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 border rounded-xl p-4">
                  <span className="text-xs text-slate-500 font-semibold">Morning Float</span>
                  <div className="text-base font-bold text-slate-900 tabular-nums">
                    UGX {todayState.cash_float.toLocaleString()}
                  </div>
                </div>
                <div className="bg-slate-50 border rounded-xl p-4">
                  <span className="text-xs text-slate-500 font-semibold">Final Cash Counted</span>
                  <div className="text-base font-bold text-slate-900 tabular-nums">
                    UGX {(todayState.cash_counted || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-slate-50 border rounded-xl p-4">
                  <span className="text-xs text-slate-500 font-semibold">Status</span>
                  <div className="text-base font-bold text-slate-700">
                    {todayState.auto_closed ? 'Auto-closed overnight' : 'Manually closed'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* HISTORICAL DAYS TABLE */}
      <Card className="border border-slate-200 shadow-xs">
        <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">Recent Business Days History</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Audit log of opening floats, closures, and cash counts</p>
          </div>
          <Button variant="ghost" size="sm" onClick={loadAll} className="text-xs text-slate-600">
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Opened At</th>
                  <th className="px-6 py-3">Closed At</th>
                  <th className="px-6 py-3 text-right">Float (UGX)</th>
                  <th className="px-6 py-3 text-right">Counted (UGX)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      No business day records found.
                    </td>
                  </tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3.5 font-bold text-slate-900 tabular-nums">{h.business_date}</td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            h.status === 'open'
                              ? 'bg-emerald-100 text-emerald-800'
                              : h.status === 'closing'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {h.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 tabular-nums">
                        {new Date(h.opened_at).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' })}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 tabular-nums">
                        {h.closed_at
                          ? new Date(h.closed_at).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' })
                          : '—'}
                      </td>
                      <td className="px-6 py-3.5 text-right font-medium text-slate-900 tabular-nums">
                        {h.cash_float.toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5 text-right font-medium text-slate-900 tabular-nums">
                        {h.cash_counted != null ? h.cash_counted.toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* OPEN DAY MODAL */}
      <OpenDayModal
        isOpen={openModalOpen}
        onClose={() => setOpenModalOpen(false)}
        onSuccess={loadAll}
        role="manager"
      />

      {/* EMERGENCY REOPEN MODAL */}
      {reopenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-amber-600 text-white px-6 py-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Unlock className="w-4 h-4" />
                Emergency Day Reopen
              </h3>
              <p className="text-xs text-amber-100 mt-0.5">
                Reopening a closed day must be justified for financial audit trail.
              </p>
            </div>
            <form onSubmit={handleEmergencyReopen} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  Reason for Reopening <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="e.g. Late customer checkout, erroneous early close by shift manager"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReopenModalOpen(false)}
                  disabled={processing}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={processing || !reopenReason.trim()}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs"
                >
                  {processing ? 'Reopening...' : 'Confirm Reopen'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
