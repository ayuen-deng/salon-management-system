'use client';

import { showToast } from '@/shared/lib/toast';

import React, { useState, useEffect } from 'react';
import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  getCatalogueAction,
  getStaffListAction,
  enterPaperVisitAction,
  type ManagerCatalogueItem,
  type ManagerStaffMember,
} from '../controllers/manager-nav.actions';
import { formatUgx } from '@/shared/models/money';
import { FileEdit, CheckCircle2, AlertCircle } from 'lucide-react';

export function ManagerPaperEntryView() {
  const [catalogue, setCatalogue] = useState<ManagerCatalogueItem[]>([]);
  const [staff, setStaff] = useState<ManagerStaffMember[]>([]);
  const [form, setForm] = useState({
    customerPhone: '+256',
    customerName: '',
    variantId: '',
    staffUserId: '',
    amountUgx: 0,
    paperRef: '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadMeta = async () => {
    setLoading(true);
    const [cRes, sRes] = await Promise.all([getCatalogueAction(), getStaffListAction()]);
    if (cRes.success && cRes.data) setCatalogue(cRes.data);
    if (sRes.success && sRes.data) setStaff(sRes.data.filter((s: ManagerStaffMember) => s.role === 'staff'));
    setLoading(false);
  };

  useSalonLiveRefresh(() => { void loadMeta(); });

  useEffect(() => {
    void loadMeta();
  }, []);

  const handleVariantChange = (variantId: string) => {
    let foundPrice = 0;
    catalogue.forEach(item => {
      item.variants.forEach(v => {
        if (v.id === variantId) foundPrice = v.list_price_ugx;
      });
    });
    setForm({ ...form, variantId, amountUgx: foundPrice });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerPhone || !form.customerName || !form.variantId || !form.paperRef) {
      showToast('Please fill out all required paper entry fields.');
      return;
    }

    setSubmitting(true);
    const res = await enterPaperVisitAction(
      form.customerPhone,
      form.customerName,
      form.variantId,
      form.staffUserId || undefined,
      form.amountUgx,
      form.paperRef
    );

    if (res.success && res.data) {
      setFeedback(`Paper entry logged successfully! Created ticket ${res.data.ticket_code} with payment recorded.`);
      setForm({
        customerPhone: '+256',
        customerName: '',
        variantId: '',
        staffUserId: '',
        amountUgx: 0,
        paperRef: '',
      });
    } else {
      showToast(`Error recording paper entry: ${res.error || 'Failed'}`);
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Enter From Paper Records</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Catch up offline paper clipboard tally sheets when power or connectivity is restored
        </p>
      </div>

      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-700 font-bold hover:underline">Dismiss</button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileEdit className="w-4 h-4 text-primary" />
            Paper Tally Entry Form
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Customer First Name</label>
                <input
                  type="text"
                  placeholder="e.g. Juliet"
                  className="w-full text-xs border rounded-lg p-2.5"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Customer Phone Number</label>
                <input
                  type="text"
                  placeholder="+256772000000"
                  className="w-full text-xs tabular-nums border rounded-lg p-2.5"
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Service & Variant Performed</label>
              <select
                className="w-full text-xs border rounded-lg p-2.5"
                value={form.variantId}
                onChange={(e) => handleVariantChange(e.target.value)}
                required
              >
                <option value="">Select completed service variant...</option>
                {catalogue.map(item => (
                  <optgroup key={item.id} label={`${item.category} • ${item.name}`}>
                    {item.variants.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({formatUgx(v.list_price_ugx)})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Stylist / Performer</label>
                <select
                  className="w-full text-xs border rounded-lg p-2.5"
                  value={form.staffUserId}
                  onChange={(e) => setForm({ ...form, staffUserId: e.target.value })}
                >
                  <option value="">Unspecified / Pool Stylist</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.display_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Cash Paid (UGX)</label>
                <input
                  type="number"
                  className="w-full text-xs tabular-nums border rounded-lg p-2.5 font-bold"
                  value={form.amountUgx}
                  onChange={(e) => setForm({ ...form, amountUgx: Number(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Paper Sheet Sequence / Reference</label>
              <input
                type="text"
                placeholder="e.g. SHEET-A-ROW-04"
                className="w-full text-xs border rounded-lg p-2.5"
                value={form.paperRef}
                onChange={(e) => setForm({ ...form, paperRef: e.target.value })}
                required
              />
              <span className="text-[11px] text-muted-foreground block mt-1">
                Enables two-way cross checking between physical clipboard paper receipts and digital records.
              </span>
            </div>

            <div className="pt-2">
              <Button type="submit" className="w-full bg-primary text-white text-xs h-9" disabled={submitting || loading}>
                {submitting ? 'Recording Paper Visit...' : 'Record Paper Catchup Visit'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
