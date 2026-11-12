'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { formatUGX } from '@/shared/models/money';
import { formatUgPhoneDisplay } from '@/shared/models/phone';
import {
  getVisitsTabsDataAction,
  requestManagerApprovalAction,
  ReceptionQueueItem,
  ReceptionKioskOrder,
  getPendingKioskOrdersAction,
} from '../controllers/reception.actions';
import { getReceiptAction, printVisitReceipt, ReceiptDocument, ReceiptSnapshot } from '@/modules/payments';
import {
  Scissors,
  CreditCard,
  Banknote,
  Smartphone,
  Printer,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  ChevronRight,
  Plus,
  ShieldAlert,
  X,
  FileText,
  Calendar,
  User,
} from 'lucide-react';

export function ReceptionVisitsView() {
  const [tab, setTab] = useState<'active' | 'today' | 'history' | 'awaiting'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const loadSequence = useRef(0);
  const orderLoadSequence = useRef(0);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [activeVisits, setActiveVisits] = useState<ReceptionQueueItem[]>([]);
  const [completedTodayVisits, setCompletedTodayVisits] = useState<ReceptionQueueItem[]>([]);
  const [historyVisits, setHistoryVisits] = useState<ReceptionQueueItem[]>([]);
  const [awaitingOrders, setAwaitingOrders] = useState<ReceptionKioskOrder[]>([]);
  const [todayTotals, setTodayTotals] = useState<{
    cash_ugx: number;
    momo_ugx: number;
    total_ugx: number;
    paid_count: number;
  }>({ cash_ugx: 0, momo_ugx: 0, total_ugx: 0, paid_count: 0 });

  // Drawer / Details modal state
  const [selectedVisit, setSelectedVisit] = useState<ReceptionQueueItem | null>(null);

  // Reprint Receipt Modal State
  const [reprintReceipt, setReprintReceipt] = useState<ReceiptSnapshot | null>(null);
  const [reprintError, setReprintError] = useState<string | null>(null);

  // Request Manager Modal State
  const [managerRequestModal, setManagerRequestModal] = useState<{
    visitId: string;
    ticketCode: string;
  } | null>(null);
  const [managerReason, setManagerReason] = useState('Customer requested visit cancellation / refund');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  useEffect(() => {
    void loadData();
    void loadAwaitingOrders();
  }, []);

  async function loadData() {
    const requestId = ++loadSequence.current;
    setLoading(true);
    const res = await getVisitsTabsDataAction();
    if (requestId !== loadSequence.current) return;
    if (res.success) {
      setActiveVisits(res.data.active);
      setCompletedTodayVisits(res.data.completedToday);
      setHistoryVisits(res.data.history);
      setTodayTotals(res.data.today_totals);

      // Keep selected visit updated if open
      const all = [...res.data.active, ...res.data.completedToday, ...res.data.history];
      setSelectedVisit((current) => current ? all.find((v) => v.id === current.id) || current : current);
    }
    setLoading(false);
  }

  async function loadAwaitingOrders() {
    const requestId = ++orderLoadSequence.current;
    setLoadingOrders(true);
    const orders = await getPendingKioskOrdersAction();
    if (requestId !== orderLoadSequence.current) return;
    if (orders.success) setAwaitingOrders(orders.data);
    setLoadingOrders(false);
  }
  useSalonLiveRefresh(() => { void loadData(); }, true, [
    'visit', 'visit_service', 'payment', 'receipt', 'business_day', 'customer',
    'app_user', 'service_variant', 'service',
  ]);
  useSalonLiveRefresh(() => { void loadAwaitingOrders(); }, true, ['kiosk_order_request']);


  async function handleOpenReprint(visit: ReceptionQueueItem) {
    setReprintError(null);
    const result = await getReceiptAction(visit.id);
    if (result.success) {
      setReprintReceipt({ ...result.data, is_duplicate: true, reprinted_at: new Date().toISOString() });
    } else {
      setReprintError(result.error?.message || 'Could not load the receipt preview.');
    }
  }

  async function handlePrintPhysicalReceipt() {
    if (!reprintReceipt) return;
    const result = await printVisitReceipt(reprintReceipt.visit_id, { duplicate: true });
    if (result.success) {
      const printCount = result.data.print_count || reprintReceipt.print_count + 1;
      setReprintReceipt({ ...reprintReceipt, print_count: printCount });
      setSelectedVisit((visit) => visit ? {
        ...visit,
        payments: visit.payments?.map((payment, index) => index === 0 ? { ...payment, print_count: printCount } : payment),
      } : visit);
      setReprintError(null);
    } else {
      setReprintError(result.error?.message || 'Could not print the receipt.');
    }
  }

  async function handleSubmitManagerRequest() {
    if (!managerRequestModal || requestSubmitting) return;
    setRequestSubmitting(true);
    await requestManagerApprovalAction({
      kind: 'remove_started_line',
      visit_id: managerRequestModal.visitId,
      reason: managerReason,
      details: {},
    });
    setRequestSubmitting(false);
    setRequestSuccess(true);
    setTimeout(() => {
      setManagerRequestModal(null);
      setRequestSuccess(false);
    }, 2000);
  }

  const currentList =
    tab === 'active'
      ? activeVisits
      : tab === 'today'
      ? completedTodayVisits
      : historyVisits;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchDigits = normalizedSearch.replace(/[^0-9]/g, '');
  const displayedList = tab === 'history' && normalizedSearch
    ? currentList.filter((visit) => {
        const phoneDigits = (visit.phone_e164 || '').replace(/[^0-9]/g, '');
        return visit.customer_name.toLowerCase().includes(normalizedSearch)
          || visit.ticket_code.toLowerCase().includes(normalizedSearch)
          || Boolean(searchDigits && phoneDigits.includes(searchDigits));
      })
    : currentList;
  const filteredAwaiting = awaitingOrders.filter((order) => `${order.order_code} ${order.phone} ${order.first_name}`.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* 1. Header Strip: Today's Takings & Quick Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#E2E7EF] p-4 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#566174]">Visits Paid Today</span>
            <span className="p-2 bg-blue-50 text-[#1F4FD8] rounded-xl">
              <Scissors className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-[#0A0E14] mt-2 tabular-nums">
            {todayTotals.paid_count}
          </div>
          <p className="text-[11px] text-[#566174] mt-1">
            {activeVisits.length} currently active in salon
          </p>
        </Card>

        <Card className="rounded-2xl border-[#E2E7EF] p-4 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#566174]">Cash in Till</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Banknote className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-[#0A0E14] mt-2 tabular-nums">
            {formatUGX(todayTotals.cash_ugx)}
          </div>
          <p className="text-[11px] text-[#566174] mt-1">Physical drawer intake</p>
        </Card>

        <Card className="rounded-2xl border-[#E2E7EF] p-4 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#566174]">Mobile Money (Recorded)</span>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Smartphone className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-[#0A0E14] mt-2 tabular-nums">
            {formatUGX(todayTotals.momo_ugx)}
          </div>
          <p className="text-[11px] text-amber-600 font-medium mt-1">
            Not yet verified against bank feed
          </p>
        </Card>

        <Card className="rounded-2xl border-[#1F4FD8]/20 p-4 bg-gradient-to-br from-[#1F4FD8]/5 to-transparent shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1F4FD8]">Total Salon Takings</span>
            <span className="p-2 bg-[#1F4FD8] text-white rounded-xl shadow-xs">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-[#0A0E14] mt-2 tabular-nums">
            {formatUGX(todayTotals.total_ugx)}
          </div>
          <p className="text-[11px] text-[#566174] mt-1">Pre-paid gross takings today</p>
        </Card>
      </div>

      {/* 2. Tabs & Live Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-[#E2E7EF] pb-4">
        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F6F8FB] border border-[#E2E7EF] rounded-xl self-start">
          <button
            onClick={() => setTab('awaiting')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === 'awaiting' ? 'bg-white text-[#1F4FD8] shadow-xs border border-[#E2E7EF]' : 'text-[#566174] hover:text-[#0A0E14]'}`}
          >
            Awaiting payment ({awaitingOrders.length})
          </button>
          <button
            onClick={() => setTab('active')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'active'
                ? 'bg-white text-[#1F4FD8] shadow-xs border border-[#E2E7EF]'
                : 'text-[#566174] hover:text-[#0A0E14]'
            }`}
          >
            Active ({activeVisits.length})
          </button>
          <button
            onClick={() => setTab('today')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'today'
                ? 'bg-white text-[#1F4FD8] shadow-xs border border-[#E2E7EF]'
                : 'text-[#566174] hover:text-[#0A0E14]'
            }`}
          >
            Completed Today ({completedTodayVisits.length})
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'history'
                ? 'bg-white text-[#1F4FD8] shadow-xs border border-[#E2E7EF]'
                : 'text-[#566174] hover:text-[#0A0E14]'
            }`}
          >
            History
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#566174] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, phone, ticket..."
            className="w-full text-xs pl-9 pr-3.5 py-2 bg-white border border-[#E2E7EF] rounded-xl text-[#0A0E14] outline-none focus:ring-2 focus:ring-[#7B9BF0] focus:border-[#1F4FD8] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Visits Table */}
      {tab === 'awaiting' ? (
        <Card className="rounded-2xl border-[#E2E7EF] shadow-xs bg-white overflow-hidden">
          <CardHeader className="p-4 border-b border-[#E2E7EF] bg-[#F6F8FB]/50 flex flex-row items-center justify-between"><CardTitle className="text-sm font-semibold text-[#0A0E14]">Kiosk orders awaiting payment ({loadingOrders ? '…' : filteredAwaiting.length})</CardTitle><Link href="/reception/kiosk-orders" className="text-xs font-semibold text-blue-700 hover:underline">Open kiosk orders page</Link></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loadingOrders ? <div className="p-12 text-center text-xs text-[#566174] animate-pulse">Loading kiosk orders…</div> : filteredAwaiting.length === 0 ? <div className="p-12 text-center text-xs text-[#566174]">No kiosk orders are waiting for payment.</div> : (
              <table className="w-full text-left text-xs"><thead className="bg-[#F6F8FB] text-[#566174] font-semibold"><tr><th className="p-3">Order</th><th className="p-3">First name</th><th className="p-3">Phone</th><th className="p-3">Services</th><th className="p-3 text-right">Estimated total</th><th className="p-3">Waiting since</th></tr></thead><tbody className="divide-y divide-[#E2E7EF]">{filteredAwaiting.map((order) => <tr key={order.id}><td className="p-3 font-bold text-[#1F4FD8]">{order.order_code}</td><td className="p-3">{order.first_name}</td><td className="p-3 tabular-nums">{formatUgPhoneDisplay(order.phone)}</td><td className="p-3">{order.lines.map((line) => line.variant_name).join(', ')}</td><td className="p-3 text-right font-semibold">{formatUGX(order.total_ugx)}</td><td className="p-3">{new Date(order.created_at).toLocaleString('en-UG')}</td></tr>)}</tbody></table>
            )}
          </CardContent>
        </Card>
      ) : <Card className="rounded-2xl border-[#E2E7EF] shadow-xs bg-white overflow-hidden">
        <CardHeader className="p-4 border-b border-[#E2E7EF] bg-[#F6F8FB]/50 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-[#0A0E14]">
            {tab === 'active'
              ? 'Active Visits in Progress'
              : tab === 'today'
              ? 'Completed Visits Today'
              : 'Visit History Records'}
          </CardTitle>
          <span className="text-xs font-medium text-[#566174]">
            {displayedList.length} {displayedList.length === 1 ? 'visit' : 'visits'} listed
          </span>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-[#566174] animate-pulse">
              Loading salon visits...
            </div>
          ) : displayedList.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#566174] space-y-2">
              <Scissors className="w-8 h-8 text-slate-300 mx-auto" />
              <p>No visits found matching current filter or search.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F8FB] text-[#566174] font-semibold border-b border-[#E2E7EF]">
                <tr>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Services</th>
                  <th className="py-3 px-4 text-right">Total (UGX)</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E7EF] font-medium">
              {displayedList.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => setSelectedVisit(v)}
                    className={`hover:bg-[#F6F8FB]/80 cursor-pointer transition-colors ${
                      selectedVisit?.id === v.id ? 'bg-[#1F4FD8]/5' : ''
                    }`}
                  >
                    <td className="py-3 px-4 tabular-nums font-bold text-[#1F4FD8]">
                      {v.ticket_code}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#0A0E14]">{v.customer_name}</div>
                    </td>
                    <td className="py-3 px-4 text-[#566174] tabular-nums">
                      {formatUgPhoneDisplay(v.phone_e164)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`capitalize px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          v.status === 'paid' || v.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : v.status === 'in_service'
                            ? 'bg-blue-50 text-[#1F4FD8] border border-blue-200'
                            : v.status === 'payment_pending'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {v.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#566174]">
                      <span className="line-clamp-1">{v.services_summary || 'General Service'}</span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold text-[#0A0E14]">
                      {formatUGX(v.total_price_ugx)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVisit(v);
                        }}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-[#0A0E14] transition-colors"
                      >
                        <ChevronRight className="w-4 h-4 ml-auto" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>}

      {/* 4. Visit Detail Drawer / Modal */}
      {selectedVisit && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-end z-50">
          <div className="w-full max-w-lg h-full bg-white shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-[#E2E7EF] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-[#1F4FD8] tabular-nums">
                      {selectedVisit.ticket_code}
                    </span>
                    <span
                      className={`capitalize px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        selectedVisit.status === 'paid' || selectedVisit.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-blue-50 text-[#1F4FD8]'
                      }`}
                    >
                      {selectedVisit.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#0A0E14] mt-1">
                    {selectedVisit.customer_name} · {formatUgPhoneDisplay(selectedVisit.phone_e164)}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedVisit(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Service Lines Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-[#0A0E14] flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-[#1F4FD8]" />
                  Service Lines & Stylists
                </h4>
                <div className="border border-[#E2E7EF] rounded-xl overflow-hidden divide-y divide-[#E2E7EF] text-xs">
                  {selectedVisit.lines.map((l) => (
                    <div key={l.id} className="p-3 bg-white flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[#0A0E14]">{l.variant_name}</div>
                        <div className="text-[11px] text-[#566174]">
                          Stylist: <span className="font-medium text-[#0A0E14]">{l.staff_name || 'Unassigned'}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold tabular-nums text-[#0A0E14]">
                          {formatUGX(l.final_price_ugx)}
                        </div>
                        <span className="text-[10px] font-medium text-slate-400 capitalize">
                          {l.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Snapshot */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-[#0A0E14] flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-[#1F4FD8]" />
                  Payment & Charges
                </h4>
                <div className="p-3.5 bg-[#F6F8FB] border border-[#E2E7EF] rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between text-[#566174]">
                    <span>List Total:</span>
                    <span className="tabular-nums font-medium text-[#0A0E14]">
                      {formatUGX(selectedVisit.total_price_ugx + (selectedVisit.total_discount_ugx || 0))}
                    </span>
                  </div>
                  {Boolean(selectedVisit.total_discount_ugx) && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount Applied:</span>
                      <span className="tabular-nums">-{formatUGX(selectedVisit.total_discount_ugx || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-[#0A0E14] border-t border-[#E2E7EF] pt-2">
                    <span>Final Amount:</span>
                    <span className="tabular-nums">{formatUGX(selectedVisit.total_price_ugx)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              {selectedVisit.payments && selectedVisit.payments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-[#0A0E14]">Payment Records</h4>
                  <div className="divide-y divide-[#E2E7EF] border border-[#E2E7EF] rounded-xl text-xs overflow-hidden">
                    {selectedVisit.payments.map((p) => (
                      <div key={p.id} className="p-3 bg-white flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-[#0A0E14] capitalize">
                            {p.method === 'mobile_money' ? 'Mobile Money (Attested)' : 'Cash'}
                          </div>
                          {p.provider_reference && (
                            <div className="text-[10px] text-[#566174]">Ref: {p.provider_reference}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-bold tabular-nums text-[#0A0E14]">
                            {formatUGX(p.amount_ugx)}
                          </div>
                          <span className="text-[10px] text-emerald-600 font-semibold">
                            {p.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons at bottom of drawer */}
            <div className="border-t border-[#E2E7EF] pt-4 space-y-2">
              <Button
                onClick={() => handleOpenReprint(selectedVisit)}
                className="w-full bg-[#1F4FD8] hover:bg-[#1A43B8] text-white font-semibold text-xs flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" /> Reprint Receipt
              </Button>
              {selectedVisit.payments?.[0] && (
                <p className="text-center text-[11px] text-[#566174]">
                  Reprinted {Math.max(0, (selectedVisit.payments[0].print_count || 1) - 1)} times
                </p>
              )}

              <Button
                variant="outline"
                onClick={() => {
                  setManagerRequestModal({
                    visitId: selectedVisit.id,
                    ticketCode: selectedVisit.ticket_code,
                  });
                }}
                className="w-full border-rose-200 text-[#B42318] hover:bg-rose-50 font-semibold text-xs flex items-center justify-center gap-2"
              >
                <ShieldAlert className="w-4 h-4" /> Request Manager (Cancel / Refund)
              </Button>

              <Button
                variant="ghost"
                onClick={() => setSelectedVisit(null)}
                className="w-full text-xs text-[#566174]"
              >
                Close Drawer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Thermal Receipt Simulation & Print Modal */}
      {reprintReceipt && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="rounded-xl border border-[#E2E7EF] overflow-hidden">
              <ReceiptDocument receipt={reprintReceipt} duplicate reprintedAt={reprintReceipt.reprinted_at} />
            </div>
            <p className="text-xs text-[#566174] text-center">Reprinted {Math.max(0, reprintReceipt.print_count - 1)} times.</p>
            {reprintError && <p role="alert" className="text-xs text-[#B42318]">{reprintError}</p>}
            <div className="flex flex-col gap-2">
              <Button
                onClick={handlePrintPhysicalReceipt}
                className="w-full bg-[#1F4FD8] hover:bg-[#1A43B8] text-white font-bold gap-2 text-xs"
              >
                <Printer className="w-4 h-4" /> Print duplicate receipt
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setReprintReceipt(null); setReprintError(null); }}
                className="text-slate-500 text-xs"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 6. Request Manager Approval Modal */}
      {managerRequestModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0A0E14]">Request Manager Approval</h3>
                <p className="text-xs text-[#566174]">
                  Ticket {managerRequestModal.ticketCode} (Cancellation / Refund)
                </p>
              </div>
            </div>

            {requestSuccess ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold text-center">
                Request sent to Manager Approvals queue.
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-[#566174]">
                  Only the manager can authorize service cancellations or refunds for active and paid visits.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0A0E14]">Reason for Request</label>
                  <textarea
                    rows={3}
                    value={managerReason}
                    onChange={(e) => setManagerReason(e.target.value)}
                    className="w-full text-xs p-3 border border-[#E2E7EF] rounded-xl outline-none focus:ring-2 focus:ring-[#7B9BF0]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setManagerRequestModal(null)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={requestSubmitting}
                    onClick={handleSubmitManagerRequest}
                    className="bg-[#1F4FD8] hover:bg-[#1A43B8] text-white text-xs font-semibold"
                  >
                    {requestSubmitting ? 'Submitting...' : 'Send Request'}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
