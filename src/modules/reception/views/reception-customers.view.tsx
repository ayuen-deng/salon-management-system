'use client';

import { showToast } from '@/shared/lib/toast';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { formatUGX } from '@/shared/models/money';
import { formatUgPhoneDisplay, isValidUgPhone } from '@/shared/models/phone';
import {
  getCustomersListAction,
  updateCustomerFirstNameAction,
} from '../controllers/reception.actions';
import { exportCustomerProfilePdfAction } from '@/modules/customers';
import { printVisitReceipt } from '@/modules/payments';
import {
  Search,
  User,
  Phone,
  FileDown,
  Edit3,
  Check,
  X,
  Scissors,
  Calendar,
  AlertTriangle,
  Loader2,
  Users,
  Printer,
} from 'lucide-react';

export function ReceptionCustomersView() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  // Selected customer for history drawer/modal
  const [selectedCust, setSelectedCust] = useState<any | null>(null);

  // Edit first name only
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFirstNameVal, setEditFirstNameVal] = useState<string>('');
  const [isSavingName, setIsSavingName] = useState<boolean>(false);

  // PDF Exporting state
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  // Debounced live search as user types
  useEffect(() => {
    const handler = setTimeout(() => {
      startTransition(() => {
        loadCustomers(searchQuery);
      });
    }, 200);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  async function loadCustomers(q?: string) {
    setLoading(true);
    const res = await getCustomersListAction(q);
    if (res.success) {
      setCustomers(res.data);
      if (res.data.length > 0) {
        if (!selectedCust || !res.data.find((c: any) => c.id === selectedCust.id)) {
          setSelectedCust(res.data[0]);
        }
      } else {
        setSelectedCust(null);
      }
    }
    setLoading(false);
  }
  useSalonLiveRefresh(() => { void loadCustomers(searchQuery); }, true, ['customer', 'visit', 'visit_service', 'payment', 'service_variant']);


  async function handleSaveFirstName(id: string) {
    if (!editFirstNameVal.trim() || isSavingName) return;
    setIsSavingName(true);
    const res = await updateCustomerFirstNameAction(id, editFirstNameVal.trim());
    setIsSavingName(false);
    if (res.success) {
      setEditingId(null);
      await loadCustomers(searchQuery);
      if (selectedCust?.id === id) {
        setSelectedCust({ ...selectedCust, first_name: editFirstNameVal.trim() });
      }
    } else {
      showToast(res.error?.message || 'Failed to update name');
    }
  }

  async function handleExportPdf(cust: any) {
    if (exportingId) return;
    setExportingId(cust.id);
    try {
      const res = await exportCustomerProfilePdfAction(cust.id);
      if (res.success && res.data.pdfBase64) {
        // Trigger clean server-side file download
        const blob = new Blob(
          [Uint8Array.from(atob(res.data.pdfBase64), (c) => c.charCodeAt(0))],
          { type: 'application/pdf' }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (!res.success) {
        showToast(res.error?.message || 'Could not generate PDF export');
      }
    } finally {
      setExportingId(null);
    }
  }

  // Highlight matched substrings
  function renderHighlighted(text: string, query: string) {
    if (!query || !query.trim() || !text) return text;
    const cleanQ = query.trim().toLowerCase();
    const parts = text.split(new RegExp(`(${cleanQ})`, 'gi'));
    return (
      <span>
        {parts.map((p, idx) =>
          p.toLowerCase() === cleanQ ? (
            <mark key={idx} className="bg-[#1F4FD8]/20 text-[#1F4FD8] font-bold px-0.5 rounded">
              {p}
            </mark>
          ) : (
            p
          )
        )}
      </span>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0A0E14]">Customer Profiles & Visit History</h2>
          <p className="text-xs text-[#566174]">
            Live search as you type • Edit first name only • Audited PDF profile exports
          </p>
        </div>

        {/* Live Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#566174] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search phone digits or first name..."
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-[#E2E7EF] rounded-xl text-xs text-[#0A0E14] outline-none focus:ring-2 focus:ring-[#7B9BF0] focus:border-[#1F4FD8] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Two Column Layout: Customer Directory & Selected Customer History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Customer List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex justify-between items-center text-xs font-semibold text-[#566174]">
            <span>Clients ({customers.length})</span>
            {isPending && <span className="text-[10px] text-[#1F4FD8]">Filtering...</span>}
          </div>

          <div className="space-y-2.5 max-h-[650px] overflow-y-auto pr-1">
            {loading ? (
              <div className="p-8 text-center text-xs text-[#566174] animate-pulse">
                Loading clients...
              </div>
            ) : customers.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#566174] bg-white border border-[#E2E7EF] rounded-2xl">
                No customer profiles matching &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              customers.map((c) => {
                const isSelected = selectedCust?.id === c.id;
                const isEditing = editingId === c.id;
                const validUg = isValidUgPhone(c.phone_e164);
                const isShared = c.shared_count > 1;

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCust(c)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                      isSelected
                        ? 'border-[#1F4FD8] bg-[#1F4FD8]/5 shadow-xs ring-1 ring-[#1F4FD8]'
                        : 'border-[#E2E7EF] bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {isEditing ? (
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editFirstNameVal}
                            onChange={(e) => setEditFirstNameVal(e.target.value)}
                            className="px-2.5 py-1 border border-[#1F4FD8] rounded-lg text-xs font-bold w-36 outline-none"
                            placeholder="First name"
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={isSavingName}
                            onClick={() => handleSaveFirstName(c.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#0A0E14] text-sm">
                            {renderHighlighted(c.first_name, searchQuery)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(c.id);
                              setEditFirstNameVal(c.first_name);
                            }}
                            className="text-slate-400 hover:text-slate-700"
                            title="Edit first name only"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Phone Display & Badges */}
                      <div className="text-right">
                        <div className="text-xs tabular-nums font-semibold text-[#0A0E14]">
                          {renderHighlighted(formatUgPhoneDisplay(c.phone_e164), searchQuery)}
                        </div>
                        <div className="flex flex-wrap gap-1 justify-end mt-1">
                          {!validUg && (
                            <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded">
                              Check number
                            </span>
                          )}
                          {isShared && (
                            <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded flex items-center gap-1">
                              <Users className="w-2.5 h-2.5" /> Shared ({c.shared_count})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-[#566174] pt-2 border-t border-[#E2E7EF]">
                      <span className="font-medium">
                        {c.total_visits} {c.total_visits === 1 ? 'visit' : 'visits'} recorded
                      </span>
                      <span>
                        Client since{' '}
                        {new Date(c.created_at).toLocaleDateString('en-GB', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Selected Customer Visit History */}
        <div className="lg:col-span-7">
          {selectedCust ? (
            <Card className="border border-[#E2E7EF] shadow-xs rounded-2xl bg-white overflow-hidden">
              <CardHeader className="bg-[#F6F8FB] border-b border-[#E2E7EF] py-4 px-6 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#0A0E14]">
                    Visit History: {selectedCust.first_name}
                  </CardTitle>
                  <p className="text-xs text-[#566174] tabular-nums mt-0.5">
                    {formatUgPhoneDisplay(selectedCust.phone_e164)}
                  </p>
                </div>
                <Button
                  onClick={() => handleExportPdf(selectedCust)}
                  disabled={exportingId === selectedCust.id}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 font-bold text-xs bg-white border-[#E2E7EF] hover:bg-slate-50 text-[#0A0E14]"
                >
                  {exportingId === selectedCust.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating PDF...
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4 text-[#1F4FD8]" /> Export Profile (PDF)
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-3">
                  {selectedCust.visits.length === 0 ? (
                    <div className="p-12 text-center text-xs text-[#566174] border border-dashed border-[#E2E7EF] rounded-xl space-y-2">
                      <Scissors className="w-6 h-6 text-slate-300 mx-auto" />
                      <p>No visits recorded yet for this client.</p>
                    </div>
                  ) : (
                    selectedCust.visits.map((v: any) => (
                      <div
                        key={v.visit_id}
                        className="p-4 rounded-xl border border-[#E2E7EF] bg-white space-y-2 shadow-2xs"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <span className="tabular-nums font-black text-xs bg-blue-50 text-[#1F4FD8] px-2 py-0.5 rounded-lg border border-blue-200">
                              {v.ticket_code}
                            </span>
                            <span className="font-semibold text-xs text-[#0A0E14]">{v.services}</span>
                          </div>
                          <span className="font-bold text-[#0A0E14] text-xs tabular-nums">
                            {formatUGX(v.total_price_ugx)}
                          </span>
                        </div>
                        <div className="flex flex-wrap justify-between items-center text-[11px] text-[#566174] pt-2 border-t border-[#E2E7EF]">
                          <span>Date: {v.date}</span>
                          <span>
                            Receipt:{' '}
                            <strong className="text-[#0A0E14] font-semibold">{v.receipt_no}</strong>
                          </span>
                          <span>
                            Ref:{' '}
                            <strong className="text-[#0A0E14] font-semibold">{v.payment_ref}</strong>
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs"
                          onClick={async () => {
                            const result = await printVisitReceipt(v.visit_id, { duplicate: true });
                            if (!result.success) showToast(result.error?.message || 'Could not print the receipt.');
                          }}
                        >
                          <Printer className="w-3.5 h-3.5 mr-2" /> Reprint receipt
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-12 text-center text-xs text-[#566174] border-dashed border-[#E2E7EF] rounded-2xl bg-white">
              Select a customer profile to view complete historical service lines and receipt numbers.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
