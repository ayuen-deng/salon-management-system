'use client';

import { showToast } from '@/shared/lib/toast';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  getTabletDraftAction,
  pushTabletCategoryAction,
  revokeTabletDeviceAction,
  TabletDraftSession,
} from '../controllers/reception.actions';
import { getCatalogueAction, CatalogueServiceItem } from '@/modules/catalogue';
import {
  Tablet,
  CheckCircle2,
  AlertTriangle,
  Send,
  RotateCcw,
  ShieldAlert,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { formatUGX } from '@/shared/models/money';

export function ReceptionCustomerTabletView() {
  const [session, setSession] = useState<TabletDraftSession | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueServiceItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [revoking, setRevoking] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const device = {
    id: '61992ced-5cca-4077-b1e4-6466bf25f044',
    name: 'Reception Desk Tablet (Galaxy Tab A)',
    pairedAt: 'Today at 08:30 AM',
    pairedBy: 'Joan Tumusiime (Manager)',
    status: 'online',
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadSession, 3000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const catRes = await getCatalogueAction();
    if (catRes.success) {
      setCatalogue(catRes.data.services);
      if (catRes.data.services.length > 0) {
        setSelectedCategory(catRes.data.services[0].category);
      }
    }
    await loadSession();
  }

  async function loadSession() {
    const res = await getTabletDraftAction();
    if (res.success) {
      setSession(res.data);
    }
  }
  useSalonLiveRefresh(() => { void loadSession(); });


  async function handlePushCategory() {
    if (!selectedCategory) return;
    await pushTabletCategoryAction(selectedCategory);
    showToast(`Category "${selectedCategory}" pushed to customer tablet screen.`);
  }

  async function handleClearTablet() {
    await pushTabletCategoryAction(null);
    showToast('Customer tablet reset to standard menu view.');
  }

  async function handleRevokeDevice() {
    setRevoking(true);
    await revokeTabletDeviceAction(device.id);
    setShowRevokeConfirm(false);
    setRevoking(false);
    showToast('Tablet device session revoked. The tablet will be blocked until manager repairs.');
  }

  const categories = Array.from(new Set(catalogue.map((s) => s.category)));

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* 1. Pairing Status & Demo Mode Auto-Pair Card */}
      <Card className="border border-[#EDEFF3] shadow-xs rounded-2xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-[#EDEFF3] py-4 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <Tablet className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Paired Customer Tablet Device
              </CardTitle>
              <p className="text-xs text-muted-foreground">{device.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Connected & Active
            </span>
            {/* Single Laptop Demo Helper Button */}
            <a
              href="/desk"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Customer View in New Window
            </a>
          </div>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[10px]  font-bold text-slate-400 tracking-normal">Device ID</span>
            <div className="tabular-nums font-bold text-slate-800">{device.id.slice(0, 18)}...</div>
            <div className="text-[11px] text-slate-500">Galaxy Tab A • Reception Desk</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[10px]  font-bold text-slate-400 tracking-normal">Authorization</span>
            <div className="font-bold text-slate-800">{device.pairedBy}</div>
            <div className="text-[11px] text-slate-500">Pairing authority: Manager only</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col justify-between">
            <div>
              <span className="text-[10px]  font-bold text-slate-400 tracking-normal">Security Control</span>
              <div className="text-[11px] text-slate-600 mt-1">If tablet is missing or compromised:</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRevokeConfirm(true)}
              className="border-rose-200 text-rose-600 hover:bg-rose-50 font-bold mt-2 h-7"
            >
              Revoke Device Access
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Tablet Remote Control: Push Category & Reset */}
      <Card className="border border-[#EDEFF3] shadow-xs rounded-2xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-[#EDEFF3] py-4 px-6">
          <CardTitle className="text-base font-bold text-slate-900">Show Options on Tablet</CardTitle>
          <p className="text-xs text-muted-foreground">
            Highlight a specific service catalogue category on the customer tablet screen
          </p>
        </CardHeader>
        <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                Category: {c}
              </option>
            ))}
          </select>
          <Button onClick={handlePushCategory} size="sm" className="bg-primary text-white font-bold gap-2">
            <Send className="w-3.5 h-3.5" /> Push Category to Tablet
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearTablet} className="font-semibold gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Clear / Reset Menu
          </Button>
        </CardContent>
      </Card>

      {/* 3. Live Mirror of the Tablet View */}
      <Card className="border border-[#EDEFF3] shadow-xs rounded-2xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-[#EDEFF3] py-4 px-6 flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">Live Customer Tablet Mirror</CardTitle>
            <p className="text-xs text-muted-foreground">
              What the customer is currently seeing and touching on the counter tablet
            </p>
          </div>
          <span className="text-xs tabular-nums font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded ">
            Mode: {session?.mode || 'menu'}
          </span>
        </CardHeader>
        <CardContent className="p-6">
          <div className="max-w-2xl mx-auto border-4 border-slate-800 rounded-3xl p-6 bg-slate-900 text-white shadow-xl min-h-[300px] flex flex-col justify-between">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <span className="text-sm font-bold text-slate-300">Mzuri Unisex Salon</span>
              <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400">Tablet Mirror (Desk 1)</span>
            </div>

            <div className="py-8 text-center space-y-4">
              {session?.mode === 'confirm' ? (
                <div>
                  <div className="text-xs  tracking-normal text-amber-400 font-bold mb-2">
                    Customer Confirming Phone:
                  </div>
                  <div className="text-3xl tabular-nums font-black text-white tracking-normal">
                    {session.phone_confirm || '0772 123 456'}
                  </div>
                  <div className="mt-4 text-xs text-slate-400">
                    {session.selected_variants?.length || 0} services selected • Ready to issue ticket
                  </div>
                </div>
              ) : session?.mode === 'select' ? (
                <div>
                  <div className="text-xs  tracking-normal text-primary font-bold mb-2">
                    Customer Selecting Services
                  </div>
                  <div className="text-xl font-bold text-white">
                    {session.selected_variants?.length || 0} Services in Basket
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xs  tracking-normal text-slate-400 font-bold mb-2">
                    Standard Menu Browsing Mode
                  </div>
                  <p className="text-sm text-slate-300 max-w-sm mx-auto">
                    Customer is browsing services. Tap items on the tablet to begin a visit.
                  </p>
                </div>
              )}
            </div>

            <div className="text-center text-[10px] text-slate-500 pt-4 border-t border-slate-800">
              Live updates every 3 seconds • Auto-resets after 60s idle
            </div>
          </div>
        </CardContent>
      </Card>

      {/* REVOKE DEVICE CONFIRMATION MODAL */}
      {showRevokeConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">Revoke Tablet Device Access?</h3>
            </div>
            <p className="text-xs text-slate-600">
              This action will instantly disconnect the customer tablet from the salon network. Only the manager
              (Joan) can re-pair it using a new one-time device code.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowRevokeConfirm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={revoking}
                onClick={handleRevokeDevice}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {revoking ? 'Revoking...' : 'Confirm Revocation'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
