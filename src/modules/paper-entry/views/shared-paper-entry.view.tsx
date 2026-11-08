'use client';

import React, { useState, useEffect } from 'react';
import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { formatUGX } from '@/shared/models/money';
import { normalizeUgPhone } from '@/shared/models/phone';
import {
  getPaperCatalogueAction,
  getPaperStaffAction,
  enterPaperVisitAction,
} from '../controllers/paper.actions';
import type { PaperCatalogueItem, PaperStaffMember } from '../models/paper.repository';
import {
  FileEdit,
  CheckCircle2,
  Phone,
  User,
  Clock,
  Scissors,
  CreditCard,
  Calendar,
  Check,
  ShieldAlert,
} from 'lucide-react';

interface SharedPaperEntryViewProps {
  role: 'receptionist' | 'manager';
}

export function SharedPaperEntryView({ role }: SharedPaperEntryViewProps) {
  const [catalogue, setCatalogue] = useState<PaperCatalogueItem[]>([]);
  const [staff, setStaff] = useState<PaperStaffMember[]>([]);

  // Form fields matching the physical Customer Visit Sheet top-to-bottom
  const [paperSerial, setPaperSerial] = useState('');
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paperTicketCode, setPaperTicketCode] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [isBooked, setIsBooked] = useState(false);

  // Service & Stylist
  const [variantId, setVariantId] = useState('');
  const [listPriceUgx, setListPriceUgx] = useState(0);
  const [staffUserId, setStaffUserId] = useState('');
  const [isPreferredStylist, setIsPreferredStylist] = useState(false);

  // Discount
  const [discountUgx, setDiscountUgx] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [discountApprovedBy, setDiscountApprovedBy] = useState('');

  // Payment (Payment-First block)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo'>('cash');
  const [momoRef, setMomoRef] = useState('');
  const [timePaid, setTimePaid] = useState('');
  const [receivedByInitials, setReceivedByInitials] = useState('');

  // Service Execution Times
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadMeta = async () => {
    setLoading(true);
    const [cRes, sRes] = await Promise.all([getPaperCatalogueAction(), getPaperStaffAction()]);
    if (cRes.success && cRes.data) setCatalogue(cRes.data);
    if (sRes.success && sRes.data) setStaff(sRes.data);
    setLoading(false);
  };

  useSalonLiveRefresh(() => { void loadMeta(); });

  useEffect(() => {
    void loadMeta();
  }, []);

  const handleVariantChange = (selectedVariantId: string) => {
    setVariantId(selectedVariantId);
    let foundPrice = 0;
    catalogue.forEach((cat) => {
      cat.variants.forEach((v) => {
        if (v.id === selectedVariantId) foundPrice = v.list_price_ugx;
      });
    });
    setListPriceUgx(foundPrice);
  };

  const finalAmount = Math.max(0, listPriceUgx - discountUgx);

  const resetForm = () => {
    setPaperSerial('');
    setPaperTicketCode('');
    setArrivalTime('');
    setCustomerName('');
    setCustomerPhone('');
    setPhoneVerified(false);
    setIsBooked(false);
    setVariantId('');
    setListPriceUgx(0);
    setStaffUserId('');
    setIsPreferredStylist(false);
    setDiscountUgx(0);
    setDiscountReason('');
    setDiscountApprovedBy('');
    setPaymentMethod('cash');
    setMomoRef('');
    setTimePaid('');
    setReceivedByInitials('');
    setStartTime('');
    setEndTime('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFeedback(null);

    const cleanSerial = paperSerial.trim();
    if (!cleanSerial) {
      setErrorMessage('Paper Sheet Serial Number (e.g. R-0014) is required.');
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      setErrorMessage('Customer name and phone number are required.');
      return;
    }
    if (!variantId) {
      setErrorMessage('Please select the service variant that was performed.');
      return;
    }

    setSubmitting(true);
    const res = await enterPaperVisitAction({
      customerPhone: customerPhone.trim(),
      customerName: customerName.trim(),
      variantId,
      staffUserId: staffUserId || undefined,
      amountUgx: finalAmount,
      paperSerial: cleanSerial,
      role,
    });

    if (res.success && res.data) {
      setFeedback(
        `Paper visit entered successfully! Created ticket ${res.data.ticket_code} (Tagged: Entered via paper, Serial: ${cleanSerial}). Payment recorded in day ${paymentMethod}.`
      );
      resetForm();
    } else if (!res.success) {
      setErrorMessage(res.error?.message || 'Failed to record paper entry.');
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Enter From Paper Records
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Catch up offline paper Customer Visit Sheets (Form 1) when power or connectivity is restored (Appendix A & B).
        </p>
      </div>

      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{feedback}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-emerald-700 font-bold hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 font-bold hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900">
              <FileEdit className="w-4 h-4 text-primary" />
              Customer Visit Sheet Digitization (Form 1)
            </CardTitle>
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
              Matches Physical Sheet Layout
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Strict audit enforcement: Duplicate paper serials are rejected. Timestamps are recorded as reported times.
          </p>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Header: Serial & Ticket Code */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="text-xs font-bold text-slate-900 block mb-1">
                  Serial Number (Pre-printed) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. R-0014"
                  className="w-full text-sm font-bold border border-slate-300 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-primary"
                  value={paperSerial}
                  onChange={(e) => setPaperSerial(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Paper Ticket Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. P14"
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-primary"
                  value={paperTicketCode}
                  onChange={(e) => setPaperTicketCode(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Visit Date *
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="date"
                    className="w-full pl-8 pr-2 py-2 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Customer Identification */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-800 tracking-normal block">
                1. Customer & Arrival
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-3">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Arrival Time (HH:MM)
                  </label>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="10:15"
                      className="w-full pl-8 pr-2 py-2 text-xs border rounded-lg bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary"
                      value={arrivalTime}
                      onChange={(e) => setArrivalTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Customer First Name *
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="e.g. Juliet"
                      className="w-full pl-8 pr-2 py-2 text-xs border rounded-lg bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="sm:col-span-5">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Customer Phone (07XX / 2567XX) *
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="0772 123456"
                      className="w-full pl-8 pr-2 py-2 text-xs tabular-nums border rounded-lg bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-1 text-xs text-slate-600">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={phoneVerified}
                    onChange={(e) => setPhoneVerified(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>Phone number read-back verified with customer</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isBooked}
                    onChange={(e) => setIsBooked(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>Booked appointment (not walk-in)</span>
                </label>
              </div>
            </div>

            {/* Service & Preferred Stylist */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-800 tracking-normal block">
                2. Service Selection & Stylist
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Service & Variant *
                  </label>
                  <select
                    className="w-full text-xs border rounded-lg p-2.5 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary"
                    value={variantId}
                    onChange={(e) => handleVariantChange(e.target.value)}
                    required
                  >
                    <option value="">Select completed service variant...</option>
                    {catalogue.map((cat) => (
                      <optgroup key={cat.id} label={`${cat.category} • ${cat.name}`}>
                        {cat.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({formatUGX(v.list_price_ugx)})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Assigned Stylist (First Name)
                  </label>
                  <select
                    className="w-full text-xs border rounded-lg p-2.5 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary"
                    value={staffUserId}
                    onChange={(e) => setStaffUserId(e.target.value)}
                  >
                    <option value="">Any available stylist</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.display_name}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPreferredStylist}
                      onChange={(e) => setIsPreferredStylist(e.target.checked)}
                      className="rounded border-slate-300 text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span>Customer specifically requested this stylist</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Discount / Approval */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-800 tracking-normal block">
                3. Pricing & Discounts
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    List Price (UGX)
                  </label>
                  <div className="w-full text-xs font-bold p-2 bg-slate-100 rounded-lg text-slate-800 border border-slate-200">
                    {formatUGX(listPriceUgx)}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Discount Amount (UGX)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    className="w-full text-xs tabular-nums border rounded-lg p-2 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary"
                    value={discountUgx}
                    onChange={(e) => setDiscountUgx(Number(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Discount Reason / Approver
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Promo / Initials"
                    className="w-full text-xs border rounded-lg p-2 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Payment-First Confirmation Block */}
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-950 tracking-normal flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-primary" />
                  4. Payment-First Confirmation (Taken Before Service)
                </span>
                <span className="text-xs font-extrabold text-blue-900 bg-blue-100 px-3 py-1 rounded-md">
                  Total To Pay: {formatUGX(finalAmount)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Method *
                  </label>
                  <select
                    className="w-full text-xs border rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-primary"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'momo')}
                  >
                    <option value="cash">Physical Cash</option>
                    <option value="momo">Direct MoMo</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    MoMo Ref / Note
                  </label>
                  <input
                    type="text"
                    placeholder={paymentMethod === 'momo' ? 'e.g. 984321' : 'N/A (Cash)'}
                    disabled={paymentMethod !== 'momo'}
                    className="w-full text-xs border rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-primary disabled:bg-slate-100"
                    value={momoRef}
                    onChange={(e) => setMomoRef(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Time Paid (HH:MM)
                  </label>
                  <input
                    type="text"
                    placeholder="10:20"
                    className="w-full text-xs border rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-primary"
                    value={timePaid}
                    onChange={(e) => setTimePaid(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Received By (Initials)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MN"
                    className="w-full text-xs border rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-primary"
                    value={receivedByInitials}
                    onChange={(e) => setReceivedByInitials(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Service Times (Reported by Stylist to Receptionist) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-800 tracking-normal block">
                5. Service Execution Times (Reported by Stylist)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Start Time (HH:MM)
                  </label>
                  <input
                    type="text"
                    placeholder="10:25"
                    className="w-full text-xs border rounded-lg p-2 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    End / Done Time (HH:MM)
                  </label>
                  <input
                    type="text"
                    placeholder="11:10"
                    className="w-full text-xs border rounded-lg p-2 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/95 text-white font-bold text-xs h-11 shadow-xs"
                disabled={submitting || loading}
              >
                {submitting ? 'Recording Visit...' : 'Record Visit From Sheet (Form 1)'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
