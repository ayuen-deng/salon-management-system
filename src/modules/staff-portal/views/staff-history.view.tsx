'use client';

import React, { useState, useEffect } from 'react';
import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { getMyServiceHistoryAction } from '../controllers/staff.actions';
import { Clock, Users, CheckCircle2 } from 'lucide-react';

export function StaffHistoryView() {
  const [data, setData] = useState<{
    totalServed: number;
    recentServices: {
      id: string;
      ticketCode: string;
      customerFirstName: string;
      serviceName: string;
      variantName: string;
      completedAt: string;
    }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadHistory() {
    const res = await getMyServiceHistoryAction();
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  }

  useSalonLiveRefresh(() => { void loadHistory(); });

  useEffect(() => {
    void loadHistory();
  }, []);

  return (
    <div className="max-w-md mx-auto p-4 pb-24 md:pb-6 space-y-6 font-sans">
      <div>
        <h2 className="text-xl  font-bold text-[#1F2328]">Service History</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Clients served and completed service lines.
        </p>
      </div>

      {/* Lifetime Customers Served Card */}
      <Card className="border border-[#CBD5E1] bg-white rounded-2xl p-4 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1F4FD8]/10 text-[#1F4FD8] flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#1F2328]">Customers Served</div>
            <div className="text-[11px] text-muted-foreground">Unique client visits completed</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl tabular-nums font-bold text-[#1F2328]">
            {data?.totalServed || 0}
          </div>
          <div className="text-[10px] text-muted-foreground">clients</div>
        </div>
      </Card>

      {/* Recent Services List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold  tracking-normal text-slate-500 px-1">
          Recent Completed Services
        </h3>

        {loading ? (
          <Card className="border border-[#CBD5E1]">
            <CardContent className="p-8 text-center text-xs text-muted-foreground">Loading service history...</CardContent>
          </Card>
        ) : !data || data.recentServices.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-[#CBD5E1] text-center text-xs text-muted-foreground">
            No completed services on record yet.
          </div>
        ) : (
          <div className="space-y-2">
            {data.recentServices.map((item) => {
              const compDate = new Date(item.completedAt);
              const timeStr = compDate.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' });
              const dateStr = compDate.toLocaleDateString('en-UG', { month: 'short', day: 'numeric' });

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-white border border-[#CBD5E1] flex items-center justify-between text-xs shadow-2xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums font-bold text-[#1F2328]">{item.ticketCode}</span>
                      <span className="text-slate-400">•</span>
                      <span className="font-semibold text-slate-800">{item.customerFirstName}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {item.serviceName} ({item.variantName})
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground">
                    <div>{dateStr}</div>
                    <div className="tabular-nums">{timeStr}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
