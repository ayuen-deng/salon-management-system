'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { fetchOwnerWaitsAction, OwnerWaitMetric } from '@/modules/dashboard-owner';
import { Clock, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export function OwnerWaitsView() {
  const [metrics, setMetrics] = useState<OwnerWaitMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWaits();
  }, []);

  async function loadWaits() {
    setLoading(true);
    const res = await fetchOwnerWaitsAction();
    if (res.success) {
      setMetrics(res.data);
    }
    setLoading(false);
  }
  useSalonLiveRefresh(() => { void loadWaits(); });


  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="border-b border-[#EDEFF3] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Between-Services Wait & Bottle-neck Tracking</h2>
          <p className="text-xs text-slate-500">
            Measured lines only. Paper-entered and manual time overrides are automatically excluded.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
          <Info className="w-3.5 h-3.5" />
          <span>Warn limit: 10 mins • Escalate: 25 mins</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.map((m, idx) => (
          <Card key={idx} className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-slate-900">{m.stage}</span>
              <span className="text-[10px] text-slate-400 tabular-nums">{m.measured_count} observations</span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-500 text-[11px] block">Average Wait</span>
                <span className="text-xl font-bold tabular-nums text-slate-900">{m.average_wait_minutes} mins</span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Worst Case Wait</span>
                <span className={`text-xl font-bold tabular-nums ${m.worst_wait_minutes >= 25 ? 'text-rose-600' : 'text-amber-700'}`}>
                  {m.worst_wait_minutes} mins
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  m.average_wait_minutes >= 20 ? 'bg-rose-500' : m.average_wait_minutes >= 10 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (m.average_wait_minutes / 30) * 100)}%` }}
              ></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
