'use client';

import { showConfirm } from '@/shared/lib/toast';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  Shield,
  KeyRound,
  UserX,
  AlertTriangle,
  Tablet,
  CheckCircle2,
  AlertCircle,
  X,
  Undo2,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import {
  getStaffDirectoryAction,
  getPendingManagerRevocationsAction,
  decideManagerRevocationAction,
  resetPinAction,
  revokeDeviceAction,
  getPairedDevicesAction,
  type HrStaffMember,
  type HrPendingRevocationItem,
  type HrPairedDeviceItem,
} from '../controllers/hr.actions';
import { openCredentialSlip } from '@/shared/views/ui/credential-slip-actions';

export function HrAccessView() {
  const [staff, setStaff] = useState<HrStaffMember[]>([]);
  const [revocations, setRevocations] = useState<HrPendingRevocationItem[]>([]);
  const [devices, setDevices] = useState<HrPairedDeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals / Inputs
  const [resetPinResult, setResetPinResult] = useState<{ newPin: string; userName: string; username: string; role: string } | null>(null);
  const [confirmingRevocation, setConfirmingRevocation] = useState<{ item: HrPendingRevocationItem; decision: 'confirm' | 'reverse' } | null>(null);
  const [revocationReason, setRevocationReason] = useState('');
  const [revokingDevice, setRevokingDevice] = useState<HrPairedDeviceItem | null>(null);
  const [deviceReason, setDeviceReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    const [staffRes, revRes, devRes] = await Promise.all([
      getStaffDirectoryAction(),
      getPendingManagerRevocationsAction(),
      getPairedDevicesAction(),
    ]);

    if (staffRes.success && staffRes.data) setStaff(staffRes.data);
    if (revRes.success && revRes.data) setRevocations(revRes.data);
    if (devRes.success && devRes.data) setDevices(devRes.data);
    setLoading(false);
  };
  useSalonLiveRefresh(() => { void loadData(); }, true, ['app_user', 'staff_skill', 'service', 'app_setting', 'audit_log', 'device']);


  useEffect(() => {
    loadData();
  }, []);

  const handleResetPin = async (userId: string, userName: string) => {
    if (!await showConfirm(`Generate a new 6-digit PIN for ${userName}? The previous PIN will stop working immediately.`)) {
      return;
    }
    setResettingUserId(userId);
    setFeedback(null);
    try {
      const res = await resetPinAction({ userId });
      if (res.success && res.data) {
        const target = staff.find((member) => member.id === userId);
        setResetPinResult({ newPin: res.data.newPin, userName: res.data.userName, username: target?.username || '', role: target?.role || 'staff' });
        setFeedback({ type: 'success', message: `PIN reset successfully for ${userName}.` });
      } else if (!res.success) {
        setFeedback({ type: 'error', message: res.error?.message || 'Failed to reset PIN.' });
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Failed to reset PIN.' });
    } finally {
      setResettingUserId(null);
    }
  };

  const handleDecideRevocation = async () => {
    if (!confirmingRevocation) return;
    const res = await decideManagerRevocationAction({
      userId: confirmingRevocation.item.revoked_user_id,
      decision: confirmingRevocation.decision,
      reason: revocationReason,
    });

    if (res.success) {
      setFeedback({
        type: 'success',
        message:
          confirmingRevocation.decision === 'confirm'
            ? `Revocation confirmed for ${confirmingRevocation.item.revoked_user_name}. Account remains deactivated.`
            : `Revocation reversed for ${confirmingRevocation.item.revoked_user_name}. Account restored to active status.`,
      });
      setConfirmingRevocation(null);
      setRevocationReason('');
      loadData();
    } else if (!res.success) {
      setFeedback({ type: 'error', message: res.error?.message || 'Failed to process revocation.' });
    }
  };

  const handleRevokeDevice = async () => {
    if (!revokingDevice) return;
    const res = await revokeDeviceAction({
      deviceId: revokingDevice.id,
      reason: deviceReason,
    });

    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Device "${revokingDevice.name}" authorization revoked immediately.`,
      });
      setRevokingDevice(null);
      setDeviceReason('');
      loadData();
    } else if (!res.success) {
      setFeedback({ type: 'error', message: res.error?.message || 'Failed to revoke device.' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Access & Security Governance</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            PIN resets, manager emergency revocation reviews, and paired device lifecycle management
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="text-xs h-8">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {resetPinResult && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={async () => {
            await navigator.clipboard.writeText(`Username: ${resetPinResult.username}\nTemporary PIN: ${resetPinResult.newPin}`);
            setFeedback({ type: 'success', message: 'Temporary credentials copied. Share them privately.' });
          }}>Copy credentials</Button>
          <Button size="sm" variant="outline" onClick={() => {
            const opened = openCredentialSlip({ fullName: resetPinResult.userName, role: resetPinResult.role, username: resetPinResult.username, pin: resetPinResult.newPin });
            if (!opened) setFeedback({ type: 'error', message: 'Allow the print window to open, then try again.' });
          }}>Print credentials slip</Button>
        </div>
      )}

      {/* NEW PIN MODAL / BANNER */}
      {resetPinResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-emerald-950  tracking-wide">
                Security PIN Reset — New 6-Digit PIN
              </span>
            </div>
            <button onClick={() => setResetPinResult(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-emerald-800">
            A new PIN has been generated for <strong className="font-semibold">{resetPinResult.userName}</strong>. The old PIN was invalidated immediately.
          </p>
          <div className="p-3 bg-white border border-emerald-200 rounded-lg inline-block tabular-nums text-2xl font-black text-emerald-800 tracking-normal">
            {resetPinResult.newPin}
          </div>
        </div>
      )}

      {/* 1. MANAGER REVOCATIONS AWAITING HR CONFIRMATION */}
      <Card className="border-amber-200 shadow-xs">
        <CardHeader className="py-3 px-5 border-b border-amber-200 bg-amber-50/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <CardTitle className="text-sm font-bold text-amber-950">
                Manager Revocations Awaiting Confirmation
              </CardTitle>
            </div>
            <span className="text-[11px] font-semibold text-amber-800">
              {revocations.length} pending review
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {revocations.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No emergency revocations pending confirmation from the salon manager.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {revocations.map((rev) => (
                <div key={rev.audit_id} className="p-4 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{rev.revoked_user_name}</span>
                      <span className="text-[11px] text-slate-400">• Revoked by {rev.revoked_by_name} ({rev.revoked_by_role})</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Reason: <span className="italic font-medium">&ldquo;{rev.reason}&rdquo;</span>
                    </p>
                    <div className="text-[10px] text-slate-400 tabular-nums">
                      Timestamp: {new Date(rev.at).toLocaleString('en-GB')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      onClick={() => setConfirmingRevocation({ item: rev, decision: 'reverse' })}
                    >
                      <Undo2 className="w-3.5 h-3.5 mr-1" />
                      Reverse (Restore Access)
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                      onClick={() => setConfirmingRevocation({ item: rev, decision: 'confirm' })}
                    >
                      <UserX className="w-3.5 h-3.5 mr-1" />
                      Confirm (Keep Revoked)
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. USER ACCESS & PIN MANAGEMENT */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-slate-600" />
            <CardTitle className="text-sm font-bold text-slate-900">Credential & PIN Management</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold  tracking-normal text-[10px]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Access Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((s) => {
                  const isProtected = s.role === 'owner' || s.role === 'hr';
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{s.full_name}</td>
                      <td className="py-3 px-4  text-[10px] font-semibold text-slate-500">{s.role}</td>
                      <td className="py-3 px-4 tabular-nums text-slate-700">{s.username}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {s.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isProtected ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-[11px]"
                              onClick={() => handleResetPin(s.id, s.full_name)}
                              disabled={resettingUserId !== null}
                            >
                              {resettingUserId === s.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <KeyRound className="w-3.5 h-3.5 mr-1 text-amber-600" />}
                              {resettingUserId === s.id ? 'Resetting…' : 'Reset PIN'}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Self / Owner protected</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 3. PAIRED DEVICES (QUEUE SCREENS & CUSTOMER TABLETS) */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tablet className="w-4 h-4 text-slate-600" />
              <CardTitle className="text-sm font-bold text-slate-900">Paired Hardware & Devices</CardTitle>
            </div>
            <span className="text-[11px] text-slate-400 italic">
              HR can revoke lost or stolen devices (Pairing codes are generated exclusively by Manager)
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {devices.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No paired hardware devices found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {devices.map((d) => (
                <div key={d.id} className="p-4 hover:bg-slate-50/60 transition-colors flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{d.name}</span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]  font-semibold border border-slate-200">
                        {d.kind}
                      </span>
                      {d.revoked_at ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[10px] font-bold">
                          REVOKED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                          AUTHORIZED
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Paired on {new Date(d.created_at).toLocaleDateString('en-GB')}{' '}
                      {d.paired_by_name && `by ${d.paired_by_name}`}
                      {d.revoked_at && ` • Revoked on ${new Date(d.revoked_at).toLocaleDateString('en-GB')}`}
                    </div>
                  </div>

                  {!d.revoked_at && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-[11px] text-rose-600 border-rose-200 hover:bg-rose-50"
                      onClick={() => {
                        setRevokingDevice(d);
                        setDeviceReason('');
                      }}
                    >
                      Revoke Device Access
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DECIDE REVOCATION MODAL */}
      {confirmingRevocation && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {confirmingRevocation.decision === 'confirm' ? 'Confirm Manager Revocation' : 'Reverse Manager Revocation'}
              </h3>
              <button onClick={() => setConfirmingRevocation(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                {confirmingRevocation.decision === 'confirm' ? (
                  <>
                    Confirming will permanently keep <strong className="font-semibold text-slate-900">{confirmingRevocation.item.revoked_user_name}</strong> in deactivated status.
                  </>
                ) : (
                  <>
                    Reversing will restore <strong className="font-semibold text-slate-900">{confirmingRevocation.item.revoked_user_name}</strong> to active salon access immediately.
                  </>
                )}
              </p>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason Code (Mandatory)</label>
                <textarea
                  required
                  rows={2}
                  placeholder="State the justification for this HR determination..."
                  value={revocationReason}
                  onChange={(e) => setRevocationReason(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmingRevocation(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleDecideRevocation}
                  className={`font-semibold text-white ${
                    confirmingRevocation.decision === 'confirm' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {confirmingRevocation.decision === 'confirm' ? 'Confirm Deactivation' : 'Restore Access'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVOKE DEVICE MODAL */}
      {revokingDevice && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Revoke Hardware Device</h3>
              <button onClick={() => setRevokingDevice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Are you sure you want to revoke authorization for <strong className="font-semibold text-slate-900">&ldquo;{revokingDevice.name}&rdquo;</strong>? The device will immediately lose salon connection.
              </p>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason for Revocation</label>
                <input
                  type="text"
                  placeholder="e.g. Lost tablet, device replaced, security check..."
                  value={deviceReason}
                  onChange={(e) => setDeviceReason(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setRevokingDevice(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleRevokeDevice} className="bg-rose-600 hover:bg-rose-700 text-white font-semibold">
                  Revoke Device Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
