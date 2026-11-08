'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { formatUGX } from '@/shared/models/money';
import { fetchOwnerSummariesAction, OwnerDailySummaryItem } from '@/modules/dashboard-owner';
import { FileText, Calendar, ChevronRight, CheckCircle2 } from 'lucide-react';

export function OwnerSummariesView() {
  const [summaries, setSummaries] = useState<OwnerDailySummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<OwnerDailySummaryItem | null>(null);

  useEffect(() => {
    loadSummaries();
  }, []);

  async function loadSummaries() {
    setLoading(true);
    const res = await fetchOwnerSummariesAction();
    if (res.success) {
      setSummaries(res.data);
      if (res.data.length > 0) setSelectedDay(res.data[0]);
    }
    setLoading(false);
  }
  useSalonLiveRefresh(() => { void loadSummaries(); });


  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="border-b border-[#EDEFF3] pb-3">
        <h2 className="text-base font-semibold text-slate-900">End-of-Day Business Summaries</h2>
        <p className="text-xs text-slate-500">
          Permanent snapshot archives from closed business days across the last 5 weeks.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Days List */}
        <div className="lg:col-span-5 space-y-2 max-h-[700px] overflow-y-auto pr-1">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading daily summaries...</div>
          ) : (
            summaries.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedDay(s)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  selectedDay?.id === s.id
                    ? 'bg-[#1F4FD8]/5 border-[#1F4FD8] shadow-xs'
                    : 'bg-white border-[#EDEFF3] hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">{s.business_date}</span>
                  <span className="text-[10px]  font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {s.status}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-slate-500">{s.customers_served} served</span>
                  <span className="tabular-nums font-bold text-slate-900">{formatUGX(s.revenue_total_ugx)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Day Full Summary Detail */}
        <div className="lg:col-span-7">
          {selectedDay ? (
            <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Summary for {selectedDay.business_date}</h3>
                  <p className="text-xs text-slate-500">
                    Operating hours: {selectedDay.opened_at_str} - {selectedDay.closed_at_str}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <span className="text-slate-400 block">Delivery status</span>
                  <span className="font-medium text-slate-700">Dashboard archive • Email logged</span>
                </div>
              </div>

              {/* Revenue Splits */}
              <div>
                <h4 className="text-xs font-semibold  tracking-normal text-slate-400 mb-2">Revenue & Verification</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50">
                    <span className="text-slate-400 block">Mobile Money</span>
                    <span className="tabular-nums font-bold text-base text-slate-900">{formatUGX(selectedDay.revenue_momo_ugx)}</span>
                    <span className="text-[10px] text-emerald-700 block mt-0.5">{selectedDay.momo_verified_pct}% verified</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50">
                    <span className="text-slate-400 block">Cash Counted</span>
                    <span className="tabular-nums font-bold text-base text-slate-900">
                      {selectedDay.cash_counted ? formatUGX(selectedDay.cash_counted) : formatUGX(selectedDay.revenue_cash_ugx)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Float: {formatUGX(selectedDay.cash_float)}</span>
                  </div>
                </div>
              </div>

              {/* Traffic Counts */}
              <div>
                <h4 className="text-xs font-semibold  tracking-normal text-slate-400 mb-2">Client Traffic</h4>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50">
                    <span className="text-slate-400 block">Clients Served</span>
                    <span className="tabular-nums font-bold text-lg text-slate-900">{selectedDay.customers_served}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50">
                    <span className="text-slate-400 block">Left Queue</span>
                    <span className="tabular-nums font-bold text-lg text-slate-900">{selectedDay.left_queue}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50">
                    <span className="text-slate-400 block">No-Shows</span>
                    <span className="tabular-nums font-bold text-lg text-slate-900">{selectedDay.no_shows}</span>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <div className="p-12 text-center text-xs text-slate-400">Select a day from the left list.</div>
          )}
        </div>
      </div>
    </div>
  );
}
