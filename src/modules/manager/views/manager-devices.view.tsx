'use client';

import { showToast } from '@/shared/lib/toast';
import { showConfirm } from '@/shared/lib/toast';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  getDevicesAction,
  pairDeviceAction,
  revokeDeviceAction,
  type ManagerDeviceItem,
} from '../controllers/manager-nav.actions';
import { Tablet, Tv, ShieldAlert, CheckCircle2, Plus, QrCode } from 'lucide-react';

export function ManagerDevicesView() {
  const [devices, setDevices] = useState<ManagerDeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [pairingForm, setPairingForm] = useState({ name: '', kind: 'reception_tablet' as 'reception_tablet' | 'queue_screen' });
  const [generatedPairing, setGeneratedPairing] = useState<{ code: string; name: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadDevices = async () => {
    setLoading(true);
    const res = await getDevicesAction();
    if (res.success && res.data) {
      setDevices(res.data);
    }
    setLoading(false);
  };
  useSalonLiveRefresh(() => { void loadDevices(); }, true, ['device', 'app_user']);


  useEffect(() => {
    loadDevices();
  }, []);

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingForm.name.trim()) return;

    setProcessing(true);
    const res = await pairDeviceAction(pairingForm.name, pairingForm.kind);
    if (res.success && res.data) {
      setGeneratedPairing({ code: res.data.pairing_code, name: pairingForm.name });
      setPairingModalOpen(false);
      setPairingForm({ name: '', kind: 'reception_tablet' });
      loadDevices();
    } else {
      showToast(`Error pairing device: ${res.error || 'Failed'}`);
    }
    setProcessing(false);
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!await showConfirm(`Are you sure you want to revoke authorization for device "${name}"? It will immediately disconnect.`)) {
      return;
    }

    const res = await revokeDeviceAction(id);
    if (res.success) {
      setFeedback(`Device "${name}" has been revoked.`);
      loadDevices();
    } else {
      showToast(`Error revoking device: ${res.error || 'Failed'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Device Pairing & Hardware Security</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage authenticated salon tablets and customer lounge displays
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="bg-primary text-white text-xs h-8" onClick={() => setPairingModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Pair New Device
          </Button>
          <Button variant="outline" size="sm" onClick={loadDevices} disabled={loading} className="text-xs h-8">
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

      {/* Generated Code Display Modal */}
      {generatedPairing && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-indigo-900  tracking-normal block">Device Pairing Code Generated</span>
            <p className="text-xs text-indigo-700 mt-0.5">
              Enter this 6-digit PIN on <strong>{generatedPairing.name}</strong> to pair:
            </p>
            <div className="tabular-nums text-3xl font-black text-indigo-950 tracking-normal mt-2">
              {generatedPairing.code}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setGeneratedPairing(null)} className="border-indigo-300 text-indigo-900">
            Done
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Tablet className="w-4 h-4 text-primary" />
            Authorized Salon Hardware ({devices.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading paired devices...</div>
          ) : devices.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No paired devices found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {devices.map((d) => (
                <div key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/40">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {d.kind === 'reception_tablet' ? (
                        <Tablet className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Tv className="w-4 h-4 text-purple-600" />
                      )}
                      <span className="font-bold text-sm text-slate-900">{d.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 ">
                        {d.kind === 'reception_tablet' ? 'Reception Tablet' : 'Queue TV'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full  ${
                        d.revoked ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {d.revoked ? 'REVOKED' : 'AUTHORIZED'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Paired by: <strong>{d.paired_by_name}</strong></span>
                      <span>• Registered: {new Date(d.created_at).toLocaleDateString()}</span>
                      {d.pairing_code && (
                        <span>• Pairing PIN: <code className="tabular-nums">{d.pairing_code}</code></span>
                      )}
                    </div>
                  </div>

                  <div>
                    {!d.revoked && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 text-rose-600 border-rose-200 hover:bg-rose-50 font-medium"
                        onClick={() => handleRevoke(d.id, d.name)}
                      >
                        <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                        Revoke Access
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pair New Device Modal */}
      {pairingModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Pair New Hardware Device</h3>
            <p className="text-xs text-muted-foreground">
              Authorize a front-desk tablet or wall-mounted queue display. Generating a PIN binds the device token securely to this salon location.
            </p>

            <form onSubmit={handlePairSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Device Label / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Front Desk Tablet #2 (iPad mini)"
                  className="w-full text-sm border rounded-lg p-2"
                  value={pairingForm.name}
                  onChange={(e) => setPairingForm({ ...pairingForm, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Device Type</label>
                <select
                  className="w-full text-sm border rounded-lg p-2"
                  value={pairingForm.kind}
                  onChange={(e) => setPairingForm({ ...pairingForm, kind: e.target.value as any })}
                >
                  <option value="reception_tablet">Reception Desk Tablet</option>
                  <option value="queue_screen">Customer Queue TV Display</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setPairingModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-primary text-white" disabled={processing}>
                  {processing ? 'Generating PIN...' : 'Generate Pairing PIN'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
