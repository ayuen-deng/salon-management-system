'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import { showPrompt, showToast } from '@/shared/lib/toast';
import { getKioskOrdersPageAction, cancelKioskOrderAction, type ReceptionKioskOrderListItem } from '../controllers/reception.actions';
import { formatUGX } from '@/shared/models/money';
import { Button } from '@/shared/views/ui/button';
import { Search, Loader2 } from 'lucide-react';

type KioskTab = 'waiting' | 'handling' | 'expired' | 'cancelled';
const tabs: { id: KioskTab; label: string }[] = [
  { id: 'waiting', label: 'Waiting' }, { id: 'handling', label: 'Being handled' },
  { id: 'expired', label: 'Expired' }, { id: 'cancelled', label: 'Cancelled' },
];

export function ReceptionKioskOrdersView() {
  const router = useRouter();
  const [tab, setTab] = useState<KioskTab>('waiting');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ReceptionKioskOrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<KioskTab, number | null>>({ waiting: null, handling: null, expired: null, cancelled: null });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0);
  const countGeneration = useRef(0);

  async function load(replace = true, query = search, targetTab = tab) {
    const id = ++generation.current;
    replace ? setLoading(true) : setLoadingMore(true);
    const result = await getKioskOrdersPageAction({ status: targetTab, search: query, limit: 50, offset: replace ? 0 : rows.length });
    if (id === generation.current) {
      if (result.success) {
        setRows((current) => replace ? result.data.items : [...current, ...result.data.items]);
        setTotal(result.data.total);
        setCounts((current) => ({ ...current, [targetTab]: result.data.total }));
      } else showToast(result.error.message, 'error');
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function refreshCounts(query = search) {
    const id = ++countGeneration.current;
    const results = await Promise.all(tabs.map((item) => getKioskOrdersPageAction({ status: item.id, search: query, limit: 1, offset: 0 })));
    if (id !== countGeneration.current) return;
    setCounts((current) => {
      const next = { ...current };
      results.forEach((result, index) => {
        if (result.success) next[tabs[index].id] = result.data.total;
      });
      return next;
    });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(true, search, tab); void refreshCounts(search); }, 250);
    return () => { window.clearTimeout(timer); generation.current += 1; countGeneration.current += 1; };
  }, [search, tab]);
  useSalonLiveRefresh(() => { void load(true, search, tab); void refreshCounts(search); }, true, ['kiosk_order_request', 'visit']);

  const openOrder = (row: ReceptionKioskOrderListItem) => {
    router.push(`/reception?order=${encodeURIComponent(row.id)}`);
  };

  async function markDidNotCome(row: ReceptionKioskOrderListItem) {
    const reason = await showPrompt('Choose a reason: Customer left, Changed mind, or Duplicate order');
    if (!reason) return;
    if (!['Customer left', 'Changed mind', 'Duplicate order'].includes(reason.trim())) {
      showToast('Choose Customer left, Changed mind, or Duplicate order.', 'error');
      return;
    }
    const result = await cancelKioskOrderAction(row.id, reason.trim());
    if (result.success) { showToast(`${row.order_code} marked as didn’t come.`, 'success'); void load(true); }
    else { showToast(result.error.message, 'error'); void load(true); }
  }

  return <div className="space-y-5">
    <header><h2 className="text-2xl font-bold text-slate-900">Kiosk orders</h2><p className="mt-1 text-sm text-slate-600">Unpaid tablet orders stay outside the salon queue until reception records payment.</p></header>
    <label className="flex max-w-2xl items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"><Search className="h-4 w-4 text-slate-500" /><input aria-label="Search kiosk orders" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code, first name or phone" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
    <div role="tablist" aria-label="Kiosk order status" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">{tabs.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === item.id ? 'bg-blue-700 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>{item.label}{counts[item.id] === null ? '' : ` (${counts[item.id]})`}</button>)}</div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {loading && rows.length === 0 ? <div className="space-y-3 p-4" aria-label="Loading kiosk orders">{[0,1,2].map((x) => <div key={x} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div>
        : rows.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">{tab === 'waiting' ? 'No kiosk orders waiting.' : `No ${tab === 'handling' ? 'orders being handled' : tab + ' orders'} found.`}</div>
          : <div className="divide-y divide-slate-100">{rows.map((row) => {
            const match = search.trim().toLowerCase();
            const highlight = match && `${row.order_code} ${row.first_name} ${row.phone}`.toLowerCase().includes(match);
            const age = Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 60000));
            const active = row.status === 'draft';
            return <article key={row.id} className={`flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between ${highlight ? 'bg-blue-50/70' : ''}`}>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-lg">{row.order_code}</strong><span className="font-semibold">{row.first_name}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">{row.status === 'draft' ? row.claimant_name && row.claimed_at && Date.now() - new Date(row.claimed_at).getTime() < 120000 ? `Being handled by ${row.claimant_name}` : 'Waiting' : row.status}</span><span className="text-xs text-slate-500">waiting {age} min</span></div>
                <div className="mt-1 truncate text-sm text-slate-600">{row.services.map((line) => line.variant_name).join(', ')}</div><div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500"><span>{row.phone}</span><span>Estimated total {formatUGX(row.total_ugx)}</span></div>
              </div>
              <div className="flex shrink-0 gap-2"><Button size="sm" disabled={!active} onClick={() => openOrder(row)}>Open</Button><Button size="sm" variant="outline" disabled={!active} onClick={() => void markDidNotCome(row)}>Didn’t come</Button></div>
            </article>;
          })}</div>}
      {rows.length > 0 && rows.length < total && <div className="border-t border-slate-100 p-3 text-center"><Button variant="outline" disabled={loadingMore} onClick={() => void load(false)}>{loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Load more</Button></div>}
    </div>
  </div>;
}
