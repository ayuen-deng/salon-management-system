'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  fetchOwnerSettingsAction,
  updateOwnerThresholdsAction,
  updateOwnerReceiptSettingsAction,
  appointOrReplaceHrAction,
  revokeHrAction,
} from '@/modules/dashboard-owner';
import { Shield, AlertTriangle, CheckCircle2, UserPlus, UserX } from 'lucide-react';

export function OwnerSettingsView() {
  const [settings, setSettings] = useState<{
    review_thresholds: any;
    receipt_settings: {
      salon_name: string;
      location_name: string;
      receipt_address: string;
      receipt_phone: string;
      receipt_footer: string;
      receipt_fiscal_disclaimer_enabled: boolean;
    };
    hr_appointed: boolean;
    active_hr?: {
      id: string;
      full_name: string;
      username?: string;
      phone_e164: string;
      status: string;
      created_at: string;
    } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [discountThreshold, setDiscountThreshold] = useState('10000');
  const [receiptSettings, setReceiptSettings] = useState({
    salon_name: '',
    location_name: '',
    receipt_address: '',
    receipt_phone: '',
    receipt_footer: '',
    receipt_fiscal_disclaimer_enabled: true,
  });
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [receiptSettingsError, setReceiptSettingsError] = useState<string | null>(null);

  // Modals state
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showAppointModal, setShowAppointModal] = useState(false);
  const [hrForm, setHrForm] = useState({
    fullName: '',
    phone: '',
    username: '',
    pin: '',
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ownerId = 'c0000000-0000-0000-0000-000000000001';

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    const res = await fetchOwnerSettingsAction();
    if (res.success) {
      setSettings(res.data);
      setReceiptSettings(res.data.receipt_settings);
      if (res.data.review_thresholds?.discount_ugx) {
        setDiscountThreshold(String(res.data.review_thresholds.discount_ugx));
      }
    }
    setLoading(false);
  }
  useSalonLiveRefresh(() => { void loadSettings(); }, true, ['app_setting', 'app_user']);


  async function handleSaveReceiptSettings() {
    const res = await updateOwnerReceiptSettingsAction(receiptSettings);
    if (res.success) {
      setReceiptSettingsError(null);
      setSaveNotice('Receipt settings saved. New receipts will use these values.');
      setTimeout(() => setSaveNotice(null), 3000);
    } else {
      setReceiptSettingsError(res.error.message);
    }
  }

  async function handleSaveThresholds() {
    const updated = {
      discount_ugx: parseInt(discountThreshold, 10) || 10000,
      flag_all_reopens: true,
      flag_all_voids: true,
    };
    const res = await updateOwnerThresholdsAction(updated, ownerId);
    if (res.success) {
      setSaveNotice('Review thresholds saved. Audit record generated.');
      setTimeout(() => setSaveNotice(null), 3000);
    }
  }

  async function handleConfirmRevoke() {
    setIsSubmitting(true);
    setActionError(null);
    const res = await revokeHrAction(ownerId);
    if (res.success) {
      setShowRevokeModal(false);
      setSaveNotice('HR administrator access revoked. All active sessions invalidated.');
      loadSettings();
      setTimeout(() => setSaveNotice(null), 4000);
    } else {
      setActionError(res.error.message);
    }
    setIsSubmitting(false);
  }

  async function handleConfirmAppoint(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setActionError(null);

    if (!hrForm.fullName || !hrForm.phone || !hrForm.username || !hrForm.pin) {
      setActionError('All fields including 4-digit PIN are required.');
      setIsSubmitting(false);
      return;
    }

    const res = await appointOrReplaceHrAction({
      fullName: hrForm.fullName.trim(),
      phoneE164: hrForm.phone.trim(),
      username: hrForm.username.trim().toLowerCase(),
      pin: hrForm.pin.trim(),
      ownerId,
    });

    if (res.success) {
      setShowAppointModal(false);
      setHrForm({ fullName: '', phone: '', username: '', pin: '' });
      setSaveNotice(
        settings?.hr_appointed
          ? 'HR administrator replaced atomically. Audit log written.'
          : 'HR administrator appointed successfully.'
      );
      loadSettings();
      setTimeout(() => setSaveNotice(null), 4000);
    } else {
      setActionError(res.error.message);
    }
    setIsSubmitting(false);
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="border-b border-[#EDEFF3] pb-3">
        <h2 className="text-base font-semibold text-slate-900">Owner System Settings</h2>
        <p className="text-xs text-slate-500">Root controls, review thresholds, and HR administrator credentials.</p>
      </div>

      {saveNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Review Thresholds */}
      <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">For Your Review Thresholds</h3>
          <p className="text-xs text-slate-500">
            Events matching these thresholds appear automatically on your Kampala mobile dashboard.
          </p>
        </div>

        <div className="space-y-3 pt-2 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Discounts Flagged from (UGX)
            </label>
            <input
              type="number"
              value={discountThreshold}
              onChange={(e) => setDiscountThreshold(e.target.value)}
              className="w-48 px-3 py-1.5 rounded-xl border border-[#EDEFF3] bg-white tabular-nums font-bold"
            />
          </div>

          <div className="space-y-1.5 pt-1 text-slate-600">
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>Always flag reopened business days</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>Always flag ticket voids and refunds</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>Always flag client profile PDF exports</span>
            </div>
          </div>

          <Button onClick={handleSaveThresholds} size="sm" className="bg-[#1F4FD8] hover:bg-[#1A43B8] text-white font-bold text-xs">
            Save Thresholds
          </Button>
        </div>
      </Card>

      <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Receipt details</h3>
          <p className="text-xs text-slate-500">Optional contact details stay blank until you add them. These settings apply to new receipt snapshots.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {([
            ['salon_name', 'Salon name'],
            ['location_name', 'Location'],
            ['receipt_address', 'Address'],
            ['receipt_phone', 'Phone'],
          ] as const).map(([key, label]) => (
            <label key={key} className="space-y-1">
              <span className="font-semibold text-slate-700">{label}</span>
              <input
                value={receiptSettings[key]}
                onChange={(event) => setReceiptSettings({ ...receiptSettings, [key]: event.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E2E7EF]"
              />
            </label>
          ))}
          <label className="space-y-1 sm:col-span-2">
            <span className="font-semibold text-slate-700">Footer line</span>
            <input
              value={receiptSettings.receipt_footer}
              onChange={(event) => setReceiptSettings({ ...receiptSettings, receipt_footer: event.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E2E7EF]"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={receiptSettings.receipt_fiscal_disclaimer_enabled}
            onChange={(event) => setReceiptSettings({ ...receiptSettings, receipt_fiscal_disclaimer_enabled: event.target.checked })}
          />
          Show “This is not a fiscal tax receipt”
        </label>
        {receiptSettingsError && <p role="alert" className="text-xs text-[#B42318]">{receiptSettingsError}</p>}
        <Button onClick={handleSaveReceiptSettings} size="sm" className="bg-[#1F4FD8] hover:bg-[#1A43B8] text-white font-semibold text-xs">
          Save receipt details
        </Button>
      </Card>

      {/* Root HR Account Control */}
      <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">HR account</h3>
            <p className="text-xs text-slate-500">
              The owner's root authority over people administration credentials. Exactly one active HR permitted.
            </p>
          </div>
          <span className={`text-[10px]  font-bold px-2.5 py-0.5 rounded-full self-start sm:self-auto ${
            settings?.hr_appointed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}>
            {settings?.hr_appointed ? 'HR Active' : 'No HR Appointed'}
          </span>
        </div>

        {settings?.hr_appointed && settings.active_hr ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <span className="text-slate-400 block text-[10px]  font-semibold">Administrator</span>
                <span className="font-bold text-slate-900">{settings.active_hr.full_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]  font-semibold">Username</span>
                <span className="tabular-nums text-slate-700">{settings.active_hr.username || 'hr'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]  font-semibold">Phone</span>
                <span className="tabular-nums text-slate-700">{settings.active_hr.phone_e164}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]  font-semibold">Appointed Date</span>
                <span className="text-slate-700 font-medium">
                  {new Date(settings.active_hr.created_at).toLocaleDateString('en-GB')}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRevokeModal(true)}
                className="text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
              >
                <UserX className="w-3.5 h-3.5 mr-1" />
                Revoke access
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setHrForm({ fullName: '', phone: '', username: '', pin: '' });
                  setActionError(null);
                  setShowAppointModal(true);
                }}
                className="bg-[#1F4FD8] hover:bg-[#1A43B8] text-white text-xs font-semibold"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" />
                Replace HR
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-3">
            <Shield className="w-8 h-8 text-slate-400" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-800">No HR Administrator Currently Appointed</p>
              <p className="text-[11px] text-slate-500 max-w-sm">
                The salon currently has no HR account. Rota management and staff profile corrections are disabled until an administrator is appointed.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setHrForm({ fullName: '', phone: '', username: '', pin: '' });
                setActionError(null);
                setShowAppointModal(true);
              }}
              className="bg-[#1F4FD8] hover:bg-[#1A43B8] text-white text-xs font-semibold"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1" />
              Appoint HR
            </Button>
          </div>
        )}
      </Card>

      {/* Revoke HR Confirmation Modal */}
      {showRevokeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowRevokeModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#EDEFF3] p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-100">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Revoke HR Administrator Access</h3>
                <span className="text-[11px] text-slate-500">Root authorization safeguard</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>The salon will have no HR administrator until you appoint one.</strong>
              <br />
              All active sessions for this account will end immediately. Past records and audit logs are permanently preserved.
            </p>

            {actionError && (
              <p className="p-2.5 rounded-lg bg-rose-50 text-rose-800 text-xs border border-rose-200">
                {actionError}
              </p>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRevokeModal(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmRevoke}
                disabled={isSubmitting}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
              >
                {isSubmitting ? 'Revoking...' : 'Confirm Revoke'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Appoint / Replace HR Modal */}
      {showAppointModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowAppointModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#EDEFF3] p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#EDEFF3] pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {settings?.hr_appointed ? 'Replace HR Administrator' : 'Appoint HR Administrator'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {settings?.hr_appointed
                    ? 'Atomic replacement: old HR revoked, new HR active immediately.'
                    : 'Create and activate the sole HR administrator account.'}
                </p>
              </div>
              <button
                onClick={() => setShowAppointModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAppoint} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. David Kato"
                  value={hrForm.fullName}
                  onChange={(e) => setHrForm({ ...hrForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#EDEFF3] bg-white focus:outline-none focus:border-[#1F4FD8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone (E.164)</label>
                  <input
                    type="text"
                    required
                    placeholder="+256772000003"
                    value={hrForm.phone}
                    onChange={(e) => setHrForm({ ...hrForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#EDEFF3] bg-white tabular-nums focus:outline-none focus:border-[#1F4FD8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. kato_hr"
                    value={hrForm.username}
                    onChange={(e) => setHrForm({ ...hrForm, username: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#EDEFF3] bg-white tabular-nums focus:outline-none focus:border-[#1F4FD8]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Prototype 4-Digit PIN</label>
                <input
                  type="password"
                  maxLength={6}
                  required
                  placeholder="••••"
                  value={hrForm.pin}
                  onChange={(e) => setHrForm({ ...hrForm, pin: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#EDEFF3] bg-white tabular-nums tracking-normal text-center text-sm focus:outline-none focus:border-[#1F4FD8]"
                />
              </div>

              {actionError && (
                <p className="p-2.5 rounded-lg bg-rose-50 text-rose-800 text-xs border border-rose-200">
                  {actionError}
                </p>
              )}

              <div className="pt-3 border-t border-[#EDEFF3] flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAppointModal(false)}
                  disabled={isSubmitting}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-[#1F4FD8] hover:bg-[#1A43B8] text-white text-xs font-semibold"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : settings?.hr_appointed
                    ? 'Confirm & Replace HR'
                    : 'Appoint HR'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
