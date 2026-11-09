'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { fetchOwnerAuditAction, OwnerAuditItem } from '@/modules/dashboard-owner';
import { ShieldAlert, Activity, Filter } from 'lucide-react';

export function OwnerAuditView() {
  const [tab, setTab] = useState<'audit' | 'activity'>('audit');
  const [category, setCategory] = useState<string>('all');
  const [logs, setLogs] = useState<OwnerAuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAudit();
  }, [category]);

  async function loadAudit() {
    setLoading(true);
    const res = await fetchOwnerAuditAction(category);
    if (res.success) {
      setLogs(res.data);
    }
    setLoading(false);
  }
  useSalonLiveRefresh(() => { void loadAudit(); }, true, ['audit_log', 'app_user']);


  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EDEFF3] pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('audit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              tab === 'audit'
                ? 'bg-[#1F4FD8] text-white shadow-xs'
                : 'bg-white border border-[#EDEFF3] text-slate-600 hover:bg-slate-50'
            }`}
          >
            Audit Log (Full Immutable)
          </button>
          <button
            onClick={() => setTab('activity')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              tab === 'activity'
                ? 'bg-[#1F4FD8] text-white shadow-xs'
                : 'bg-white border border-[#EDEFF3] text-slate-600 hover:bg-slate-50'
            }`}
          >
            Friendly Activity Feed
          </button>
        </div>

        {tab === 'audit' && (
          <div className="flex items-center gap-2">
            {(['all', 'financial', 'reception', 'access', 'audit', 'people'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize ${
                  category === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Log Feed */}
      <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white overflow-hidden">
        <CardHeader className="p-4 border-b border-[#EDEFF3] bg-slate-50/50 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-900">
            {tab === 'audit' ? 'System Audit Ledger' : 'Chronological Activity Timeline'}
          </CardTitle>
          <span className="text-xs text-slate-400 tabular-nums">{logs.length} logged events</span>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading audit trail...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No events found.</div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {logs.map((item) => (
                <div key={item.id} className="p-4 hover:bg-slate-50/60 transition-colors space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{item.action}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 capitalize">
                        {item.category}
                      </span>
                    </div>
                    <span className="tabular-nums text-slate-400 text-[11px]">
                      {new Date(item.at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div className="text-slate-600 font-medium">{item.reason || 'No additional reason provided'}</div>
                  <div className="text-[11px] text-slate-400">
                    Actor: {item.actor_name} ({item.actor_role}) • Entity: {item.entity_type} #{item.entity_id}
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
