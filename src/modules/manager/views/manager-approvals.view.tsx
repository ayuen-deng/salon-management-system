'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { formatUGX } from '@/shared/models/money';
import {
  getApprovalRequestsAction,
  decideApprovalRequestAction,
} from '../controllers/manager-nav.actions';
import { ApprovalRequestItem } from '../models/manager-operations.repository';
import { CheckSquare, CheckCircle, XCircle, Clock, ShieldAlert } from 'lucide-react';

export function ManagerApprovalsView() {
  const [tab, setTab] = useState<'pending' | 'decided'>('pending');
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ApprovalRequestItem[]>([]);
  const [selectedReq, setSelectedReq] = useState<ApprovalRequestItem | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [declineReason, setDeclineReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [tab]);

  async function loadRequests() {
    setLoading(true);
    const res = await getApprovalRequestsAction(tab);
    if (res.success) {
      setRequests(res.data);
    }
    setLoading(false);
  }
  useSalonLiveRefresh(() => { void loadRequests(); }, true, ['approval_request', 'app_user']);


  async function handleApprove(req: ApprovalRequestItem) {
    if (submitting) return;
    setSubmitting(true);
    const approvedAmount = customAmount ? parseInt(customAmount, 10) : req.requested_discount_ugx;
    await decideApprovalRequestAction(req.id, 'approved', approvedAmount);
    setSelectedReq(null);
    setCustomAmount('');
    setSubmitting(false);
    await loadRequests();
  }

  async function handleDecline(req: ApprovalRequestItem) {
    if (submitting) return;
    setSubmitting(true);
    await decideApprovalRequestAction(
      req.id,
      'rejected',
      undefined,
      declineReason || 'Price exception declined by manager'
    );
    setSelectedReq(null);
    setDeclineReason('');
    setSubmitting(false);
    await loadRequests();
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header and Filter Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Manager Approvals Inbox</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational exceptions requested by receptionists above staff limits
          </p>
        </div>

        {/* Dual Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => setTab('pending')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              tab === 'pending'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setTab('decided')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              tab === 'decided'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Decided History
          </button>
        </div>
      </div>

      {/* Requests List */}
      <Card className="shadow-xs border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-900">
            {tab === 'pending' ? 'Pending Approval Requests' : 'Previously Decided Requests'}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {requests.length} {tab === 'pending' ? 'requiring action' : 'records'}
          </span>
        </CardHeader>
        <CardContent className="pt-4 divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
              Loading approvals inbox...
            </div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {tab === 'pending'
                ? 'No pending approval requests. Operations are clear.'
                : 'No historical decisions logged.'}
            </div>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="py-4 space-y-3 first:pt-0 last:pb-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-bold text-base text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {req.ticket_code}
                    </span>
                    <span className="font-semibold text-sm text-slate-800">{req.customer_name}</span>
                    <span className="text-xs text-slate-500">• {req.service_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]  font-bold px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
                      {req.kind}
                    </span>
                    <span
                      className={`text-[10px]  font-bold px-2 py-0.5 rounded-full ${
                        req.status === 'pending'
                          ? 'bg-amber-100 text-amber-900'
                          : req.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                </div>

                {/* Details Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400  font-semibold">
                      {req.kind === 'discount' ? 'Original List' : 'Subject'}
                    </span>
                    <div className="font-bold text-slate-800">
                      {req.kind === 'discount'
                        ? formatUGX(req.original_price_ugx)
                        : req.service_name || req.ticket_code}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400  font-semibold">
                      {req.kind === 'discount'
                        ? 'Requested Discount'
                        : req.kind === 'dispute_adjustment'
                        ? 'Adjustment Amount'
                        : 'Exception Action'}
                    </span>
                    <div className="font-bold text-amber-600">
                      {req.requested_discount_ugx > 0
                        ? formatUGX(req.requested_discount_ugx)
                        : req.kind.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400  font-semibold">
                      {req.kind === 'discount' ? 'Receptionist Cap' : 'Context'}
                    </span>
                    <div className="font-medium text-slate-600">
                      {req.kind === 'discount'
                        ? formatUGX(req.receptionist_limit_ugx)
                        : 'Front Desk Escalation'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400  font-semibold">Requested By</span>
                    <div className="font-medium text-slate-700">
                      {req.requested_by_name} ({req.requested_by_role})
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Reason given:</span> "{req.reason}"
                </div>

                {/* Action Form / Buttons for Pending */}
                {tab === 'pending' && (
                  <div className="pt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-t border-dashed">
                    <div className="text-[11px] text-muted-foreground">
                      {req.kind === 'discount'
                        ? 'Does not block customer in queue. Decision applies immediately to visit total.'
                        : 'Operational exception requested by receptionist. Decision takes effect immediately.'}
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-rose-700 hover:text-rose-800 border-rose-200 hover:bg-rose-50"
                        onClick={() => setSelectedReq(selectedReq?.id === req.id ? null : req)}
                      >
                        Adjust / Decide
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        onClick={() => handleApprove(req)}
                        disabled={submitting}
                      >
                        Approve Request
                      </Button>
                    </div>
                  </div>
                )}

                {/* Custom Approval / Decline Panel */}
                {selectedReq?.id === req.id && (
                  <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/80 space-y-3">
                    <div className="font-semibold text-xs text-amber-950">
                      Manager Exception Decision for Ticket {req.ticket_code}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-[10px]  font-bold text-slate-700 block mb-1">
                          Approve Alternate Discount (UGX)
                        </label>
                        <input
                          type="number"
                          placeholder={req.requested_discount_ugx.toString()}
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          className="w-full px-3 py-1.5 border rounded-lg bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px]  font-bold text-slate-700 block mb-1">
                          Or Decline Reason
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Exceeds standard goodwill limit"
                          value={declineReason}
                          onChange={(e) => setDeclineReason(e.target.value)}
                          className="w-full px-3 py-1.5 border rounded-lg bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => setSelectedReq(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="text-xs"
                        onClick={() => handleDecline(req)}
                        disabled={submitting}
                      >
                        Confirm Decline
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleApprove(req)}
                        disabled={submitting}
                      >
                        Approve Custom Amount
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
