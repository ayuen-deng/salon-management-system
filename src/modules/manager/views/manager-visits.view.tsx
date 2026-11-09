'use client';

import { showToast } from '@/shared/lib/toast';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { formatUGX } from '@/shared/models/money';
import {
  getManagerVisitsAction,
  addComplimentaryLineAction,
  adjustVisitTotalAction,
  correctTimestampsAction,
} from '../controllers/manager-nav.actions';
import { ManagerVisitRecord } from '../models/manager-operations.repository';
import { printVisitReceipt } from '@/modules/payments';
import {
  Scissors,
  Clock,
  Printer,
  Gift,
  Sliders,
  Calendar,
  CreditCard,
  User,
  X,
  FileCheck,
} from 'lucide-react';

export function ManagerVisitsView() {
  const [tab, setTab] = useState<'today' | 'all' | 'unpaid' | 'abandoned' | 'awaiting'>('today');
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<ManagerVisitRecord[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<ManagerVisitRecord | null>(null);

  // Modals state
  const [modalType, setModalType] = useState<'comp' | 'adjust' | 'correct' | null>(null);
  const [compVariantId, setCompVariantId] = useState('478f1d7f-81bc-442a-96fc-72a6c87e6f3f'); // Standard Hair Wash
  const [newTotalInput, setNewTotalInput] = useState('');
  const [correctLineId, setCorrectLineId] = useState('');
  const [startedTimeInput, setStartedTimeInput] = useState('09:15');
  const [endedTimeInput, setEndedTimeInput] = useState('09:50');
  const [reasonCode, setReasonCode] = useState('manager_discretion');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadVisits();
  }, [tab]);

  async function loadVisits() {
    setLoading(true);
    const res = await getManagerVisitsAction(tab);
    if (res.success) {
      setVisits(res.data);
      if (selectedVisit) {
        const updated = res.data.find((v) => v.id === selectedVisit.id);
        if (updated) setSelectedVisit(updated);
      }
    }
    setLoading(false);
  }
  useSalonLiveRefresh(() => { void loadVisits(); }, true, ['visit', 'visit_service', 'payment', 'customer', 'business_day', 'service_variant', 'app_user']);


  async function handleAddComp() {
    if (!selectedVisit || submitting) return;
    setSubmitting(true);
    await addComplimentaryLineAction(selectedVisit.id, compVariantId, reasonCode);
    setSubmitting(false);
    setModalType(null);
    await loadVisits();
  }

  async function handleAdjustTotal() {
    if (!selectedVisit || submitting || !newTotalInput) return;
    setSubmitting(true);
    await adjustVisitTotalAction(selectedVisit.id, parseInt(newTotalInput, 10), reasonCode);
    setSubmitting(false);
    setModalType(null);
    setNewTotalInput('');
    await loadVisits();
  }

  async function handleCorrectTimestamps() {
    if (!correctLineId || submitting) return;
    setSubmitting(true);
    const today = new Date().toISOString().split('T')[0];
    const sDate = `${today}T${startedTimeInput}:00+03:00`;
    const eDate = `${today}T${endedTimeInput}:00+03:00`;
    await correctTimestampsAction(correctLineId, sDate, eDate, reasonCode);
    setSubmitting(false);
    setModalType(null);
    await loadVisits();
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Visits & Service Adjustments</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit visit service lines, adjust disputed totals, add complimentary care, and print receipts
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          {(['today', 'all', 'unpaid', 'abandoned', 'awaiting'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition-all ${
                tab === t
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t === 'awaiting' ? 'Awaiting payment' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Visits Table + Visit Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`${selectedVisit ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
          <Card className="shadow-xs border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-slate-900">
                {tab.toUpperCase()} Visits ({visits.length})
              </CardTitle>
              {tab === 'awaiting' && <Link href="/manager/kiosk-orders" className="text-xs font-semibold text-blue-700 hover:underline">Open kiosk orders page</Link>}
            </CardHeader>
            <CardContent className="pt-2 divide-y divide-slate-100">
              {loading ? (
                <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                  Loading visits...
                </div>
              ) : visits.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No visits found for current tab.
                </div>
              ) : (
                visits.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVisit(v)}
                    className={`py-3 px-2 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                      selectedVisit?.id === v.id
                        ? 'bg-amber-50/60 border border-amber-200'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-bold text-sm bg-slate-100 px-2 py-0.5 rounded text-slate-900">
                          {v.ticket_code}
                        </span>
                        <span className="font-semibold text-xs text-slate-900">{v.customer_name}</span>
                        <span
                          className={`text-[10px]  font-bold px-2 py-0.5 rounded-full ${
                            v.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : v.status === 'completed'
                              ? 'bg-amber-100 text-amber-800'
                              : v.status === 'in_service'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {v.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {v.lines.length} service line(s) • Total: {formatUGX(v.total_final_ugx)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-xs text-slate-900">{formatUGX(v.total_final_ugx)}</div>
                      <div className="text-[10px] text-slate-400 tabular-nums">
                        {v.queued_at ? new Date(v.queued_at).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' }) : '—'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* VISIT DETAIL DRAWER */}
        {selectedVisit && (
          <div className="lg:col-span-5 space-y-4">
            <Card className="shadow-md border-[#1F4FD8]/30">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="tabular-nums font-bold text-lg text-slate-900 bg-white px-2 py-0.5 rounded border">
                    {selectedVisit.ticket_code}
                  </span>
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">{selectedVisit.customer_name}</CardTitle>
                    <p className="text-[10px] text-muted-foreground">{selectedVisit.customer_phone || 'Walk-in'}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedVisit(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                {/* Financial Overview */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">List Price:</span>
                    <span className="font-medium">{formatUGX(selectedVisit.total_list_ugx)}</span>
                  </div>
                  <div className="flex justify-between text-amber-700">
                    <span>Discount:</span>
                    <span className="font-medium">- {formatUGX(selectedVisit.total_discount_ugx)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 border-t pt-1">
                    <span>Total Final:</span>
                    <span>{formatUGX(selectedVisit.total_final_ugx)}</span>
                  </div>
                </div>

                {/* Service Lines List */}
                <div className="space-y-2">
                  <div className="text-[10px]  font-bold text-slate-400">Service Lines</div>
                      {selectedVisit.lines.map((l) => (
                    <div key={l.id} className="p-2.5 rounded-lg border bg-white space-y-1">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>{l.variant_name}</span>
                        <span>{formatUGX(l.final_price_ugx)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Staff: {l.staff_name}</span>
                        <span className="capitalize">{l.status}</span>
                      </div>
                      {l.times_source === 'corrected' && (
                        <span className="inline-block text-[9px]  font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">
                          Times Source: Corrected
                        </span>
                      )}
                {selectedVisit.status !== 'draft' && !(selectedVisit.order_code && ['expired', 'cancelled'].includes(selectedVisit.status)) && (
                        <div className="flex justify-end gap-2 pt-1 border-t border-slate-50">
                          <button
                            onClick={() => {
                              setCorrectLineId(l.id);
                              setModalType('correct');
                            }}
                            className="text-[10px] text-primary hover:underline font-semibold"
                          >
                            Correct Timestamps
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {selectedVisit.status === 'draft' ? (
                  <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">This kiosk order is awaiting payment. It is not in the salon queue yet.</p>
                ) : selectedVisit.order_code && ['expired', 'cancelled'].includes(selectedVisit.status) ? (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">This kiosk order ended before payment. It is shown for reference only.</p>
                ) : (
                /* Manager Exception Actions */
                <div className="pt-2 border-t space-y-2">
                  <div className="text-[10px]  font-bold text-slate-400">Manager Exception Actions</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs flex items-center gap-1.5"
                      onClick={() => setModalType('comp')}
                    >
                      <Gift className="w-3.5 h-3.5 text-purple-600" />
                      <span>Add Comp Line</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs flex items-center gap-1.5"
                      onClick={() => setModalType('adjust')}
                    >
                      <Sliders className="w-3.5 h-3.5 text-amber-600" />
                      <span>Adjust Dispute</span>
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full text-xs flex items-center justify-center gap-1.5"
                    onClick={async () => {
                      const result = await printVisitReceipt(selectedVisit.id, { duplicate: true });
                      if (!result.success) showToast(result.error?.message || 'Could not print the receipt.');
                    }}
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-700" />
                    <span>Print duplicate receipt</span>
                  </Button>
                </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* MODALS */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border">
            <h3 className="text-base font-bold text-slate-900">
              {modalType === 'comp' && 'Add Complimentary Service Line'}
              {modalType === 'adjust' && 'Adjust Visit Total (Dispute Resolution)'}
              {modalType === 'correct' && 'Correct Service Line Timestamps'}
            </h3>

            {modalType === 'comp' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-xs  font-bold text-slate-700 block mb-1">Select Service</label>
                  <select
                    value={compVariantId}
                    onChange={(e) => setCompVariantId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="478f1d7f-81bc-442a-96fc-72a6c87e6f3f">Standard Hair Wash (UGX 15,000 to 0)</option>
                    <option value="86bb36ce-05fc-492d-a98a-7141ce9a1a9d">Moisture Treatment (UGX 35,000 to 0)</option>
                    <option value="ad599030-70d3-4d66-9fe2-12f8361a3966">Blow-dry & Silk Press (UGX 50,000 to 0)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs  font-bold text-slate-700 block mb-1">Reason Code</label>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="manager_goodwill">Manager Goodwill / Relationship Care</option>
                    <option value="service_recovery">Service Delay / Recovery</option>
                    <option value="staff_training">Staff Training Model</option>
                  </select>
                </div>
              </div>
            )}

            {modalType === 'adjust' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-xs  font-bold text-slate-700 block mb-1">New Total Amount (UGX)</label>
                  <input
                    type="number"
                    placeholder="e.g. 40000"
                    value={newTotalInput}
                    onChange={(e) => setNewTotalInput(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs  font-bold text-slate-700 block mb-1">Reason Code</label>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="price_dispute">Customer Price Dispute Resolution</option>
                    <option value="dissatisfaction">Partial Service Dissatisfaction</option>
                    <option value="billing_correction">Cashier Billing Correction</option>
                  </select>
                </div>
              </div>
            )}

            {modalType === 'correct' && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs  font-bold text-slate-700 block mb-1">Started Time</label>
                    <input
                      type="time"
                      value={startedTimeInput}
                      onChange={(e) => setStartedTimeInput(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs  font-bold text-slate-700 block mb-1">Ended Time</label>
                    <input
                      type="time"
                      value={endedTimeInput}
                      onChange={(e) => setEndedTimeInput(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs  font-bold text-slate-700 block mb-1">Correction Reason</label>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="stylist_forgot_start">Stylist Forgot to Press Start</option>
                    <option value="device_lag">Device Offline / Network Blip</option>
                    <option value="interrupted_service">Interrupted Service Reconstruction</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setModalType(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[#1F4FD8] hover:bg-[#1F4FD8]/90 text-white"
                onClick={() => {
                  if (modalType === 'comp') handleAddComp();
                  if (modalType === 'adjust') handleAdjustTotal();
                  if (modalType === 'correct') handleCorrectTimestamps();
                }}
                disabled={submitting}
              >
                Apply Change
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
