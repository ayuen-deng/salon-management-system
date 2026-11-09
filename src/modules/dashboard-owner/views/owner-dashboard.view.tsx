'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { DetailModal } from '@/shared/views/ui/detail-modal';
import { AttendanceStatusChip } from '@/shared/views/ui/attendance-status-chip';
import { formatUGX } from '@/shared/models/money';
import {
  fetchOwnerDashboardAction,
  markReviewItemSeenAction,
  markAllReviewItemsSeenAction,
  OwnerDashboardData,
  OwnerActivityVisitDetail,
  OwnerStaffAttendanceDetail,
  OwnerPaymentDetail
} from '@/modules/dashboard-owner';
import { Check, CheckCheck, ChevronRight, AlertTriangle, Clock, ExternalLink } from 'lucide-react';

export function OwnerDashboardView() {
  const [data, setData] = useState<OwnerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [clockNow, setClockNow] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [reviewTab, setReviewTab] = useState<'to_review' | 'seen'>('to_review');
  const [selectedReviewItem, setSelectedReviewItem] = useState<OwnerDashboardData['review_items'][0] | null>(null);

  // Modal State
  const [activeModal, setActiveModal] = useState<'revenue' | 'momo' | 'activity' | 'attendance' | null>(null);
  const [activityTab, setActivityTab] = useState<'waiting' | 'in_service' | 'completed' | 'abandoned' | 'no_show'>('waiting');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [selectedVisitDetail, setSelectedVisitDetail] = useState<OwnerActivityVisitDetail | null>(null);

  const ownerId = 'c0000000-0000-0000-0000-000000000001';

  async function loadData() {
    const res = await fetchOwnerDashboardAction();
    if (res.success && res.data) {
      setData(res.data);
      const now = new Date();
      setUpdatedAt(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    }
    setLoading(false);
  }
  useSalonLiveRefresh(() => { void loadData(); }, true, ['business_day', 'payment', 'visit', 'visit_service', 'appointment', 'app_user', 'customer', 'service', 'attendance', 'rota_entry', 'work_hours_policy', 'leave_request', 'audit_log', 'owner_review_seen']);


  useEffect(() => {
    loadData();
    setClockNow(Date.now());
    const interval = setInterval(() => setClockNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  const queuedWaits = (clockNow === null ? [] : data?.details.activity_visits || [])
    .filter((visit) => visit.status === 'queued' && visit.queued_at_iso)
    .map((visit) => Math.max(0, Math.round((clockNow! - new Date(visit.queued_at_iso!).getTime()) / 60000)));
  const averageWaitMinutes = queuedWaits.length
    ? Math.round(queuedWaits.reduce((total, minutes) => total + minutes, 0) / queuedWaits.length)
    : data?.activity.avg_wait_minutes ?? 0;
  const longestWaitMinutes = queuedWaits.length
    ? Math.max(...queuedWaits)
    : data?.activity.longest_wait_minutes ?? 0;

  function handleMarkSeen(itemId: string) {
    if (!data) return;
    startTransition(async () => {
      await markReviewItemSeenAction(itemId, ownerId);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          review_items: prev.review_items.map((i) => (i.id === itemId ? { ...i, seen: true } : i)),
        };
      });
    });
  }

  function handleMarkAllSeen() {
    if (!data) return;
    const unseenIds = data.review_items.filter((i) => !i.seen).map((i) => i.id);
    if (unseenIds.length === 0) return;

    startTransition(async () => {
      await markAllReviewItemsSeenAction(unseenIds, ownerId);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          review_items: prev.review_items.map((i) => ({ ...i, seen: true })),
        };
      });
    });
  }

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-lg w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-[#EDEFF3]"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto p-6 text-center text-slate-500">
        Unable to load dashboard data. Please try again.
      </div>
    );
  }

  // Comparison copy
  let comparisonText = 'No comparison yet';
  let comparisonColor = 'text-slate-500';
  if (data.avg_same_weekday_ugx !== null && data.avg_same_weekday_ugx > 0) {
    const diff = data.revenue_today_ugx - data.avg_same_weekday_ugx;
    const pct = Math.round((diff / data.avg_same_weekday_ugx) * 100);
    const sign = pct > 0 ? '+' : '';
    comparisonText = `${sign}${pct}% vs 4-wk same-day avg (${formatUGX(data.avg_same_weekday_ugx)})`;
    if (pct > 0) {
      comparisonColor = 'text-[#17794F]';
    } else if (pct < 0) {
      comparisonColor = 'text-[#B42318]';
    } else {
      comparisonColor = 'text-[#566174]';
    }
  }

  // Open status copy
  let openStatusCopy = 'Not open yet';
  if (data.day_status === 'open') {
    openStatusCopy = data.opened_at_str
      ? `Open since ${data.opened_at_str} (expected ${data.expected_open})`
      : `Open (expected ${data.expected_open})`;
  } else if (data.day_status === 'closed') {
    openStatusCopy = 'Day closed';
  } else if (data.day_status === 'closing') {
    openStatusCopy = 'Day closing in progress';
  }

  const unseenReviews = data.review_items.filter((r) => !r.seen);

  // Filtered Activity Visits
  const activityVisitsByTab = (data.details?.activity_visits || []).filter((v) => {
    if (activityTab === 'waiting') return v.status === 'queued';
    if (activityTab === 'in_service') return v.status === 'in_service';
    if (activityTab === 'completed') return ['ready_for_checkout', 'completed'].includes(v.status);
    if (activityTab === 'abandoned') return v.status === 'abandoned';
    if (activityTab === 'no_show') return v.status === 'no_show';
    return false;
  });

  // Filtered Staff Attendance
  const staffList = (data.details?.staff_attendance || []).filter((s) => {
    if (staffFilter === 'all') return true;
    return s.status === staffFilter;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Stale Unclosed Day Alert Banner */}
      {data.stale_unclosed_warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold">{data.stale_unclosed_warning}</span>
            <span className="text-amber-700">Please instruct the manager to close and reconcile that business day.</span>
          </div>
          <Link
            href="/owner/summaries"
            className="font-semibold text-amber-900 underline hover:text-amber-800 shrink-0"
          >
            Review in summaries ↗
          </Link>
        </div>
      )}

      {/* Status Strip */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#EDEFF3] pb-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              data.day_status === 'open'
                ? 'bg-emerald-500 animate-pulse'
                : data.day_status === 'closing'
                ? 'bg-amber-500'
                : 'bg-slate-400'
            }`}
          ></span>
          <span className="font-semibold text-slate-900">{openStatusCopy}</span>
          <span className="text-slate-300">•</span>
          <span>Last activity {data.last_activity_str}</span>
        </div>
        <div className="text-[11px] text-slate-500">
          Updated {updatedAt || 'just now'}
        </div>
      </div>

      {/* Top 4 Stat Cards Row (Clickable Detail Modals) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Revenue Today Card */}
        <button
          type="button"
          onClick={() => setActiveModal('revenue')}
          className="text-left group focus:outline-none focus:ring-2 focus:ring-[#1F4FD8] rounded-2xl"
        >
          <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white hover:border-[#CBD5E1] transition-all h-full flex flex-col justify-between">
            <CardHeader className="p-5 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Revenue today</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatUGX(data.revenue_today_ugx)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-1.5 text-xs text-slate-600">
              <div className={`text-[11px] font-medium ${comparisonColor}`}>{comparisonText}</div>
              <div className="text-slate-500 flex justify-between pt-1 border-t border-slate-100">
                <span>MoMo: {formatUGX(data.revenue_momo_ugx)}</span>
                <span>Cash: {formatUGX(data.revenue_cash_ugx)}</span>
              </div>
            </CardContent>
          </Card>
        </button>

        {/* 2. MoMo Verification Card */}
        <button
          type="button"
          onClick={() => setActiveModal('momo')}
          className="text-left group focus:outline-none focus:ring-2 focus:ring-[#1F4FD8] rounded-2xl"
        >
          <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white hover:border-[#CBD5E1] transition-all h-full flex flex-col justify-between">
            <CardHeader className="p-5 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Mobile Money verification</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-emerald-600 tabular-nums">
                {data.momo_verified_pct}% verified
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-500">Verified:</span>
                <span className="tabular-nums font-medium">{formatUGX(data.momo_verified_ugx)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Awaiting verification:</span>
                <span className="tabular-nums font-medium">{formatUGX(data.momo_awaiting_ugx)}</span>
              </div>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                Cash: counted at close
              </div>
            </CardContent>
          </Card>
        </button>

        {/* 3. Salon Activity Card */}
        <button
          type="button"
          onClick={() => setActiveModal('activity')}
          className="text-left group focus:outline-none focus:ring-2 focus:ring-[#1F4FD8] rounded-2xl"
        >
          <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white hover:border-[#CBD5E1] transition-all h-full flex flex-col justify-between">
            <CardHeader className="p-5 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Today in salon</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {data.activity.completed} completed
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-500">Waiting:</span>
                <span className="tabular-nums font-medium">{data.activity.waiting}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">In service:</span>
                <span className="tabular-nums font-medium">{data.activity.in_service}</span>
              </div>
              <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-100">
                <span>Left queue: {data.activity.left_queue}</span>
                <span>No-shows: {data.activity.no_show}</span>
              </div>
            </CardContent>
          </Card>
        </button>

        {/* 4. Staff on Floor Card */}
        <button
          type="button"
          onClick={() => setActiveModal('attendance')}
          className="text-left group focus:outline-none focus:ring-2 focus:ring-[#1F4FD8] rounded-2xl"
        >
          <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white hover:border-[#CBD5E1] transition-all h-full flex flex-col justify-between">
            <CardHeader className="p-5 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Staff attendance</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {data.staff.present} of {data.staff.expected} present
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 text-xs space-y-1">
              <div className="text-slate-600 font-medium">
                {data.staff.on_break} on break · {data.staff.out_count} out · {data.staff.not_present_count} not present · {data.staff.on_leave_count} on leave
              </div>
              {data.staff.present === data.staff.expected && (
                <div className="text-emerald-700 font-medium text-[11px]">All expected staff on floor</div>
              )}
            </CardContent>
          </Card>
        </button>
      </div>

      {/* For Your Review Section */}
      <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white">
        <CardHeader className="p-5 pb-3 border-b border-[#EDEFF3] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base font-semibold text-slate-900">For your review</CardTitle>
            <div className="flex bg-[#F6F7FB] p-0.5 rounded-lg border border-[#EDEFF3] text-xs">
              <button
                onClick={() => setReviewTab('to_review')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
                  reviewTab === 'to_review'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>To review</span>
                {unseenReviews.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-[#1F4FD8] text-white">
                    {unseenReviews.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setReviewTab('seen')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
                  reviewTab === 'seen'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>Seen</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-200 text-slate-700">
                  {data.review_items.filter((i) => i.seen).length}
                </span>
              </button>
            </div>
          </div>
          {reviewTab === 'to_review' && unseenReviews.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllSeen}
              disabled={isPending}
              className="text-xs font-medium h-7 border-slate-200"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1 text-slate-500" />
              Mark all as seen
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-5 pt-4 space-y-2.5">
          {(() => {
            const currentItems = data.review_items.filter((i) =>
              reviewTab === 'to_review' ? !i.seen : i.seen
            );

            if (currentItems.length === 0) {
              return (
                <p className="text-xs text-slate-400 text-center py-6">
                  {reviewTab === 'to_review'
                    ? 'All items reviewed. No items requiring review.'
                    : 'No previously acknowledged items.'}
                </p>
              );
            }

            return currentItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedReviewItem(item)}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors cursor-pointer ${
                  item.seen ? 'bg-slate-50/50 border-slate-100 text-slate-400' : 'bg-white border-[#EDEFF3] text-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        item.category === 'Discount'
                          ? 'bg-amber-100 text-amber-800'
                          : item.category === 'Refund'
                          ? 'bg-rose-100 text-rose-800'
                          : item.category === 'Void'
                          ? 'bg-purple-100 text-purple-800'
                          : item.category === 'HR'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.category}
                    </span>
                    <span className={`font-medium ${item.seen ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                      {item.title}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    By <strong>{item.actor}</strong> · {item.actor_role} • {item.full_datetime_str || item.time_str}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                  {!item.seen ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkSeen(item.id)}
                      disabled={isPending}
                      className="text-xs h-7 px-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    >
                      <Check className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      Mark as seen
                    </Button>
                  ) : (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                      <Check className="w-3.5 h-3.5 text-emerald-500" /> Seen
                    </span>
                  )}
                </div>
              </div>
            ));
          })()}
        </CardContent>
      </Card>

      {/* Grid: Live Queue Snapshot & 7-Day Revenue Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-6">
          <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white">
            <CardHeader className="p-5 pb-3 border-b border-[#EDEFF3] flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-900">Live queue snapshot</CardTitle>
              <span className="text-xs text-slate-500 font-medium">
                {data.queue_snapshot.length} currently queued
              </span>
            </CardHeader>
            <CardContent className="p-5 pt-3">
              {data.queue_snapshot.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Queue is currently clear.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {data.queue_snapshot.map((q, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-[#1F4FD8] bg-[#1F4FD8]/10 px-2 py-0.5 rounded tabular-nums">
                          {q.ticket_code}
                        </span>
                        <span className="font-medium text-slate-800">{q.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="capitalize text-slate-500 text-[11px]">{q.status.replace(/_/g, ' ')}</span>
                        <span className="text-slate-400 text-[10px] tabular-nums">{q.queued_time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-6 space-y-6">
          <Card className="rounded-2xl border-[#EDEFF3] shadow-xs bg-white">
            <CardHeader className="p-5 pb-3 border-b border-[#EDEFF3]">
              <CardTitle className="text-base font-semibold text-slate-900">7-day revenue trend</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-4 space-y-2">
              <div className="space-y-2 text-xs">
                {data.revenue_chart.map((day, idx) => {
                  const maxAmt = Math.max(...data.revenue_chart.map((d) => d.amount_ugx), 1);
                  const pct = Math.round((day.amount_ugx / maxAmt) * 100);
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="w-24 text-slate-500 font-medium shrink-0">{day.day_label}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#1F4FD8] h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                      <span className="w-24 text-right tabular-nums font-semibold text-slate-800 shrink-0">
                        {formatUGX(day.amount_ugx)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. DETAIL MODAL: REVENUE TODAY */}
      {/* ============================================================== */}
      <DetailModal
        isOpen={activeModal === 'revenue'}
        onClose={() => setActiveModal(null)}
        title="Revenue Today Breakdown"
        subtitle={`Total collected for ${data.business_date}`}
        maxWidthClass="max-w-2xl"
        footer={
          <div className="flex items-center justify-between">
            <Link
              href="/owner/payments"
              className="text-xs font-semibold text-[#1F4FD8] hover:underline flex items-center gap-1"
            >
              View all payments in Payments <ExternalLink className="w-3 h-3" />
            </Link>
            <span className="text-xs text-slate-400">Read-only overview</span>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
            <div>
              <span className="text-[11px] text-slate-500 block">Total Revenue</span>
              <span className="text-base font-bold text-slate-900 tabular-nums">{formatUGX(data.revenue_today_ugx)}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Mobile Money</span>
              <span className="text-base font-bold text-[#1F4FD8] tabular-nums">{formatUGX(data.revenue_momo_ugx)}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Cash Counted</span>
              <span className="text-base font-bold text-emerald-700 tabular-nums">{formatUGX(data.revenue_cash_ugx)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700">Individual Payments Today</h4>
            {(data.details?.payments || []).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No payments recorded yet today.</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                {(data.details?.payments || []).map((p) => (
                  <div key={p.id} className="p-3 bg-white flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1F4FD8] bg-blue-50 px-1.5 py-0.5 rounded text-[11px] tabular-nums">
                          {p.ticket_code}
                        </span>
                        <span className="font-medium text-slate-800">{p.customer_name}</span>
                        <span className="text-[10px] text-slate-400 capitalize">({p.method.replace('_', ' ')})</span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">{p.confirmation_level}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900 tabular-nums block">{formatUGX(p.amount_ugx)}</span>
                      <span className="text-[10px] text-slate-400 tabular-nums">{p.time_str}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DetailModal>

      {/* ============================================================== */}
      {/* 2. DETAIL MODAL: MOBILE MONEY VERIFICATION */}
      {/* ============================================================== */}
      <DetailModal
        isOpen={activeModal === 'momo'}
        onClose={() => setActiveModal(null)}
        title="Mobile Money Verification Details"
        subtitle="Payments awaiting reconciliation by manager"
        maxWidthClass="max-w-2xl"
        footer={
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">The manager reconciles statement lines during salon operations.</span>
            <Link
              href="/owner/payments"
              className="text-xs font-semibold text-[#1F4FD8] hover:underline flex items-center gap-1"
            >
              Reconciliation view <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
            <div>
              <span className="text-[11px] text-slate-500 block">Verified with Statement</span>
              <span className="text-base font-bold text-emerald-700 tabular-nums">{formatUGX(data.momo_verified_ugx)}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Awaiting Verification</span>
              <span className="text-base font-bold text-amber-700 tabular-nums">{formatUGX(data.momo_awaiting_ugx)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700">Unreconciled Mobile Money Transactions</h4>
            {(data.details?.momo_awaiting_payments || []).length === 0 ? (
              <p className="text-xs text-emerald-700 text-center py-6 bg-emerald-50/50 rounded-xl border border-emerald-100">
                All Mobile Money payments for today have been verified.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                {(data.details?.momo_awaiting_payments || []).map((p) => (
                  <div key={p.id} className="p-3 bg-white flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1F4FD8] bg-blue-50 px-1.5 py-0.5 rounded text-[11px] tabular-nums">
                          {p.ticket_code}
                        </span>
                        <span className="font-medium text-slate-800">{p.customer_name}</span>
                      </div>
                      <span className="text-[10px] text-amber-800 mt-0.5 block">{p.confirmation_level}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900 tabular-nums block">{formatUGX(p.amount_ugx)}</span>
                      <span className="text-[10px] text-slate-400 tabular-nums">{p.time_str}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DetailModal>

      {/* ============================================================== */}
      {/* 3. DETAIL MODAL: TODAY IN SALON */}
      {/* ============================================================== */}
      <DetailModal
        isOpen={activeModal === 'activity'}
        onClose={() => {
          setActiveModal(null);
          setSelectedVisitDetail(null);
        }}
        title="Today in Salon (Activity Details)"
        subtitle="Live queue, active services, completed visits, and cancellations"
        maxWidthClass="max-w-3xl"
        footer={
          <div className="flex items-center justify-between">
            <Link
              href="/owner/visits"
              className="text-xs font-semibold text-[#1F4FD8] hover:underline flex items-center gap-1"
            >
              View all in Visits <ExternalLink className="w-3 h-3" />
            </Link>
            <span className="text-xs text-slate-400">Read-only monitor</span>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Header Summary Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block">Waiting</span>
              <span className="font-bold text-slate-900 text-sm tabular-nums">{data.activity.waiting}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">In Service</span>
              <span className="font-bold text-blue-700 text-sm tabular-nums">{data.activity.in_service}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Average Wait</span>
              <span className="font-bold text-slate-900 text-sm tabular-nums">~{averageWaitMinutes}m</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Longest Wait</span>
              <span className="font-bold text-slate-900 text-sm tabular-nums">{longestWaitMinutes}m</span>
            </div>
          </div>

          {/* Activity Category Tabs */}
          <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2 text-xs">
            {[
              { id: 'waiting', label: 'Waiting', count: data.activity.waiting },
              { id: 'in_service', label: 'In service', count: data.activity.in_service },
              { id: 'completed', label: 'Completed', count: data.activity.completed },
              { id: 'abandoned', label: 'Left queue', count: data.activity.left_queue },
              { id: 'no_show', label: 'No-shows', count: data.activity.no_show },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivityTab(tab.id as typeof activityTab)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                  activityTab === tab.id
                    ? 'bg-[#1F4FD8] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    activityTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Tab Rows List */}
          <div className="space-y-2">
            {activityVisitsByTab.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No visits currently in this category.</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                {activityVisitsByTab.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVisitDetail(v)}
                    className="p-3 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between text-xs cursor-pointer"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1F4FD8] bg-blue-50 px-2 py-0.5 rounded tabular-nums">
                          {v.ticket_code}
                        </span>
                        <span className="font-semibold text-slate-900">{v.customer_name}</span>
                        {v.is_paid && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-medium">
                            Paid
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {v.services.join(', ')} • Stylist: <strong>{v.stylist_name}</strong>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-slate-500">
                      {v.status === 'queued' && v.queued_at_str && (
                        <span>Waiting since {v.queued_at_str}</span>
                      )}
                      {v.status === 'in_service' && v.started_at_str && (
                        <span>Started {v.started_at_str} (~{clockNow !== null && v.started_at_iso ? Math.max(0, Math.round((clockNow - new Date(v.started_at_iso).getTime()) / 60000)) : v.elapsed_minutes ?? 0}m)</span>
                      )}
                      {['ready_for_checkout', 'completed'].includes(v.status) && v.completed_at_str && (
                        <span>Done {v.completed_at_str} ({v.duration_minutes}m)</span>
                      )}
                      {v.status === 'abandoned' && v.left_at_str && (
                        <span className="text-rose-700">Left at {v.left_at_str}</span>
                      )}
                      {v.status === 'no_show' && (
                        <span className="text-amber-800">Did not arrive</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nested Read-Only Visit Detail Drawer */}
        {selectedVisitDetail && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 mt-4 text-xs animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">
                Ticket #{selectedVisitDetail.ticket_code} — {selectedVisitDetail.customer_name}
              </span>
              <button
                type="button"
                onClick={() => setSelectedVisitDetail(null)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-slate-600">Services: {selectedVisitDetail.services.join(', ')}</p>
            <p className="text-slate-600">Assigned Stylist: {selectedVisitDetail.stylist_name}</p>
            <p className="text-slate-600">Status: {selectedVisitDetail.status.replace(/_/g, ' ')}</p>
          </div>
        )}
      </DetailModal>

      {/* ============================================================== */}
      {/* 4. DETAIL MODAL: STAFF ATTENDANCE */}
      {/* ============================================================== */}
      <DetailModal
        isOpen={activeModal === 'attendance'}
        onClose={() => setActiveModal(null)}
        title="Staff Attendance Today"
        subtitle="Expected salon roster and live presence"
        maxWidthClass="max-w-3xl"
        footer={
          <div className="flex items-center justify-between">
            <Link
              href="/owner/staff"
              className="text-xs font-semibold text-[#1F4FD8] hover:underline flex items-center gap-1"
            >
              View in Staff <ExternalLink className="w-3 h-3" />
            </Link>
            <span className="text-xs text-slate-400">Live roster synchronization</span>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Summary counts */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block">Present</span>
              <span className="font-bold text-emerald-700 text-sm tabular-nums">{data.staff.present}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">On break</span>
              <span className="font-bold text-amber-700 text-sm tabular-nums">{data.staff.on_break}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Out</span>
              <span className="font-bold text-slate-700 text-sm tabular-nums">{data.staff.out_count}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Not present</span>
              <span className="font-bold text-slate-700 text-sm tabular-nums">{data.staff.not_present_count}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">On leave</span>
              <span className="font-bold text-blue-700 text-sm tabular-nums">{data.staff.on_leave_count}</span>
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2 text-xs">
            {['all', 'Present', 'On break', 'Out', 'Not present', 'On leave'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStaffFilter(st)}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  staffFilter === st
                    ? 'bg-[#1F4FD8] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {st === 'all' ? 'All Staff' : st}
              </button>
            ))}
          </div>

          {/* Roster list from the shared presence view */}
          <div className="space-y-2">
            {staffList.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No staff members in this category.</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                {staffList.map((s) => (
                  <div key={s.user_id} className="p-3 bg-white flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{s.name}</span>
                        <span className="text-[10px] text-slate-400 capitalize">({s.role})</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <AttendanceStatusChip status={s.status} leaveType={s.leave_type} />
                      {(s.clock_in_str || s.clock_out_str || s.break_started_str) && (
                        <span className="text-[10px] text-slate-500 block mt-0.5 tabular-nums">
                          {s.status === 'Present' ? `In since ${s.clock_in_str}` : s.status === 'On break' ? `Break since ${s.break_started_str}` : s.status === 'Out' ? `Left ${s.clock_out_str}` : null}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DetailModal>

      {/* Review Item Detail Modal */}
      {selectedReviewItem && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedReviewItem(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-[#EDEFF3] p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#EDEFF3] pb-3">
              <div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    selectedReviewItem.category === 'Discount'
                      ? 'bg-amber-100 text-amber-800'
                      : selectedReviewItem.category === 'Refund'
                      ? 'bg-rose-100 text-rose-800'
                      : selectedReviewItem.category === 'Void'
                      ? 'bg-purple-100 text-purple-800'
                      : selectedReviewItem.category === 'HR'
                      ? 'bg-blue-100 text-blue-800'
                      : selectedReviewItem.category === 'Price change'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {selectedReviewItem.category}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1.5">{selectedReviewItem.title}</h3>
              </div>
              <button
                onClick={() => setSelectedReviewItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#F6F7FB] rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold">Actor</span>
                  <span className="font-semibold text-slate-800">
                    {selectedReviewItem.actor} ({selectedReviewItem.actor_role})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold">Date & Time</span>
                  <span className="font-semibold text-slate-800">
                    {selectedReviewItem.full_datetime_str || selectedReviewItem.time_str}
                  </span>
                </div>
                {selectedReviewItem.amount_ugx && selectedReviewItem.amount_ugx > 0 ? (
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold">Amount</span>
                    <span className="tabular-nums font-bold text-[#1F4FD8]">
                      {formatUGX(selectedReviewItem.amount_ugx)}
                    </span>
                  </div>
                ) : null}
                {selectedReviewItem.entity_type && (
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold">Target Entity</span>
                    <span className="tabular-nums text-slate-700">
                      {selectedReviewItem.entity_type} #{selectedReviewItem.entity_id?.slice(0, 8)}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Reason Stated:</span>
                <p className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-700 italic">
                  "{selectedReviewItem.reason}"
                </p>
              </div>

              {(selectedReviewItem.before || selectedReviewItem.after) && (
                <div className="space-y-2">
                  <span className="text-slate-500 font-semibold block">Audit Log State Diff:</span>
                  <div className="grid grid-cols-2 gap-2 tabular-nums text-[11px]">
                    <div className="p-2 bg-rose-50/50 border border-rose-100 rounded-lg text-rose-900 overflow-x-auto">
                      <span className="text-[9px] font-bold text-rose-600 block mb-1">Before</span>
                      <pre className="text-[10px] whitespace-pre-wrap">
                        {JSON.stringify(selectedReviewItem.before || {}, null, 2)}
                      </pre>
                    </div>
                    <div className="p-2 bg-emerald-50/50 border border-emerald-100 rounded-lg text-emerald-900 overflow-x-auto">
                      <span className="text-[9px] font-bold text-emerald-600 block mb-1">After</span>
                      <pre className="text-[10px] whitespace-pre-wrap">
                        {JSON.stringify(selectedReviewItem.after || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#EDEFF3] space-y-3">
              <p className="text-[11px] text-slate-400 italic text-center">
                Marking as seen only records that you looked at this. To act on it, contact the manager.
              </p>
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedReviewItem(null)}
                  className="text-xs"
                >
                  Close
                </Button>
                <div className="flex items-center gap-2">
                  {!selectedReviewItem.seen ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        handleMarkSeen(selectedReviewItem.id);
                        setSelectedReviewItem((prev) => (prev ? { ...prev, seen: true } : null));
                      }}
                      disabled={isPending}
                      className="bg-[#1F4FD8] hover:bg-[#1A43B8] text-white text-xs font-semibold"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Mark as seen
                    </Button>
                  ) : (
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <Check className="w-4 h-4" /> Acknowledged
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
