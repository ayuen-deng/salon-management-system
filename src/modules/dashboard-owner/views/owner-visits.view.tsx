'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { formatUGX } from '@/shared/models/money';
import { fetchOwnerVisitsAction, OwnerVisitSummary } from '@/modules/dashboard-owner';
import { Scissors, Search, Clock, FileText, ChevronRight } from 'lucide-react';

export function OwnerVisitsView() {
  const [filter, setFilter] = useState<'today' | 'all' | 'left' | 'unpaid'>('today');
  const [visits, setVisits] = useState<OwnerVisitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState<OwnerVisitSummary | null>(null);

  useEffect(() => {
    loadVisits();
  }, [filter]);

  async function loadVisits() {
    setLoading(true);
    const res = await fetchOwnerVisitsAction(filter);
    if (res.success) {
      setVisits(res.data);
    }
    setLoading(false);
  }
  useSalonLiveRefresh(() => { void loadVisits(); }, true, ['visit', 'visit_service', 'payment', 'customer', 'business_day', 'service_variant', 'app_user']);


  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Filters Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EDEFF3] pb-4">
        <div className="flex items-center gap-2">
          {(['today', 'all', 'left', 'unpaid'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                filter === t
                  ? 'bg-[#1F4FD8] text-white shadow-xs'
                  : 'bg-white border border-[#EDEFF3] text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t === 'today' ? 'Today' : t === 'left' ? 'Left queue' : t === 'unpaid' ? 'Unpaid' : 'All visits'}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500 font-medium">
          {visits.length} {visits.length === 1 ? 'visit' : 'visits'} listed
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Visits Table */}
        <div className="lg:col-span-8">
          <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white overflow-hidden">
            <CardHeader className="p-4 border-b border-[#EDEFF3] bg-slate-50/50">
              <CardTitle className="text-sm font-semibold text-slate-900">Salon Visits List</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading visits...</div>
              ) : visits.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No visits matching criteria.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-[#EDEFF3]">
                    <tr>
                      <th className="py-3 px-4">Ticket</th>
                      <th className="py-3 px-4">Client</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Services</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {visits.map((v) => (
                      <tr
                        key={v.id}
                        onClick={() => setSelectedVisit(v)}
                        className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                          selectedVisit?.id === v.id ? 'bg-[#1F4FD8]/5' : ''
                        }`}
                      >
                        <td className="py-3 px-4 tabular-nums font-bold text-[#1F4FD8]">{v.ticket_code}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{v.customer_name}</div>
                          <div className="text-[10px] text-slate-400">{v.entered_via === 'paper' ? 'Paper-entered' : 'Live'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {v.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{v.services.length} lines</td>
                        <td className="py-3 px-4 text-right tabular-nums font-semibold text-slate-900">
                          {formatUGX(v.total_final_ugx)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400">
                          <ChevronRight className="w-4 h-4 ml-auto" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Visit Detail Drawer / Panel */}
        <div className="lg:col-span-4">
          {selectedVisit ? (
            <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white p-5 space-y-4">
              <div className="border-b border-[#EDEFF3] pb-3">
                <div className="flex items-center justify-between">
                  <span className="tabular-nums text-lg font-bold text-[#1F4FD8]">{selectedVisit.ticket_code}</span>
                  <span className="text-[10px]  font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                    {selectedVisit.status}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-900 mt-1">{selectedVisit.customer_name}</div>
                <div className="text-xs text-slate-500 tabular-nums">{selectedVisit.customer_phone || 'No phone'}</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700 mb-2">Service Lines</div>
                <div className="space-y-2">
                  {selectedVisit.services.map((s, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex justify-between font-medium text-slate-900">
                        <span>{s.variant_name}</span>
                        <span className="tabular-nums">{formatUGX(s.final_price_ugx)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Stylist: {s.staff_name} • Status: {s.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700 mb-2">Payment Breakdown</div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>List Total:</span>
                    <span className="tabular-nums">{formatUGX(selectedVisit.total_list_ugx)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Discount:</span>
                    <span className="tabular-nums text-emerald-700">-{formatUGX(selectedVisit.total_discount_ugx)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-100">
                    <span>Final Amount:</span>
                    <span className="tabular-nums">{formatUGX(selectedVisit.total_final_ugx)}</span>
                  </div>
                </div>
              </div>

              {selectedVisit.payments.length > 0 && (
                <div className="pt-2 border-t border-slate-100 text-xs space-y-1">
                  <div className="font-semibold text-slate-700">Recorded Payments</div>
                  {selectedVisit.payments.map((p, idx) => (
                    <div key={idx} className="flex justify-between text-slate-600">
                      <span className="capitalize">{p.method.replace(/_/g, ' ')}:</span>
                      <span className="tabular-nums font-medium">{formatUGX(p.amount_ugx)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white p-8 text-center text-xs text-slate-400">
              Select any visit row to inspect complete multi-line services, assigned stylists, and timestamps.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
