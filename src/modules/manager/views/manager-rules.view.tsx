'use client';

import { showToast } from '@/shared/lib/toast';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  getDiscountRulesAction,
  toggleDiscountReasonAction,
  type ManagerDiscountReason,
} from '../controllers/manager-nav.actions';
import { ShieldCheck, Percent, HelpCircle, CheckCircle2, UserCheck } from 'lucide-react';

export function ManagerRulesView() {
  const [rules, setRules] = useState<ManagerDiscountReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadRules = async () => {
    setLoading(true);
    const res = await getDiscountRulesAction();
    if (res.success && res.data) {
      setRules(res.data);
    }
    setLoading(false);
  };
  useSalonLiveRefresh(() => { void loadRules(); }, true, ['discount_reason']);


  useEffect(() => {
    loadRules();
  }, []);

  const handleToggle = async (rule: ManagerDiscountReason) => {
    setTogglingId(rule.id);
    const newStatus = !rule.active;
    const res = await toggleDiscountReasonAction(rule.id, newStatus);
    if (res.success) {
      setFeedback(`Rule ${rule.label} is now ${newStatus ? 'ENABLED' : 'DISABLED'}`);
      loadRules();
    } else {
      showToast(`Error toggling rule: ${res.error || 'Failed'}`);
    }
    setTogglingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Operational Policy & Rules</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Governing limits, mandatory discount reason codes, and late-binding queue dispatching policies
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadRules} disabled={loading}>
          Refresh Rules
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

      {/* 1. Policy Caps Summary Card */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Standard Operational Caps (PDF Specification)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <span className="font-bold text-slate-900 block">Receptionist Discretionary Cap</span>
            <p className="text-muted-foreground">Up to <strong>UGX 5,000</strong> per ticket without prior approval.</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <span className="font-bold text-slate-900 block">Manager Discretionary Cap</span>
            <p className="text-muted-foreground">Over <strong>UGX 5,000</strong> requires manager approval. Discretionary authority up to price floor.</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <span className="font-bold text-slate-900 block">Queue Dispatch Policy</span>
            <p className="text-muted-foreground">Late binding by default. First-in first-out with capability match; no locked seats before line starts.</p>
          </div>
        </CardContent>
      </Card>

      {/* 2. Active Discount Reasons Table */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Percent className="w-4 h-4 text-primary" />
            Configured Reason Codes & Exceptions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading rules...</div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No discount reason rules configured.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rules.map((rule) => (
                <div key={rule.id} className="p-4 flex items-center justify-between hover:bg-slate-50/40 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{rule.label}</span>
                      <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 tabular-nums">
                        {rule.code}
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Mandatory reason selectable by receptionists when applying discounts or raising requests.
                    </p>
                  </div>

                  <div>
                    <Button
                      variant={rule.active ? 'default' : 'outline'}
                      size="sm"
                      className={`h-8 text-xs font-semibold ${rule.active ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'text-slate-600'}`}
                      onClick={() => handleToggle(rule)}
                      disabled={togglingId === rule.id}
                    >
                      {togglingId === rule.id ? 'Saving...' : rule.active ? 'Active' : 'Disabled'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
