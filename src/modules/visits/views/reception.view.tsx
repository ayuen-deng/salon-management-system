'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { formatUGX } from '@/shared/models/money';
import { fetchCatalogueAction, ServiceItem, ServiceVariant } from '@/modules/catalogue';
import { lookupCustomerByPhoneAction, createCustomerAction, CustomerProfile } from '@/modules/customers';
import { getLiveQueueAction, VisitRecord } from '@/modules/visits';

export function ReceptionView() {
  const [phone, setPhone] = useState('0772123456');
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [catalogue, setCatalogue] = useState<ServiceItem[]>([]);
  const [basket, setBasket] = useState<ServiceVariant[]>([]);
  const [queue, setQueue] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadQueue, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const catRes = await fetchCatalogueAction();
    if (catRes.success) setCatalogue(catRes.data);
    await loadQueue();
  }

  async function loadQueue() {
    const qRes = await getLiveQueueAction();
    if (qRes.success) setQueue(qRes.data);
  }
  useSalonLiveRefresh(() => { void loadQueue(); });


  async function handlePhoneSearch() {
    setLoading(true);
    setStatusMsg('');
    const res = await lookupCustomerByPhoneAction(phone);
    if (res.success && res.data.length > 0) {
      setCustomer(res.data[0]);
      setStatusMsg(`Customer found: ${res.data[0].first_name}`);
    } else {
      setCustomer(null);
      setStatusMsg('New customer. Will register on confirmation.');
    }
    setLoading(false);
  }

  function addToBasket(variant: ServiceVariant) {
    setBasket((prev) => [...prev, variant]);
  }

  function removeFromBasket(index: number) {
    setBasket((prev) => prev.filter((_, i) => i !== index));
  }

  const totalListUgx = basket.reduce((sum, item) => sum + item.list_price_ugx, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 max-w-7xl mx-auto">
      {/* LEFT: Visit Builder */}
      <div className="lg:col-span-7 space-y-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-xl font-bold text-slate-800">1. Customer Identification</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone (07xx or +256)"
                className="flex-1 px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <Button onClick={handlePhoneSearch} disabled={loading} size="sm">
                Lookup
              </Button>
            </div>
            {statusMsg && <p className="text-xs text-slate-600 font-medium">{statusMsg}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-xl font-bold text-slate-800">2. Service Selection</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {catalogue.map((service) => (
              <div key={service.id} className="border rounded-md p-3 bg-slate-50/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-sm text-slate-800">{service.name}</span>
                  <span className="text-xs text-muted-foreground">{service.category}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {service.variants?.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => addToBasket(v)}
                      className="text-left p-2 rounded border bg-white hover:border-primary/60 transition-all text-xs flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium text-slate-900">{v.name}</div>
                        <div className="text-slate-500">{v.expected_minutes} mins</div>
                      </div>
                      <span className="font-semibold text-slate-700">{formatUGX(v.list_price_ugx)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* BASKET & CONFIRM */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 border-b flex justify-between flex-row items-center">
            <CardTitle className="text-lg font-bold text-slate-800">Selected Services ({basket.length})</CardTitle>
            <span className="text-lg font-bold text-primary">{formatUGX(totalListUgx)}</span>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {basket.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No services selected.</p>
            ) : (
              basket.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-dashed">
                  <span>{item.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatUGX(item.list_price_ugx)}</span>
                    <button onClick={() => removeFromBasket(idx)} className="text-destructive hover:underline text-xs">
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
            <Button className="w-full mt-4" disabled={basket.length === 0} size="lg">
              Confirm Visit & Issue Ticket
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT: Live Queue & Checkout */}
      <div className="lg:col-span-5 space-y-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-bold text-slate-800">Live Queue</CardTitle>
            <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full font-medium">
              {queue.length} Active
            </span>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {queue.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Queue is clear.</p>
            ) : (
              queue.map((q) => (
                <div key={q.id} className="p-3 border rounded-lg bg-white shadow-xs flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-slate-900">{q.ticket_code}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 font-medium capitalize">
                        {q.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {q.services?.length || 0} service line(s) • Total: {formatUGX(q.total_final_ugx)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
