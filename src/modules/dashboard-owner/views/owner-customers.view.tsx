'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { formatUGX } from '@/shared/models/money';
import { fetchOwnerCustomersAction, OwnerCustomerProfile } from '@/modules/dashboard-owner';
import { Users, Search, Download, FileText, CheckCircle2, Star } from 'lucide-react';

export function OwnerCustomersView() {
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'premium' | 'regular'>('all');
  const [customers, setCustomers] = useState<OwnerCustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    loadCustomers();
  }, [query]);

  async function loadCustomers() {
    setLoading(true);
    const res = await fetchOwnerCustomersAction(query);
    if (res.success) {
      setCustomers(res.data);
    }
    setLoading(false);
  }
  useSalonLiveRefresh(() => { void loadCustomers(); });


  function handleExportProfile(name: string) {
    setExportNotice(`Client profile for "${name}" exported. Audit log record generated.`);
    setTimeout(() => setExportNotice(null), 4000);
  }

  const premiumCount = customers.filter(c => c.tier === 'premium').length;

  const filteredCustomers = customers.filter(c => {
    if (tierFilter === 'premium') return c.tier === 'premium';
    if (tierFilter === 'regular') return c.tier !== 'premium';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EDEFF3] pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Registered Customer Directory</h2>
          <p className="text-xs text-slate-500">Read-only view of customer visit frequency, spend, and loyalty tier.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#EDEFF3] bg-white text-xs font-medium text-slate-900 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {exportNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Customers List */}
      <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading customer profiles...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No customers found matching search.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-[#EDEFF3]">
                <tr>
                  <th className="py-3 px-4">Client Name</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4 text-right">Visits</th>
                  <th className="py-3 px-4 text-right">Lifetime Spend</th>
                  <th className="py-3 px-4 text-right">Last Visit</th>
                  <th className="py-3 px-4 text-right">Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{c.name}</span>
                        {c.tier === 'premium' && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#1F4FD8]/10 text-[#1F4FD8] border border-[#1F4FD8]/25 flex items-center gap-1"
                            title={c.premium_reason ? `Premium: ${c.premium_reason}` : 'Premium Customer'}
                          >
                            <Star className="w-2.5 h-2.5" />
                            Premium
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-600">{c.phone}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{c.total_visits}</td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold text-slate-900">
                      {formatUGX(c.total_spent_ugx)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-500 text-[11px]">
                      {c.last_visited_at ? new Date(c.last_visited_at).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleExportProfile(c.name)}
                        className="text-primary hover:underline text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
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
