'use client';

import { showToast } from '@/shared/lib/toast';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  getCatalogueAction,
  updateVariantPriceAction,
  type ManagerCatalogueItem,
  type ManagerCatalogueVariant,
} from '../controllers/manager-nav.actions';
import { formatUgx } from '@/shared/models/money';
import { Tag, Edit2, Download, Upload, CheckCircle2 } from 'lucide-react';

export function ManagerCatalogueView() {
  const [catalogue, setCatalogue] = useState<ManagerCatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingVariant, setEditingVariant] = useState<{ variant: ManagerCatalogueVariant; serviceName: string } | null>(null);
  const [editPriceForm, setEditPriceForm] = useState({ listPrice: 0, minPrice: 0, maxPrice: 0, reason: '' });
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadCatalogue = async () => {
    setLoading(true);
    const res = await getCatalogueAction();
    if (res.success && res.data) {
      setCatalogue(res.data);
    }
    setLoading(false);
  };
  useSalonLiveRefresh(() => { void loadCatalogue(); }, true, ['service', 'service_variant']);


  useEffect(() => {
    loadCatalogue();
  }, []);

  const openEditModal = (v: ManagerCatalogueVariant, serviceName: string) => {
    setEditingVariant({ variant: v, serviceName });
    setEditPriceForm({
      listPrice: v.list_price_ugx,
      minPrice: v.min_price_ugx,
      maxPrice: v.max_price_ugx,
      reason: '',
    });
  };

  const handlePriceUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVariant) return;
    if (!editPriceForm.reason.trim()) {
      showToast('Please provide a reason for the price update.');
      return;
    }

    setUpdating(true);
    const res = await updateVariantPriceAction(
      editingVariant.variant.id,
      editPriceForm.listPrice,
      editPriceForm.minPrice,
      editPriceForm.maxPrice,
      editPriceForm.reason
    );

    if (res.success) {
      setFeedback(`Price updated for ${editingVariant.variant.name} to ${formatUgx(editPriceForm.listPrice)}`);
      setEditingVariant(null);
      loadCatalogue();
    } else {
      showToast(`Error updating price: ${res.error || 'Failed'}`);
    }
    setUpdating(false);
  };

  const exportCsv = () => {
    const rows = [['Category', 'Service Name', 'Variant Name', 'List Price UGX', 'Min Price UGX', 'Max Price UGX', 'Minutes']];
    catalogue.forEach(item => {
      item.variants.forEach(v => {
        rows.push([item.category, item.name, v.name, v.list_price_ugx.toString(), v.min_price_ugx.toString(), v.max_price_ugx.toString(), v.expected_minutes.toString()]);
      });
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `catalogue_prices_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Catalogue & Price Schedules</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active salon service directory, duration estimates, price bands, and inline CSV management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="text-xs h-8">
            <Download className="w-3.5 h-3.5 mr-1" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={loadCatalogue} disabled={loading} className="text-xs h-8">
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

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-xs text-muted-foreground">Loading service catalogue...</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {catalogue.map((service) => (
            <Card key={service.id} className="overflow-hidden">
              <CardHeader className="bg-slate-50/70 py-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700  tracking-normal">
                      {service.category}
                    </span>
                    <CardTitle className="text-sm font-bold text-slate-900">{service.name}</CardTitle>
                  </div>
                  <span className="text-xs text-muted-foreground">Default: ~{service.default_minutes} mins</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {service.variants.map((v) => (
                    <div key={v.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/30">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{v.name}</span>
                          <span className="text-xs text-muted-foreground">• ~{v.expected_minutes} min duration</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          <span className="text-slate-900 font-bold">List: {formatUgx(v.list_price_ugx)}</span>
                          <span className="text-muted-foreground">Allowed Range: {formatUgx(v.min_price_ugx)} – {formatUgx(v.max_price_ugx)}</span>
                        </div>
                      </div>

                      <div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-medium"
                          onClick={() => openEditModal(v, service.name)}
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" />
                          Adjust Price
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Price Modal */}
      {editingVariant && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Adjust Price: {editingVariant.variant.name}</h3>
            <p className="text-xs text-muted-foreground">
              Parent Service: {editingVariant.serviceName}. Price changes immediately apply to all new tickets and append to price audit history.
            </p>

            <form onSubmit={handlePriceUpdate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Standard List Price (UGX)</label>
                <input
                  type="number"
                  className="w-full text-sm border rounded-lg p-2 tabular-nums"
                  value={editPriceForm.listPrice}
                  onChange={(e) => setEditPriceForm({ ...editPriceForm, listPrice: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Floor Price (UGX)</label>
                  <input
                    type="number"
                    className="w-full text-sm border rounded-lg p-2 tabular-nums"
                    value={editPriceForm.minPrice}
                    onChange={(e) => setEditPriceForm({ ...editPriceForm, minPrice: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Ceiling Price (UGX)</label>
                  <input
                    type="number"
                    className="w-full text-sm border rounded-lg p-2 tabular-nums"
                    value={editPriceForm.maxPrice}
                    onChange={(e) => setEditPriceForm({ ...editPriceForm, maxPrice: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Audit Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Seasonal price adjustment, supplier cost change"
                  className="w-full text-sm border rounded-lg p-2"
                  value={editPriceForm.reason}
                  onChange={(e) => setEditPriceForm({ ...editPriceForm, reason: e.target.value })}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingVariant(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-primary text-white" disabled={updating}>
                  {updating ? 'Saving...' : 'Save & Publish Price'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
