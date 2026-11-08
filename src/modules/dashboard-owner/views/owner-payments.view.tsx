'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { formatUGX } from '@/shared/models/money';
import { fetchOwnerPaymentsAction, OwnerPaymentRecord } from '@/modules/dashboard-owner';
import { CreditCard, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export function OwnerPaymentsView() {
  const [payments, setPayments] = useState<OwnerPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    setLoading(true);
    const res = await fetchOwnerPaymentsAction();
    if (res.success) {
      setPayments(res.data);
    }
    setLoading(false);
  }
  useSalonLiveRefresh(() => { void loadPayments(); });


  const momoPayments = payments.filter((p) => p.method === 'mobile_money');
  const cashPayments = payments.filter((p) => p.method === 'cash');
  const totalMomo = momoPayments.reduce((sum, p) => sum + p.amount_ugx, 0);
  const totalCash = cashPayments.reduce((sum, p) => sum + p.amount_ugx, 0);

  const unverifiedOver24h = payments.filter((p) => p.is_unverified_over_24h);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white p-5">
          <span className="text-xs font-medium text-slate-500">Total Mobile Money</span>
          <div className="text-2xl font-bold tabular-nums text-slate-900 mt-1">{formatUGX(totalMomo)}</div>
          <div className="text-[11px] text-slate-400 mt-1">{momoPayments.length} transactions recorded</div>
        </Card>
        <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white p-5">
          <span className="text-xs font-medium text-slate-500">Total Physical Cash</span>
          <div className="text-2xl font-bold tabular-nums text-slate-900 mt-1">{formatUGX(totalCash)}</div>
          <div className="text-[11px] text-slate-400 mt-1">Counted at close</div>
        </Card>
        <Card className={`rounded-2xl border p-5 ${unverifiedOver24h.length > 0 ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-[#EDEFF3]'}`}>
          <span className="text-xs font-medium text-slate-500">Unverified MoMo (&gt;24 Hours)</span>
          <div className={`text-2xl font-bold tabular-nums mt-1 ${unverifiedOver24h.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {unverifiedOver24h.length} {unverifiedOver24h.length === 1 ? 'alert' : 'alerts'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Requires statement reconciliation check</div>
        </Card>
      </div>

      {/* Payments Audit Table */}
      <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white overflow-hidden">
        <CardHeader className="p-4 border-b border-[#EDEFF3] bg-slate-50/50 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-900">Payments Audit Trail</CardTitle>
          <span className="text-xs text-slate-500 font-medium">{payments.length} transactions</span>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading payments...</div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No payment records found.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-[#EDEFF3]">
                <tr>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount (UGX)</th>
                  <th className="py-3 px-4">Status & Level</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Recorded By</th>
                  <th className="py-3 px-4 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {payments.map((p) => (
                  <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors ${p.is_unverified_over_24h ? 'bg-amber-50/40' : ''}`}>
                    <td className="py-3 px-4 tabular-nums font-bold text-[#1F4FD8]">{p.ticket_code}</td>
                    <td className="py-3 px-4 capitalize text-slate-700">{p.method.replace(/_/g, ' ')}</td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold text-slate-900">{formatUGX(p.amount_ugx)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        p.confirmation_level === 'reconciled'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.confirmation_level === 'confirmed'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {p.confirmation_level}
                      </span>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-500 text-[11px]">{p.provider_reference || '—'}</td>
                    <td className="py-3 px-4 text-slate-700">{p.recorded_by_name}</td>
                    <td className="py-3 px-4 text-right text-slate-400 tabular-nums text-[11px]">
                      {new Date(p.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
