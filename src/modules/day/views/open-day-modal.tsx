'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { openDayAction } from '../controllers/day.actions';
import { Calendar, Banknote, Clock, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { getKampalaDateString } from '@/shared/lib/format-duration';

interface OpenDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  role: 'manager' | 'receptionist';
  locationId?: string;
}

export function OpenDayModal({
  isOpen,
  onClose,
  onSuccess,
  role,
  locationId = 'b0000000-0000-0000-0000-000000000001',
}: OpenDayModalProps) {
  const [cashFloat, setCashFloat] = useState<number>(50000);
  const [showBackdate, setShowBackdate] = useState(false);
  const [backdateHour, setBackdateHour] = useState('08:00');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const todayStr = getKampalaDateString();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (cashFloat < 0) {
      setErrorMsg('Cash float cannot be negative.');
      return;
    }

    let backdateTimeStr: string | undefined = undefined;
    if (showBackdate) {
      if (!reason.trim()) {
        setErrorMsg('Please specify a reason when opening earlier than now.');
        return;
      }
      // Combine today's date with selected time in Africa/Kampala (UTC+3)
      backdateTimeStr = `${todayStr}T${backdateHour}:00+03:00`;
    }

    setSubmitting(true);
    try {
      const res = await openDayAction(locationId, cashFloat, backdateTimeStr, reason.trim() || undefined);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.error?.message || 'Failed to open the business day.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-600 rounded-lg text-white">
                <Calendar className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-base">Open Business Day</h3>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Opening register and queue for {todayStr} (Africa/Kampala)
            </p>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
            {role === 'manager' ? 'Manager Action' : 'Receptionist Action'}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2.5 text-rose-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Opening blocked: </span>
                {errorMsg}
              </div>
            </div>
          )}

          {/* Business Date info */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">Business Date</span>
              <div className="text-sm font-bold text-slate-900 tabular-nums">{todayStr}</div>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-500">Operating Hours</span>
              <div className="text-sm font-medium text-slate-700">08:00 – 20:00 EAT</div>
            </div>
          </div>

          {/* Cash float */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Cash Float in Drawer (UGX)</span>
              <span className="text-muted-foreground font-normal">Default: 50,000</span>
            </label>
            <div className="relative">
              <Banknote className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="number"
                min={0}
                step={5000}
                value={cashFloat}
                onChange={(e) => setCashFloat(Number(e.target.value))}
                required
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 tabular-nums focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Physical cash counted in the reception register drawer this morning.
            </p>
          </div>

          {/* Backdate section */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowBackdate(!showBackdate)}
              className="w-full px-4 py-2.5 bg-slate-50 text-left text-xs font-bold text-slate-700 flex items-center justify-between hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Opened earlier than now? (Late system entry)</span>
              </div>
              {showBackdate ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showBackdate && (
              <div className="p-4 bg-white space-y-3 border-t border-slate-200 animate-in fade-in duration-100">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Actual Salon Open Time</label>
                  <input
                    type="time"
                    value={backdateHour}
                    onChange={(e) => setBackdateHour(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-900"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Record the exact time physical doors were unlocked if system was offline.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Reason for Backdating <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Morning power outage, network delay, internet restored"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-900"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Opening Day...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm & Open Day
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
