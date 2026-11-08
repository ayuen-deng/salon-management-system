'use client';

import { showToast } from '@/shared/lib/toast';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  getReconciliationDataAction,
  writeOffReconciliationAction,
  type ManagerReconciliationData,
  type ManagerReconciliationEntry,
} from '../controllers/manager-nav.actions';
import { formatUgx } from '@/shared/models/money';
import { Landmark, ArrowRightLeft, AlertTriangle, CheckCircle2, FileText, Ban } from 'lucide-react';

export function ManagerReconciliationView() {
  const [data, setData] = useState<ManagerReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [writeOffModal, setWriteOffModal] = useState<ManagerReconciliationEntry | null>(null);
  const [writeOffReason, setWriteOffReason] = useState('');
  const [submittingWriteOff, setSubmittingWriteOff] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadReconciliation = async () => {
    setLoading(true);
    const res = await getReconciliationDataAction();
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
  };
  useSalonLiveRefresh(() => { void loadReconciliation(); });


  useEffect(() => {
    loadReconciliation();
  }, []);

  const handleWriteOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writeOffModal || !writeOffReason.trim()) return;

    setSubmittingWriteOff(true);
    const res = await writeOffReconciliationAction(writeOffModal.id, writeOffReason);
    if (res.success) {
      setFeedback(`Discrepancy for ${writeOffModal.reference} marked as written-off.`);
      setWriteOffModal(null);
      setWriteOffReason('');
      loadReconciliation();
    } else {
      showToast(`Error writing off entry: ${res.error || 'Failed'}`);
    }
    setSubmittingWriteOff(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Payment Reconciliation</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compare ledger payments against official telecom / bank settlement statements
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadReconciliation} disabled={loading}>
          Refresh Reconciliation
        </Button>
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
          <CardContent className="p-8 text-center text-xs text-muted-foreground">
            Loading live ledger & statement balances...
          </CardContent>
        </Card>
      ) : !data ? (
        <Card>
          <CardContent className="p-8 text-center text-xs text-muted-foreground">
            No active business day found for reconciliation.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border rounded-2xl p-5 space-y-2">
              <span className="text-xs font-bold text-muted-foreground  tracking-normal block">
                Recorded In Salon Ledger
              </span>
              <div className="text-2xl font-black tracking-tight text-slate-900">
                {formatUgx(data.recorded_momo_ugx)}
              </div>
              <div className="text-xs text-muted-foreground">
                Mobile Money transactions recorded today (Total sales: {formatUgx(data.recorded_total_ugx)})
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-5 space-y-2">
              <span className="text-xs font-bold text-muted-foreground  tracking-normal block">
                Statement Total ({data.statement_provider})
              </span>
              <div className="text-2xl font-black tracking-tight text-blue-600">
                {formatUgx(data.statement_total_ugx)}
              </div>
              <div className="text-xs text-muted-foreground">
                {data.statement_imported_at ? `Imported at ${new Date(data.statement_imported_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No statement loaded'}
              </div>
            </div>

            <div className={`border rounded-2xl p-5 space-y-2 ${data.difference_ugx === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
              <span className="text-xs font-bold  tracking-normal block">
                Reconciliation Difference
              </span>
              <div className="text-2xl font-black tracking-tight">
                {formatUgx(Math.abs(data.difference_ugx))} {data.difference_ugx !== 0 && (data.difference_ugx > 0 ? '(Surplus in Statement)' : '(Deficit in Statement)')}
              </div>
              <div className="text-xs">
                {data.difference_ugx === 0 ? 'Balances match ledger exactly.' : 'Unmatched discrepancy detected. Manager write-off or correction required.'}
              </div>
            </div>
          </div>

          {/* Statement Lines Table */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-primary" />
                  Statement Import Breakdown ({data.entries.length} items)
                </span>
                <span className="text-xs font-normal text-muted-foreground">Provider: {data.statement_provider}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.entries.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">No statement entries recorded for today.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.entries.map((entry) => (
                    <div key={entry.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="tabular-nums text-xs font-bold text-slate-900">{entry.reference}</code>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full  ${
                            entry.status === 'matched'
                              ? 'bg-emerald-100 text-emerald-800'
                              : entry.status === 'written_off'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {entry.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Amount: <strong className="text-slate-800">{formatUgx(entry.amount_ugx)}</strong>
                          {entry.write_off_reason && ` • Write-off Reason: "${entry.write_off_reason}"`}
                        </div>
                      </div>

                      <div>
                        {entry.status === 'unmatched' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 text-rose-600 border-rose-200 hover:bg-rose-50"
                            onClick={() => {
                              setWriteOffModal(entry);
                              setWriteOffReason('');
                            }}
                          >
                            <Ban className="w-3.5 h-3.5 mr-1" />
                            Manager Write-off
                          </Button>
                        )}
                        {entry.status === 'matched' && (
                          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Settled
                          </span>
                        )}
                        {entry.status === 'written_off' && (
                          <span className="text-xs text-slate-500 italic">Written-off</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Write-off Modal */}
      {writeOffModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Manager Write-off: {writeOffModal.reference}</h3>
            <p className="text-xs text-muted-foreground">
              Amount: {formatUgx(writeOffModal.amount_ugx)}. Writing off an unmatched transaction logs an immutable audit entry and acknowledges the difference before day closing.
            </p>

            <form onSubmit={handleWriteOff} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Reason for Write-off</label>
                <textarea
                  rows={3}
                  className="w-full text-sm border rounded-lg p-2"
                  placeholder="e.g. Unmatched sender reversed transaction directly, or operator typo during payment entry"
                  value={writeOffReason}
                  onChange={(e) => setWriteOffReason(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setWriteOffModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-rose-600 hover:bg-rose-700 text-white" disabled={submittingWriteOff}>
                  {submittingWriteOff ? 'Submitting...' : 'Confirm Write-off'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
