'use client';

import React, { useState, useEffect } from 'react';
import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { getStaffQueueAction, type StaffTargetInfo } from '../controllers/staff.actions';
import { Award, Target, TrendingUp, Calendar, CheckCircle2 } from 'lucide-react';

export function StaffTargetView() {
  const [targetInfo, setTargetInfo] = useState<StaffTargetInfo | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadTarget() {
    const res = await getStaffQueueAction();
    if (res.success && res.data) setTargetInfo(res.data.targetInfo || null);
    setLoading(false);
  }

  useSalonLiveRefresh(() => { void loadTarget(); }, true, ['visit_service', 'app_setting']);

  useEffect(() => {
    void loadTarget();
  }, []);

  return (
    <div className="max-w-md mx-auto p-4 pb-24 md:pb-6 space-y-6 font-sans">
      <div>
        <h2 className="text-xl  font-bold text-[#1F2328]">Customer Volume Target</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Track your progress towards this period&apos;s customer service goal.
        </p>
      </div>

      {loading ? (
        <Card className="border border-[#CBD5E1]">
          <CardContent className="p-8 text-center text-xs text-muted-foreground">Loading target...</CardContent>
        </Card>
      ) : !targetInfo ? (
        <div className="py-12 text-center space-y-2 bg-white rounded-2xl border border-[#CBD5E1] p-6">
          <div className="w-12 h-12 rounded-full bg-[#1F4FD8]/10 text-[#1F4FD8] flex items-center justify-center mx-auto">
            <Target className="w-6 h-6" />
          </div>
          <p className="text-base font-bold text-[#1F2328]">No Active Target</p>
          <p className="text-xs text-muted-foreground">Your manager has not set a customer target for this period.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main Progress Card */}
          <Card className="border border-[#CBD5E1] bg-white rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="bg-[#FAF9F6] border-b border-[#E4E1DA] py-4 px-5 flex flex-row items-center justify-between">
              <div>
                <span className="text-[10px] font-bold  tracking-normal text-[#1F4FD8] block">
                  {targetInfo.period} Goal
                </span>
                <CardTitle className="text-base font-bold text-[#1F2328] mt-0.5">
                  Customer Goal Progress
                </CardTitle>
              </div>
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Due {targetInfo.deadline || 'Period end'}
              </span>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-3xl tabular-nums font-bold text-[#1F2328]">
                    {targetInfo.currentCustomers}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground ml-1">
                    / {targetInfo.targetCustomers} clients
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl tabular-nums font-bold text-[#1F4FD8]">
                    {targetInfo.percentComplete}%
                  </span>
                  <span className="text-[11px] text-muted-foreground block font-medium">completed</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-[#CBD5E1]">
                <div
                  className="bg-[#1F4FD8] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, targetInfo.percentComplete)}%` }}
                />
              </div>

              {/* Pace Note */}
              <div className="p-3 rounded-xl bg-slate-50 border border-[#CBD5E1] flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Status pace:</span>
                <span className="font-bold text-[#1F2328]">{targetInfo.paceNote || 'On track'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
