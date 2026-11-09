'use client';

import { showToast } from '@/shared/lib/toast';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  getCustomersAction,
  mergeCustomersAction,
  setCustomerTierAction,
  type ManagerCustomerItem,
} from '../controllers/manager-nav.actions';
import { UserCheck, GitMerge, Search, Phone, Calendar, CheckCircle2, Download, Star, Filter } from 'lucide-react';

export function ManagerCustomersView() {
  const [customers, setCustomers] = useState<ManagerCustomerItem[]>([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'premium' | 'regular'>('all');
  const [loading, setLoading] = useState(true);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [sourceCustomer, setSourceCustomer] = useState<ManagerCustomerItem | null>(null);
  const [targetCustomerId, setTargetCustomerId] = useState('');
  const [mergeReason, setMergeReason] = useState('');
  const [tierModalCustomer, setTierModalCustomer] = useState<ManagerCustomerItem | null>(null);
  const [tierReason, setTierReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadCustomers = async () => {
    setLoading(true);
    const res = await getCustomersAction();
    if (res.success && res.data) {
      setCustomers(res.data);
    }
    setLoading(false);
  };
  useSalonLiveRefresh(() => { void loadCustomers(); }, true, ['customer', 'app_setting']);


  useEffect(() => {
    loadCustomers();
  }, []);

  const handleTierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tierModalCustomer || !tierReason.trim()) return;

    setProcessing(true);
    const targetTier = tierModalCustomer.tier === 'premium' ? 'regular' : 'premium';
    const res = await setCustomerTierAction(tierModalCustomer.id, targetTier, tierReason);
    if (res.success) {
      setFeedback(`Successfully updated ${tierModalCustomer.first_name} to ${targetTier.toUpperCase()} tier.`);
      setTierModalCustomer(null);
      setTierReason('');
      loadCustomers();
    } else {
      showToast(`Error updating tier: ${res.error || 'Failed'}`);
    }
    setProcessing(false);
  };

  const premiumCount = customers.filter(c => c.tier === 'premium').length;

  const filtered = customers.filter(c => {
    const matchesSearch =
      c.first_name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone_e164.includes(search);
    if (!matchesSearch) return false;
    if (tierFilter === 'premium') return c.tier === 'premium';
    if (tierFilter === 'regular') return c.tier !== 'premium';
    return true;
  });

  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceCustomer || !targetCustomerId || !mergeReason.trim()) return;

    setProcessing(true);
    const res = await mergeCustomersAction(sourceCustomer.id, targetCustomerId, mergeReason);
    if (res.success) {
      setFeedback(`Successfully merged customer record into target profile.`);
      setMergeModalOpen(false);
      setSourceCustomer(null);
      setTargetCustomerId('');
      setMergeReason('');
      loadCustomers();
    } else {
      showToast(`Error merging customers: ${res.error || 'Failed'}`);
    }
    setProcessing(false);
  };

  const exportPdfReport = () => {
    showToast('Generating customer registry PDF summary export for local download...');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Customer Directory & Merge Control</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Client profiles, audit merge duplicates, and export customer summaries (No messaging consent tracking)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportPdfReport} className="text-xs h-8">
            <Download className="w-3.5 h-3.5 mr-1" />
            Export Customer PDF
          </Button>
          <Button variant="outline" size="sm" onClick={loadCustomers} disabled={loading} className="text-xs h-8">
            Refresh
          </Button>
        </div>
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by first name or phone number..."
            className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tier Filter Toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs border border-slate-200">
          <button
            type="button"
            onClick={() => setTierFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              tierFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setTierFilter('premium')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 ${
              tierFilter === 'premium'
                ? 'bg-white text-[#1F4FD8] shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Star className="w-3 h-3 text-[#1F4FD8]" />
            Premium ({premiumCount})
          </button>
          <button
            type="button"
            onClick={() => setTierFilter('regular')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              tierFilter === 'regular'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Regular ({customers.length - premiumCount})
          </button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            Customer Profiles ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading customer profiles...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No matching customer records found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/40">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900">{c.first_name}</span>
                      <span className="tabular-nums text-xs text-slate-700">{c.phone_e164}</span>
                      {c.tier === 'premium' && (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1F4FD8]/10 text-[#1F4FD8] border border-[#1F4FD8]/25 flex items-center gap-1"
                          title={c.premium_reason ? `Reason: ${c.premium_reason}` : 'Premium Customer'}
                        >
                          <Star className="w-2.5 h-2.5" />
                          Premium
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>Registered: {new Date(c.created_at).toLocaleDateString()}</span>
                      {c.premium_since && (
                        <span>• Premium since: {new Date(c.premium_since).toLocaleDateString()}</span>
                      )}
                      <span>• Privacy Notice: Verbal at counter (No SMS)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className={`text-xs h-8 font-medium ${
                        c.tier === 'premium'
                          ? 'border-amber-200 text-amber-800 hover:bg-amber-50'
                          : 'border-[#1F4FD8]/40 text-[#1F4FD8] hover:bg-[#1F4FD8]/10'
                      }`}
                      onClick={() => {
                        setTierModalCustomer(c);
                        setTierReason(c.premium_reason || '');
                      }}
                    >
                      <Star className="w-3.5 h-3.5 mr-1 text-[#1F4FD8]" />
                      {c.tier === 'premium' ? 'Unmark Premium' : 'Mark Premium'}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-medium"
                      onClick={() => {
                        setSourceCustomer(c);
                        setMergeModalOpen(true);
                      }}
                    >
                      <GitMerge className="w-3.5 h-3.5 mr-1" />
                      Merge Record
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Tier Override Modal */}
      {tierModalCustomer && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {tierModalCustomer.tier === 'premium' ? 'Unmark Premium Status' : 'Mark as Premium Customer'}
            </h3>
            <p className="text-xs text-muted-foreground">
              Customer: <strong>{tierModalCustomer.first_name} ({tierModalCustomer.phone_e164})</strong>.
              {tierModalCustomer.tier === 'premium'
                ? ' This will revert the customer profile to regular tier. Action will be audited.'
                : ' Premium tier gives priority customer recognition at reception. A justification reason is required for audit.'}
            </p>

            <form onSubmit={handleTierSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Reason for {tierModalCustomer.tier === 'premium' ? 'Unmarking' : 'Marking as Premium'}
                </label>
                <textarea
                  rows={2}
                  className="w-full text-sm border rounded-lg p-2"
                  placeholder={
                    tierModalCustomer.tier === 'premium'
                      ? 'e.g. Requested downgrade or standard tier adjustment'
                      : 'e.g. VIP client, high spend loyalty, corporate partner'
                  }
                  value={tierReason}
                  onChange={(e) => setTierReason(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setTierModalCustomer(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#1F4FD8] hover:bg-[#836840] text-white font-semibold"
                  disabled={processing}
                >
                  {processing ? 'Saving...' : 'Confirm Tier Change'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergeModalOpen && sourceCustomer && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Merge Duplicate Customer</h3>
            <p className="text-xs text-muted-foreground">
              Source Record: <strong>{sourceCustomer.first_name} ({sourceCustomer.phone_e164})</strong>. All visit history, payments, and appointments will be consolidated into the surviving profile.
            </p>

            <form onSubmit={handleMergeSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Surviving (Target) Customer</label>
                <select
                  className="w-full text-sm border rounded-lg p-2"
                  value={targetCustomerId}
                  onChange={(e) => setTargetCustomerId(e.target.value)}
                  required
                >
                  <option value="">Select target customer...</option>
                  {customers.filter(c => c.id !== sourceCustomer.id).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} ({c.phone_e164})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Reason for Merge</label>
                <textarea
                  rows={2}
                  className="w-full text-sm border rounded-lg p-2"
                  placeholder="e.g. Customer registered with alternate phone prefix during walk-in"
                  value={mergeReason}
                  onChange={(e) => setMergeReason(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setMergeModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold" disabled={processing}>
                  {processing ? 'Merging...' : 'Confirm Consolidation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
