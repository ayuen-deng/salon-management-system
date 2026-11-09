'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { formatUGX } from '@/shared/models/money';
import {
  getManagerPaymentsAction,
  recordPaymentAction,
  attachPaymentReferenceAction,
  voidPaymentAction,
  refundPaymentAction,
} from '../controllers/manager-nav.actions';
import { ManagerPaymentItem } from '../models/manager-operations.repository';
import {
  CreditCard,
  PlusCircle,
  Link as LinkIcon,
  Ban,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Calendar,
} from 'lucide-react';

export function ManagerPaymentsView() {
  const [payments, setPayments] = useState<ManagerPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [modalAction, setModalAction] = useState<'record' | 'attach' | 'void' | 'refund' | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<ManagerPaymentItem | null>(null);

  // Form states
  const [visitIdInput, setVisitIdInput] = useState('');
  const [methodInput, setMethodInput] = useState<'cash' | 'mobile_money'>('mobile_money');
  const [amountInput, setAmountInput] = useState('50000');
  const [referenceInput, setReferenceInput] = useState('');
  const [reasonCode, setReasonCode] = useState('manager_correction');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    setLoading(true);
    const res = await getManagerPaymentsAction();
    if (res.success) {
      setPayments(res.data);
    }
    setLoading(false);
  }
  useSalonLiveRefresh(() => { void loadPayments(); }, true, ['payment', 'business_day', 'visit', 'app_user']);


  async function handleRecordPayment() {
    if (submitting || !visitIdInput || !amountInput) return;
    setSubmitting(true);
    const idempotencyKey = `mgr_pay_${Date.now()}`;
    await recordPaymentAction(
      visitIdInput,
      methodInput,
      parseInt(amountInput, 10),
      referenceInput || undefined,
      idempotencyKey
    );
    setSubmitting(false);
    setModalAction(null);
    setVisitIdInput('');
    setReferenceInput('');
    await loadPayments();
  }

  async function handleAttachReference() {
    if (!selectedPayment || submitting || !referenceInput) return;
    setSubmitting(true);
    await attachPaymentReferenceAction(selectedPayment.id, referenceInput);
    setSubmitting(false);
    setModalAction(null);
    setReferenceInput('');
    setSelectedPayment(null);
    await loadPayments();
  }

  async function handleVoidPayment() {
    if (!selectedPayment || submitting) return;
    setSubmitting(true);
    await voidPaymentAction(selectedPayment.id, reasonCode);
    setSubmitting(false);
    setModalAction(null);
    setSelectedPayment(null);
    await loadPayments();
  }

  async function handleRefundPayment() {
    if (!selectedPayment || submitting || !amountInput) return;
    setSubmitting(true);
    await refundPaymentAction(selectedPayment.id, parseInt(amountInput, 10), reasonCode);
    setSubmitting(false);
    setModalAction(null);
    setSelectedPayment(null);
    await loadPayments();
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header and Record Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Payments & Cashier Journal</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Realtime payments journal with confirmation levels, MoMo references, and immutable adjustments
          </p>
        </div>

        <Button
          onClick={() => {
            setAmountInput('50000');
            setModalAction('record');
          }}
          className="text-xs bg-[#1F4FD8] hover:bg-[#1F4FD8]/90 text-white font-semibold flex items-center gap-1.5"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Record Payment</span>
        </Button>
      </div>

      {/* Payments Table */}
      <Card className="shadow-xs border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-900">
            Recorded Transactions ({payments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2 divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
              Loading payment records...
            </div>
          ) : payments.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No payments recorded yet.
            </div>
          ) : (
            payments.map((p) => (
              <div key={p.id} className="py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-bold text-sm bg-slate-100 px-2 py-0.5 rounded text-slate-900">
                      {p.ticket_code}
                    </span>
                    <span className="font-bold text-sm text-slate-900">{formatUGX(p.amount_ugx)}</span>
                    <span className="text-xs text-slate-500  font-semibold">({p.method.replace('_', ' ')})</span>
                    <span
                      className={`text-[10px]  font-bold px-2 py-0.5 rounded-full ${
                        p.status === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.status === 'voided'
                          ? 'bg-slate-200 text-slate-700'
                          : p.status === 'refunded'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.status}
                    </span>
                    <span className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded font-medium">
                      Level: {p.confirmation_level.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Recorded by <span className="font-medium text-slate-700">{p.recorded_by_name}</span>
                    {p.provider_reference ? (
                      <span className="ml-2 tabular-nums text-slate-700">Ref: {p.provider_reference}</span>
                    ) : (
                      <span className="ml-2 text-amber-600 font-medium">No provider ref</span>
                    )}
                    {p.created_at && (
                      <span className="ml-2 tabular-nums text-[10px]">
                        • {new Date(p.created_at).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Manager Actions on Payment */}
                {p.status === 'confirmed' && (
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {!p.provider_reference && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                        onClick={() => {
                          setSelectedPayment(p);
                          setReferenceInput('');
                          setModalAction('attach');
                        }}
                      >
                        Attach Ref
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2 text-rose-700 border-rose-200 hover:bg-rose-50"
                      onClick={() => {
                        setSelectedPayment(p);
                        setAmountInput(p.amount_ugx.toString());
                        setModalAction('refund');
                      }}
                    >
                      Refund
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-2 text-slate-600 hover:text-slate-900"
                      onClick={() => {
                        setSelectedPayment(p);
                        setModalAction('void');
                      }}
                    >
                      Void
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* MODALS */}
      {modalAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border">
            <h3 className="text-base font-bold text-slate-900">
              {modalAction === 'record' && 'Record Payment'}
              {modalAction === 'attach' && 'Attach / Correct Provider Reference'}
              {modalAction === 'void' && 'Void Payment Transaction'}
              {modalAction === 'refund' && 'Process Payment Refund'}
            </h3>

            {modalAction === 'record' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-xs  font-bold text-slate-700 block mb-1">Visit ID</label>
                  <input
                    type="text"
                    placeholder="Enter visit UUID..."
                    value={visitIdInput}
                    onChange={(e) => setVisitIdInput(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white tabular-nums"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs  font-bold text-slate-700 block mb-1">Method</label>
                    <select
                      value={methodInput}
                      onChange={(e) => setMethodInput(e.target.value as 'cash' | 'mobile_money')}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option value="mobile_money">Mobile Money</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs  font-bold text-slate-700 block mb-1">Amount (UGX)</label>
                    <input
                      type="number"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs  font-bold text-slate-700 block mb-1">
                    Provider Reference (MoMo transaction ID)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MTN-8947382"
                    value={referenceInput}
                    onChange={(e) => setReferenceInput(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white tabular-nums"
                  />
                </div>
              </div>
            )}

            {modalAction === 'attach' && (
              <div className="space-y-3 text-xs">
                <p className="text-slate-600">
                  Attach or correct the transaction provider reference for Ticket {selectedPayment?.ticket_code} (UGX {selectedPayment?.amount_ugx.toLocaleString()}).
                </p>
                <div>
                  <label className="text-xs  font-bold text-slate-700 block mb-1">
                    Provider Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MTN-REC-994"
                    value={referenceInput}
                    onChange={(e) => setReferenceInput(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white tabular-nums"
                  />
                </div>
              </div>
            )}

            {modalAction === 'void' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-100 rounded-xl space-y-1">
                  <div>Ticket: <span className="font-bold">{selectedPayment?.ticket_code}</span></div>
                  <div>Amount to void: <span className="font-bold">{formatUGX(selectedPayment?.amount_ugx || 0)}</span></div>
                  <div className="text-[11px] text-muted-foreground">
                    Voiding writes a linked negative adjustment row. The original payment row is never edited or deleted.
                  </div>
                </div>
                <div>
                  <label className="text-xs  font-bold text-slate-700 block mb-1">Void Reason</label>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="accidental_duplicate">Accidental Duplicate Cashier Entry</option>
                    <option value="wrong_payment_method">Wrong Payment Method Selected</option>
                    <option value="failed_momo_transmission">Failed MoMo Transmission / Reversal</option>
                  </select>
                </div>
              </div>
            )}

            {modalAction === 'refund' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                  <div className="font-bold">Important Operational Note:</div>
                  <div className="text-[11px]">
                    Pay the customer back through Mobile Money outside this system, then record the refund here.
                  </div>
                </div>
                <div>
                  <label className="text-xs  font-bold text-slate-700 block mb-1">Refund Amount (UGX)</label>
                  <input
                    type="number"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs  font-bold text-slate-700 block mb-1">Refund Reason</label>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="service_dissatisfaction">Customer Service Dissatisfaction</option>
                    <option value="customer_overcharge">Cashier Overcharge Correction</option>
                    <option value="unrendered_service">Unrendered Paid Service</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setModalAction(null);
                  setSelectedPayment(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[#1F4FD8] hover:bg-[#1F4FD8]/90 text-white"
                onClick={() => {
                  if (modalAction === 'record') handleRecordPayment();
                  if (modalAction === 'attach') handleAttachReference();
                  if (modalAction === 'void') handleVoidPayment();
                  if (modalAction === 'refund') handleRefundPayment();
                }}
                disabled={submitting}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
