'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  getStaffQueueAction,
  startStaffLineAction,
  finishStaffLineAction,
  undoStaffLineAction,
  type StaffPortalState,
  type StaffQueueItem,
} from '../controllers/staff.actions';
import { setMyAttendanceAction } from '@/modules/day';
import { subscribeToStaffSkillChanges } from '@/modules/staff-skills';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  WifiOff,
  Sparkles,
} from 'lucide-react';

interface StaffPortalViewProps {
  initialDisplayName?: string;
}

export function StaffPortalView({ initialDisplayName }: StaffPortalViewProps) {
  const [data, setData] = useState<StaffPortalState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Undo window state (10s)
  const [undoState, setUndoState] = useState<{
    lineId: string;
    actionType: 'start' | 'done';
    ticketCode: string;
    expiresAt: number;
  } | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState<number>(0);

  // Done button confirmation state (2-tap safeguard)
  const [confirmDoneLineId, setConfirmDoneLineId] = useState<string | null>(null);

  // Connectivity detection
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Refresh immediately on skill changes; all other data changes arrive through the salon invalidation channel.
  useEffect(() => {
    loadQueue();
    const unsubscribe = subscribeToStaffSkillChanges(loadQueue);
    return () => { unsubscribe(); };
  }, []);

  // Undo timer countdown
  useEffect(() => {
    if (!undoState) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((undoState.expiresAt - Date.now()) / 1000));
      setUndoSecondsLeft(remaining);
      if (remaining <= 0) {
        setUndoState(null);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [undoState]);

  async function loadQueue() {
    try {
      const res = await getStaffQueueAction();
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch {
      // In case of network drop
    } finally {
      setLoading(false);
    }
  }
  useSalonLiveRefresh(() => { void loadQueue(); }, true, ['app_user', 'attendance', 'business_day', 'visit_service', 'app_setting', 'staff_skill', 'service_variant', 'service', 'visit', 'customer', 'appointment']);


  // Handle Start Line Action
  async function handleStartLine(lineId: string, ticketCode: string) {
    if (actionLoading) return;
    setActionLoading(true);
    setErrorMessage(null);

    const res = await startStaffLineAction(lineId);
    if (!res.success) {
      if (res.error?.code === 'FORBIDDEN') {
        setErrorMessage("You're clocked out. Tap I'm in to start work.");
      } else {
        setErrorMessage(res.error?.message || 'Could not start service');
      }
      setActionLoading(false);
      return;
    }

    setUndoState({
      lineId,
      actionType: 'start',
      ticketCode,
      expiresAt: Date.now() + 10000,
    });
    setToastMessage(`Started service for ${ticketCode}`);
    await loadQueue();
    setActionLoading(false);
  }

  // Handle Done Line Action (2-tap safeguard)
  async function handleDoneLine(lineId: string, ticketCode: string) {
    if (actionLoading) return;

    if (confirmDoneLineId !== lineId) {
      setConfirmDoneLineId(lineId);
      setTimeout(() => {
        setConfirmDoneLineId((curr) => (curr === lineId ? null : curr));
      }, 4000);
      return;
    }

    setConfirmDoneLineId(null);
    setActionLoading(true);
    setErrorMessage(null);

    const res = await finishStaffLineAction(lineId);
    if (!res.success) {
      setErrorMessage(res.error?.message || 'Could not finish service');
      setActionLoading(false);
      return;
    }

    setUndoState({
      lineId,
      actionType: 'done',
      ticketCode,
      expiresAt: Date.now() + 10000,
    });
    setToastMessage(`Finished ${ticketCode}. Great work!`);
    await loadQueue();
    setActionLoading(false);
  }

  // Handle Undo Action
  async function handleUndo() {
    if (!undoState || actionLoading) return;
    setActionLoading(true);
    const { lineId, actionType, ticketCode } = undoState;

    const res = await undoStaffLineAction(lineId);
    if (!res.success) {
      setErrorMessage(res.error?.message || 'Could not undo action');
      setActionLoading(false);
      return;
    }

    setUndoState(null);
    setToastMessage(`Reverted ${actionType === 'start' ? 'Start' : 'Done'} for ${ticketCode}`);
    await loadQueue();
    setActionLoading(false);
  }

  // Quick clock in helper
  async function handleQuickClockIn() {
    setActionLoading(true);
    const res = await setMyAttendanceAction('in');
    if (res.success) {
      setErrorMessage(null);
      setToastMessage("You are now clocked in. Tap Start to begin.");
      await loadQueue();
    } else {
      setErrorMessage(res.error || 'Failed to clock in');
    }
    setActionLoading(false);
  }

  const nowTask = data?.now;
  const nextTasks = data?.next || [];
  const comingUpTasks = data?.comingUp || [];

  // Check forgotten Done reminder (>90 min in progress)
  const isForgottenDone = (() => {
    if (!nowTask || !nowTask.startedAt) return false;
    const minutesElapsed = (Date.now() - new Date(nowTask.startedAt).getTime()) / 60000;
    return minutesElapsed >= 90;
  })();

  const isQueueCompletelyEmpty = !nowTask && nextTasks.length === 0 && comingUpTasks.length === 0;

  return (
    <div className="max-w-md mx-auto p-4 pb-24 md:pb-6 space-y-4 font-sans">
      {/* 1. Offline / Disconnected Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 p-3.5 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-xs">
          <WifiOff className="w-5 h-5 shrink-0" />
          <span>No connection. Tell the receptionist your Start and Done times.</span>
        </div>
      )}

      {/* 2. Undo Floating Notification (10-second window) */}
      {undoState && (
        <div className="bg-[#1F2328] text-white p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {undoState.actionType === 'start' ? 'Started' : 'Finished'} {undoState.ticketCode} ({undoSecondsLeft}s)
            </span>
          </div>
          <button
            onClick={handleUndo}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold active:scale-95 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
        </div>
      )}

      {/* 3. Toast / Feedback Notification */}
      {toastMessage && !undoState && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
      )}

      {/* 4. Action Error Banner with one-tap clock in if applicable */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3.5 rounded-2xl text-xs font-semibold space-y-2 shadow-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="flex-1">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-700">
              ✕
            </button>
          </div>
          {errorMessage.toLowerCase().includes("tap i'm in") && (
            <Button
              size="sm"
              onClick={handleQuickClockIn}
              disabled={actionLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9"
            >
              I'm in
            </Button>
          )}
        </div>
      )}

      {/* 5. Forgotten Done Gentle In-App Reminder (>90 min) */}
      {isForgottenDone && nowTask && (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-xs">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Still working on {nowTask.ticketCode}? Tap Done when you finish.</span>
        </div>
      )}

      {/* ================= SECTION 1: NOW (IN PROGRESS) ================= */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold  tracking-normal text-slate-500 px-1">
          Now <span className="font-normal text-slate-400">(In progress)</span>
        </h2>

        {nowTask ? (
          <Card className="border-2 border-[#1F4FD8] bg-white rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400  tracking-wide">Ticket</span>
                  <div className="text-4xl font-black text-[#1F2328] tabular-nums tracking-tight leading-none mt-1">
                    {nowTask.ticketCode}
                  </div>
                  <div className="text-sm font-semibold text-slate-800 mt-2">
                    {nowTask.customerFirstName}
                  </div>
                </div>
                <div className="text-right max-w-[55%]">
                  <span className="text-[11px] font-semibold text-slate-400  tracking-wide">Service</span>
                  <div className="text-base font-bold text-[#1F2328] leading-snug mt-1 truncate">
                    {nowTask.variantName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{nowTask.serviceName}</div>
                </div>
              </div>

              {/* Large Bronze Done Button */}
              <Button
                size="lg"
                onClick={() => handleDoneLine(nowTask.lineId, nowTask.ticketCode)}
                disabled={actionLoading}
                className={`w-full h-14 text-base font-bold rounded-xl shadow-md transition-all ${
                  confirmDoneLineId === nowTask.lineId
                    ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                    : 'bg-[#1F4FD8] hover:bg-[#85683F] text-white'
                }`}
              >
                {actionLoading
                  ? 'Releasing...'
                  : confirmDoneLineId === nowTask.lineId
                  ? 'Tap again to confirm Done'
                  : 'Done'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="p-4 rounded-2xl bg-white border border-[#CBD5E1] text-center text-xs text-slate-500 font-medium">
            No service currently in progress
          </div>
        )}
      </section>

      {/* ================= SECTION 2: NEXT (READY FOR YOU & POOL) ================= */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold  tracking-normal text-slate-500 px-1">
          Next <span className="font-normal text-slate-400">(Ready)</span>
        </h2>

        {nextTasks.length > 0 ? (
          <div className="space-y-2.5">
            {nextTasks.map((task) => (
              <Card
                key={task.lineId}
                className="border border-[#CBD5E1] bg-white rounded-2xl shadow-xs overflow-hidden"
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="truncate flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold tabular-nums text-[#1F2328]">
                        {task.ticketCode}
                      </span>
                      {task.source === 'pool' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold ">
                          Pool
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-800 truncate mt-0.5">
                      {task.customerFirstName} • <span className="font-medium text-slate-600">{task.variantName}</span>
                    </div>
                  </div>

                  {/* Start Button */}
                  <Button
                    size="lg"
                    onClick={() => handleStartLine(task.lineId, task.ticketCode)}
                    disabled={actionLoading || Boolean(nowTask)}
                    className="h-11 px-5 rounded-xl bg-[#1F4FD8] hover:bg-[#85683F] text-white text-xs font-bold shadow-xs shrink-0 disabled:opacity-50"
                  >
                    Start
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-white border border-[#CBD5E1] text-center text-xs text-slate-500 font-medium">
            No ready tickets waiting for you
          </div>
        )}
      </section>

      {/* ================= SECTION 3: COMING UP (BLOCKED / PREVIOUS STEP RUNNING) ================= */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold  tracking-normal text-slate-500 px-1">
          Coming up <span className="font-normal text-slate-400">(Waiting on prior step)</span>
        </h2>

        {comingUpTasks.length > 0 ? (
          <div className="space-y-2">
            {comingUpTasks.map((task) => (
              <div
                key={task.lineId}
                className="p-3.5 rounded-2xl bg-slate-50 border border-[#CBD5E1] flex items-center justify-between text-xs"
              >
                <div className="truncate pr-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#1F2328]">
                    <span className="tabular-nums text-sm">{task.ticketCode}</span>
                    <span className="text-slate-400">•</span>
                    <span>{task.customerFirstName}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {task.variantName}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] font-semibold text-slate-600 block">
                    Ready in ~10–15 min
                  </span>
                  <span className="text-[10px] text-slate-400">Step {task.sequenceNo}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-white border border-[#CBD5E1] text-center text-xs text-slate-500 font-medium">
            No upcoming multi-step services
          </div>
        )}
      </section>

      {/* Pure Empty State */}
      {isQueueCompletelyEmpty && !loading && (
        <div className="py-12 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-[#1F4FD8]/10 text-[#1F4FD8] flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <p className="text-base font-bold text-[#1F2328]">Nothing waiting.</p>
          <p className="text-xs text-muted-foreground">Enjoy the break.</p>
        </div>
      )}
    </div>
  );
}
