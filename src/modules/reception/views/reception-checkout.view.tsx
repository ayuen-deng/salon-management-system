'use client';

import { showToast } from '@/shared/lib/toast';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { formatUGX } from '@/shared/models/money';
import {
  getCheckoutVisitsAction,
  recordPaymentAction,
  flagPaymentPendingAction,
  ReceptionQueueItem,
} from '../controllers/reception.actions';
import { getReceiptAction, printVisitReceipt, ReceiptDocument, ReceiptSnapshot } from '@/modules/payments';
import {
  CreditCard,
  Banknote,
  Smartphone,
  Printer,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

export function ReceptionCheckoutView() {
  const [readyVisits, setReadyVisits] = useState<ReceptionQueueItem[]>([]);
  const [todayTotals, setTodayTotals] = useState<{
    cash_ugx: number;
    momo_ugx: number;
    total_ugx: number;
    paid_count: number;
  }>({ cash_ugx: 0, momo_ugx: 0, total_ugx: 0, paid_count: 0 });
  const [loading, setLoading] = useState<boolean>(true);

  // Selected visit for checkout
  const [selectedVisit, setSelectedVisit] = useState<ReceptionQueueItem | null>(null);

  // Payment Form State
  const [method, setMethod] = useState<'cash' | 'momo'>('cash');
  const [amountInput, setAmountInput] = useState<string>('');
  const [momoReference, setMomoReference] = useState<string>('');
  const [submittingPayment, setSubmittingPayment] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string>('');

  // Paid Receipt Modal
  const [paidReceipt, setPaidReceipt] = useState<{
    receipt: ReceiptSnapshot;
    isOverpayment: boolean;
  } | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  useEffect(() => {
    loadCheckoutData();
    const interval = setInterval(loadCheckoutData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadCheckoutData() {
    const res = await getCheckoutVisitsAction();
    if (res.success) {
      setReadyVisits(res.data.ready);
      setTodayTotals(res.data.today_totals);
      if (!selectedVisit && res.data.ready.length > 0) {
        setSelectedVisit(res.data.ready[0]);
        setAmountInput(res.data.ready[0].total_price_ugx.toString());
      }
    }
    setLoading(false);
  }
  useSalonLiveRefresh(() => { void loadCheckoutData(); });


  function handleSelectVisit(v: ReceptionQueueItem) {
    setSelectedVisit(v);
    setAmountInput(v.total_price_ugx.toString());
    setMomoReference('');
    setPaymentError('');
  }

  async function handleRecordPayment() {
    if (!selectedVisit) return;
    setPaymentError('');

    const amt = parseInt(amountInput.replace(/[^0-9]/g, ''), 10);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError('Please enter a valid positive payment amount.');
      return;
    }

    if (method === 'momo' && (!momoReference || !momoReference.trim())) {
      setPaymentError('Mobile Money requires a valid transaction reference. Never mark paid on screenshot alone.');
      return;
    }

    setSubmittingPayment(true);
    const idempotencyKey = `pay-${selectedVisit.id}-${Date.now()}`;

    const res = await recordPaymentAction({
      visit_id: selectedVisit.id,
      method,
      amount_ugx: amt,
      provider_reference: momoReference.trim() || undefined,
      idempotency_key: idempotencyKey,
    });

    if (res.success) {
      const receiptResult = await getReceiptAction(selectedVisit.id);
      if (receiptResult.success) {
        setPaidReceipt({ receipt: receiptResult.data, isOverpayment: res.data.is_overpayment });
        setReceiptError(null);
      }
      await printVisitReceipt(selectedVisit.id);

      setSelectedVisit(null);
      setAmountInput('');
      setMomoReference('');
      await loadCheckoutData();
    } else {
      setPaymentError(res.error?.message || 'Failed to record payment.');
    }
    setSubmittingPayment(false);
  }

  async function handleFlagPaymentPending() {
    if (!selectedVisit) return;
    await flagPaymentPendingAction(
      selectedVisit.id,
      'Customer stated payment completed via phone; awaiting reference / network verification'
    );
    showToast(`Ticket ${selectedVisit.ticket_code} set to Payment Pending. Alerted manager.`);
    setSelectedVisit(null);
    await loadCheckoutData();
  }

  async function handlePrintReceipt() {
    if (paidReceipt?.receipt.visit_id) {
      const result = await printVisitReceipt(paidReceipt.receipt.visit_id);
      if (!result.success) setReceiptError(result.error?.message || 'Could not print the receipt.');
    }
  }

  async function handleReprintReceipt() {
    if (paidReceipt) {
      const result = await printVisitReceipt(paidReceipt.receipt.visit_id, { duplicate: true });
      if (result.success) {
        setPaidReceipt({
          ...paidReceipt,
          receipt: { ...paidReceipt.receipt, print_count: result.data.print_count || paidReceipt.receipt.print_count + 1 },
        });
        setReceiptError(null);
      } else {
        setReceiptError(result.error?.message || 'Could not print the receipt.');
      }
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Today's Totals Header Bar (Receptionist sees today's totals only) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border border-[#EDEFF3] shadow-xs rounded-2xl bg-white p-4">
          <span className="text-[10px]  font-bold text-slate-400 tracking-normal">Today's Paid Visits</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{todayTotals.paid_count}</div>
          <span className="text-[11px] text-slate-500">Completed checkouts</span>
        </Card>
        <Card className="border border-[#EDEFF3] shadow-xs rounded-2xl bg-white p-4">
          <span className="text-[10px]  font-bold text-emerald-600 tracking-normal">Cash Collected</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{formatUGX(todayTotals.cash_ugx)}</div>
          <span className="text-[11px] text-slate-500">Drawer physical cash</span>
        </Card>
        <Card className="border border-[#EDEFF3] shadow-xs rounded-2xl bg-white p-4">
          <span className="text-[10px]  font-bold text-blue-600 tracking-normal">Mobile Money</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{formatUGX(todayTotals.momo_ugx)}</div>
          <span className="text-[11px] text-slate-500">Recorded MoMo (Attested)</span>
        </Card>
        <Card className="border border-[#EDEFF3] shadow-xs rounded-2xl bg-white p-4">
          <span className="text-[10px]  font-bold text-slate-700 tracking-normal">Today's Total</span>
          <div className="text-2xl font-black text-primary mt-1">{formatUGX(todayTotals.total_ugx)}</div>
          <span className="text-[11px] text-slate-500">Total recorded intake</span>
        </Card>
      </div>

      {/* 2. Main Two-Column View: Visits Ready for Checkout vs Payment Execution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visits Ready for Payment */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-700  tracking-normal">
              Ready for Checkout ({readyVisits.length})
            </h2>
            <span className="text-xs text-muted-foreground">Newest first</span>
          </div>

          {readyVisits.length === 0 ? (
            <Card className="p-8 text-center text-xs text-muted-foreground border-dashed rounded-2xl bg-white">
              No visits currently ready for payment. Visits will appear here once all service lines finish.
            </Card>
          ) : (
            <div className="space-y-2">
              {readyVisits.map((v) => {
                const isSelected = selectedVisit?.id === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVisit(v)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all space-y-2 ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary'
                        : 'border-[#EDEFF3] bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-black text-lg bg-slate-100 text-slate-900 px-2 py-0.5 rounded-lg border">
                          {v.ticket_code}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{v.customer_name}</div>
                          <div className="text-[10px] text-muted-foreground">{v.services_summary}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-slate-900">{formatUGX(v.total_price_ugx)}</span>
                        {v.status === 'payment_pending' && (
                          <span className="block text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded mt-0.5">
                            Payment Pending
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Checkout Detail & Record Payment */}
        <div className="lg:col-span-7">
          {selectedVisit ? (
            <Card className="border border-[#EDEFF3] shadow-xs rounded-2xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/70 border-b border-[#EDEFF3] py-4 px-6 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Payment Terminal • Ticket {selectedVisit.ticket_code}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Guest: {selectedVisit.customer_name}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400  font-bold block">Bill Total</span>
                  <span className="text-2xl font-black text-slate-900">
                    {formatUGX(selectedVisit.total_price_ugx)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Service Lines Breakdown */}
                <div className="space-y-2 border-b border-slate-100 pb-4">
                  <span className="text-[10px]  font-bold text-slate-400 tracking-normal block">
                    Rendered Services
                  </span>
                  {selectedVisit.lines.map((l) => (
                    <div key={l.id} className="flex justify-between items-center text-xs py-1">
                      <span className="text-slate-800 font-medium">
                        {l.variant_name}{' '}
                        <span className="text-slate-400 font-normal">({l.staff_name || 'Staff'})</span>
                      </span>
                      <span className="font-bold text-slate-900">{formatUGX(l.final_price_ugx)}</span>
                    </div>
                  ))}
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700  tracking-normal block">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setMethod('cash')}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                        method === 'cash'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Banknote className="w-4 h-4" /> Physical Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod('momo')}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                        method === 'momo'
                          ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-2xs'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" /> Mobile Money (MTN / Airtel)
                    </button>
                  </div>
                </div>

                {/* Amount Received */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700  tracking-normal block">
                    Amount Received (UGX)
                  </label>
                  <input
                    type="text"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-primary focus:bg-white"
                  />
                  {parseInt(amountInput.replace(/[^0-9]/g, ''), 10) > selectedVisit.total_price_ugx && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Overpayment detected: UGX{' '}
                        {(
                          parseInt(amountInput.replace(/[^0-9]/g, ''), 10) - selectedVisit.total_price_ugx
                        ).toLocaleString()}{' '}
                        extra. Will be flagged for manager review.
                      </span>
                    </div>
                  )}
                </div>

                {/* Mobile Money Mandatory Reference */}
                {method === 'momo' && (
                  <div className="space-y-2 bg-blue-50/60 p-4 rounded-xl border border-blue-200/80">
                    <label className="text-xs font-bold text-blue-950  tracking-normal block">
                      Transaction Reference (Mandatory)
                    </label>
                    <input
                      type="text"
                      value={momoReference}
                      onChange={(e) => setMomoReference(e.target.value)}
                      placeholder="e.g. MTN-998412891 or Airtel ID"
                      className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm tabular-nums font-bold outline-none"
                    />
                    <p className="text-[11px] text-blue-800 font-medium">
                      Never mark a visit paid on a customer screenshot alone. Always require and type the transaction
                      reference from their SMS.
                    </p>
                  </div>
                )}

                {paymentError && <div className="text-xs text-rose-600 font-bold">{paymentError}</div>}

                {/* Actions: Record Payment & Customer Says Paid button */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    onClick={handleRecordPayment}
                    disabled={submittingPayment}
                    size="lg"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-sm shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {submittingPayment ? 'Recording...' : 'Record Payment & Print Receipt'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleFlagPaymentPending}
                    className="border-amber-300 text-amber-900 hover:bg-amber-50 text-xs font-semibold"
                  >
                    Customer Says They Paid
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-12 text-center text-xs text-muted-foreground border-dashed rounded-2xl bg-white">
              Select a visit from the left column to collect payment.
            </Card>
          )}
        </div>
      </div>

      {/* PRINT RECEIPT MODAL (Zero Customer Phone, Primary Print, Duplicate Reprint) */}
      {paidReceipt && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="rounded-xl border border-[#E2E7EF] overflow-hidden">
              <ReceiptDocument receipt={paidReceipt.receipt} />
            </div>
            <p className="text-xs text-[#566174] text-center">Reprinted {Math.max(0, paidReceipt.receipt.print_count - 1)} times.</p>
            {receiptError && <p role="alert" className="text-xs text-[#B42318]">{receiptError}</p>}

            {/* Modal Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handlePrintReceipt} className="w-full bg-[#1F4FD8] hover:bg-[#E05915] text-white font-bold gap-2">
                <Printer className="w-4 h-4" /> Print Receipt
              </Button>
              <Button variant="outline" size="sm" onClick={handleReprintReceipt} className="font-semibold text-xs">
                Print duplicate receipt
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPaidReceipt(null)} className="text-slate-500 text-xs">
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
