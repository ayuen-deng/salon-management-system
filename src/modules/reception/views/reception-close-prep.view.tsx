'use client';

import { showToast } from '@/shared/lib/toast';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { formatUGX } from '@/shared/models/money';
import {
  getClosePrepDataAction,
  submitClosePrepCashCountAction,
} from '../controllers/reception.actions';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Banknote,
  Smartphone,
  Lock,
  RefreshCw,
} from 'lucide-react';

interface ClosePrepData {
  open_visits: Array<{ id: string; ticket_code: string; customer_name: string; status: string; total_ugx: number }>;
  unpaid_visits: Array<{ id: string; ticket_code: string; customer_name: string; total_ugx: number }>;
  pending_kiosk_orders: Array<{ id: string; order_code: string; first_name: string; created_at: string }>;
  system_cash_ugx: number;
  system_momo_ugx: number;
  total_sales_ugx: number;
  completed_checkouts: number;
  prepared_cash_count?: number;
  prepared_at?: string;
}

export function ReceptionClosePrepView() {
  const [data, setData] = useState<ClosePrepData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [cashInput, setCashInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const res = await getClosePrepDataAction();
    if (res.success && res.data) {
      setData(res.data);
      if (res.data.prepared_cash_count !== undefined) {
        setCashInput(res.data.prepared_cash_count.toString());
      }
    }
    setLoading(false);
  }
  useSalonLiveRefresh(() => { void loadData(); });


  async function handleSubmitCount(e: React.FormEvent) {
    e.preventDefault();
    const count = parseInt(cashInput.replace(/[^0-9]/g, ''), 10);
    if (isNaN(count) || count < 0) {
      showToast('Please enter a valid cash amount counted.');
      return;
    }

    setSubmitting(true);
    const res = await submitClosePrepCashCountAction(count, notes);
    if (res.success) {
      setSubmittedSuccess(true);
      await loadData();
    } else {
      showToast(res.error?.message || 'Failed to submit physical cash count.');
    }
    setSubmitting(false);
  }

  const hasBlockers = Boolean(
    data && (data.open_visits.length > 0 || data.unpaid_visits.length > 0)
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            End-of-Day Close Preparation
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit uncompleted tickets, reconcile drawer cash, and prepare handover for Manager (Joan)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      {/* Role Boundary Notice */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold  tracking-normal text-amber-400">
              Role Authority: Preparation Only
            </h4>
            <p className="text-xs text-slate-300">
              Receptionists count cash and clear visits. Only the <strong>Salon Manager (Joan)</strong> has the authority to formally close and lock the business day.
            </p>
          </div>
        </div>
      </div>

      {submittedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold block">Drawer Count Handover Submitted</span>
              <span>Physical count logged to system audit. Joan can now review this figure in Day Reconciliation.</span>
            </div>
          </div>
          <button
            onClick={() => setSubmittedSuccess(false)}
            className="text-xs font-bold text-emerald-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <Card className="p-12 text-center text-xs text-muted-foreground">
          Loading salon closeout audit...
        </Card>
      ) : !data ? (
        <Card className="p-8 text-center text-xs text-rose-600">
          Could not load close preparation data. Check business day status.
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Day Checklist Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Checklist 1: In-Service & Queued */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    {data.open_visits.length === 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                    1. Active Salon Visits ({data.open_visits.length})
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">
                    Must be completed or cancelled before day close
                  </p>
                </div>
                <Link href="/reception">
                  <Button variant="ghost" size="sm" className="text-xs text-primary gap-1">
                    Queue <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-4">
                {data.open_visits.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                    All salon chairs are clear. No pending clients in service.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.open_visits.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between p-2.5 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-bold px-2 py-0.5 bg-white border border-amber-300 rounded text-slate-900">
                            {v.ticket_code}
                          </span>
                          <span className="font-semibold text-slate-800">{v.customer_name}</span>
                        </div>
                        <span className="text-[10px] font-bold  px-2 py-0.5 bg-amber-200/60 text-amber-900 rounded-full">
                          {v.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-blue-200 shadow-xs md:col-span-2">
              <CardHeader className="pb-3 border-b border-blue-100">
                <CardTitle className="text-sm font-bold text-slate-900">Pending kiosk orders ({data.pending_kiosk_orders?.length || 0})</CardTitle>
                <p className="text-[11px] text-muted-foreground">Unpaid orders expire automatically when the manager closes the day. No ticket or payment is created.</p>
              </CardHeader>
              <CardContent className="p-4">
                {!data.pending_kiosk_orders?.length ? <div className="py-4 text-center text-xs text-slate-500">No kiosk orders need closing out.</div> : <div className="space-y-2">{data.pending_kiosk_orders.map((order) => <div key={order.id} className="flex items-center justify-between rounded-lg bg-blue-50 p-2.5 text-xs"><span className="font-bold">{order.order_code} · {order.first_name}</span><span className="text-slate-600">Will expire at day close</span></div>)}</div>}
              </CardContent>
            </Card>

            {/* Checklist 2: Ready for Checkout / Unpaid */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    {data.unpaid_visits.length === 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    )}
                    2. Unpaid Completed Visits ({data.unpaid_visits.length})
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">
                    Must collect cash/MoMo or mark paid
                  </p>
                </div>
                <Link href="/reception/checkout">
                  <Button variant="ghost" size="sm" className="text-xs text-primary gap-1">
                    Checkout <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-4">
                {data.unpaid_visits.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                    All completed visits have been paid and receipted.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.unpaid_visits.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between p-2.5 bg-rose-50/70 border border-rose-200/60 rounded-xl text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-bold px-2 py-0.5 bg-white border border-rose-300 rounded text-slate-900">
                            {v.ticket_code}
                          </span>
                          <span className="font-semibold text-slate-800">{v.customer_name}</span>
                        </div>
                        <span className="font-bold text-rose-700">{formatUGX(v.total_ugx)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* System Intake Summary vs Cash Count */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* System Intake Breakdown */}
            <Card className="lg:col-span-1 border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-900">
                  Recorded System Intake
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Computed from all confirmed payments today
                </p>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-medium text-slate-700">Cash Drawer Total</span>
                    </div>
                    <span className="font-bold text-sm text-slate-900">
                      {formatUGX(data.system_cash_ugx)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-medium text-slate-700">Mobile Money Total</span>
                    </div>
                    <span className="font-bold text-sm text-slate-900">
                      {formatUGX(data.system_momo_ugx)}
                    </span>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 ">Gross Intake</span>
                    <span className="text-base font-black text-primary">
                      {formatUGX(data.total_sales_ugx)}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 text-center">
                    {data.completed_checkouts} total checkout transactions recorded
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Handover Preparation Form */}
            <Card className="lg:col-span-2 border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Physical Cash Drawer Handover
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Count the notes in the desk drawer (including float) and log the count for Joan
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmitCount} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-800  tracking-normal block mb-1.5">
                      Physical Cash Counted (UGX)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={cashInput}
                        onChange={(e) => setCashInput(e.target.value)}
                        placeholder="e.g. 390000"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all tabular-nums"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Expected system cash: <span className="font-semibold text-slate-700">{formatUGX(data.system_cash_ugx)}</span> + morning float.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800  tracking-normal block mb-1.5">
                      Handover Notes or Discrepancies (Optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="e.g. UGX 5,000 extra loose change left over from morning float..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                    />
                  </div>

                  {data.prepared_at && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                      <span className="text-slate-600">Last submitted count:</span>
                      <span className="tabular-nums font-bold text-slate-900">
                        {formatUGX(data.prepared_cash_count || 0)} at {new Date(data.prepared_at).toLocaleTimeString('en-GB')}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 flex justify-between items-center">
                    {hasBlockers ? (
                      <span className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Clear the {data.open_visits.length + data.unpaid_visits.length} remaining tickets above before day lock
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        All tickets clear. Ready for manager handover.
                      </span>
                    )}

                    <Button
                      type="submit"
                      disabled={submitting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6"
                    >
                      {submitting ? 'Submitting...' : 'Submit Cash Count Handover'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
