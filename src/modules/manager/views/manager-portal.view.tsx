'use client';

import React, { useState, useEffect } from 'react';
import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { StatCard } from '@/shared/views/ui/stat-card';
import {
  getManagerTodayOverviewAction,
  ManagerTodayStats,
  ManagerQueueItem,
  ManagerAttendanceSummary,
  ManagerRecentActivity,
} from '../controllers/manager-nav.actions';
import { BusinessDayState, OpenDayModal } from '@/modules/day';
import { formatDuration } from '@/shared/lib/format-duration';
import { AttendanceStatusChip } from '@/shared/views/ui/attendance-status-chip';
import {
  Clock,
  Scissors,
  CheckCircle2,
  UserX,
  CreditCard,
  CheckSquare,
  AlertTriangle,
  Flame,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Coffee,
  Calendar,
} from 'lucide-react';

export function ManagerPortalView() {
  const [loading, setLoading] = useState(true);
  const [dayState, setDayState] = useState<BusinessDayState | null>(null);
  const [olderOpenDay, setOlderOpenDay] = useState<BusinessDayState | null>(null);
  const [openDayModalOpen, setOpenDayModalOpen] = useState(false);
  const [stats, setStats] = useState<ManagerTodayStats>({
    waiting: 0,
    in_service: 0,
    completed: 0,
    left_queue: 0,
    unpaid: 0,
    orders_awaiting_payment: 0,
    pending_approvals: 0,
  });
  const [queue, setQueue] = useState<ManagerQueueItem[]>([]);
  const [washHoldWarning, setWashHoldWarning] = useState(false);
  const [attendance, setAttendance] = useState<ManagerAttendanceSummary>({
    present: 0,
    on_break: 0,
    out: 0,
    not_present: 0,
    on_leave: 0,
    total_expected: 0,
    records: [],
  });
  const [activity, setActivity] = useState<ManagerRecentActivity[]>([]);

  const refreshData = () => {
    setLoading(true);
    getManagerTodayOverviewAction().then((res) => {
      if (res.success) {
        setDayState(res.dayState);
        setOlderOpenDay(res.olderOpenDay || null);
        setStats(res.stats);
        setQueue(res.queue.items);
        setWashHoldWarning(res.queue.washHoldWarning);
        setAttendance(res.attendance);
        setActivity(res.recentActivity);
      }
      setLoading(false);
    });
  };

  useSalonLiveRefresh(refreshData, true, [
    'business_day',
    'approval_request',
    'visit',
    'visit_service',
    'service_variant',
    'customer',
    'app_user',
    'attendance',
    'rota_entry',
    'work_hours_policy',
    'leave_request',
    'audit_log',
  ]);

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* 1. TOP STATUS & SHORTCUT BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                dayState?.status === 'open' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            ></span>
            <span className="text-xs  font-bold tracking-normal text-slate-500">
              Salon Operations Status
            </span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-slate-900 mt-0.5">
            {dayState?.status === 'open'
              ? 'Business Day is Open'
              : dayState?.status === 'closing'
              ? 'Day Close in Progress'
              : 'Business Day Closed'}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Active date: {dayState?.business_date || 'Today'} • Cash float:{' '}
            <span className="font-semibold text-slate-700">
              UGX {(dayState?.cash_float || 50000).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {dayState?.status === 'open' ? (
            <Link href="/manager/day">
              <Button variant="outline" size="sm" className="font-semibold text-xs border-amber-300 bg-amber-50/50 hover:bg-amber-100/50 text-amber-900">
                Begin Day Close
              </Button>
            </Link>
          ) : (
            <Button
              size="sm"
              onClick={() => setOpenDayModalOpen(true)}
              className="font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Open the Day
            </Button>
          )}
          <Link href="/manager/approvals">
            <Button
              variant="outline"
              size="sm"
              className={`font-semibold text-xs relative ${
                stats.pending_approvals > 0 ? 'border-amber-300 text-amber-900 bg-amber-50/40' : ''
              }`}
            >
              Approvals Inbox
              {stats.pending_approvals > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  {stats.pending_approvals}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
        <StatCard
          title="Waiting"
          value={stats.waiting.toString()}
          subtitle="In queue pool"
        />
        <StatCard
          title="In service"
          value={stats.in_service.toString()}
          subtitle="At stylist stations"
        />
        <StatCard
          title="Completed"
          value={stats.completed.toString()}
          subtitle="Services finished"
        />
        <StatCard
          title="Left queue"
          value={stats.left_queue.toString()}
          subtitle="Abandonment today"
        />
        <StatCard
          title="Unpaid visits"
          value={stats.unpaid.toString()}
          subtitle="Awaiting payment"
        />
        <StatCard
          title="Orders awaiting payment"
          value={stats.orders_awaiting_payment.toString()}
          subtitle="Kiosk orders, not in queue"
        />
        <StatCard
          title="Approvals"
          value={stats.pending_approvals.toString()}
          subtitle="Require decision"
        />
      </div>

      {/* 3. WASH-HOLD WARNING ALERT */}
      {washHoldWarning && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl flex items-start gap-3">
          <Flame className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <span className="font-bold">Wash-hold warning in effect:</span> The blow-dry line has reached capacity with 3 or more tickets waiting. Hold new shampoo washes at the sinks until blow-dry stations clear to prevent hair drying out in waiting chairs.
          </div>
        </div>
      )}

      {/* 4. MAIN TWO-COLUMN WORKSPACE: LIVE QUEUE & ATTENDANCE SNAPSHOT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: LIVE QUEUE (8 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="shadow-xs border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Live Queue & Between-Services Monitor
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tickets currently waiting, in chair, or between multi-stage lines
                </p>
              </div>
              <Link
                href="/manager/queue"
                className="text-xs font-semibold text-[#1F4FD8] hover:underline flex items-center gap-1"
              >
                <span>Queue control</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="pt-4 divide-y divide-slate-100">
              {queue.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No active clients waiting or in service.
                </div>
              ) : (
                queue.map((item) => (
                  <div key={item.visit_id} className="py-3 flex items-start justify-between gap-4 first:pt-0 last:pb-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-bold text-base text-slate-900">
                          {item.ticket_code}
                        </span>
                        <span className="text-xs font-medium text-slate-700">
                          {item.customer_name}
                        </span>
                        <span
                          className={`text-[10px]  font-bold px-2 py-0.5 rounded-full ${
                            item.status === 'in_service'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.status === 'in_service' ? 'In Chair' : 'Waiting'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        {item.current_service_name} • Stylist: <span className="font-medium text-slate-800">{item.current_staff_name}</span>
                      </div>

                      {/* BETWEEN SERVICES ESCALATION PILL */}
                      {item.between_services && (
                        <div className="pt-1">
                          {item.flag === 'escalate' ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Between-services delay {formatDuration(item.between_services_minutes || 0)}: Reassign, bump priority or apologise</span>
                            </div>
                          ) : item.flag === 'warn' ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>Between services: {formatDuration(item.between_services_minutes || 0)} waiting for blow-dry</span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500">
                              Wash finished, waiting for blow-dry chair
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <Link href={`/manager/queue?highlight=${item.ticket_code}`}>
                        <Button variant="ghost" size="sm" className="text-xs h-7 text-slate-600 hover:text-slate-900">
                          Manage
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: ATTENDANCE SNAPSHOT & AUDIT ACTIVITY (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Attendance Snapshot Card */}
          <Card className="shadow-xs border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Attendance Snapshot</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Staff roster and presence today</p>
              </div>
              <Link
                href="/manager/staff"
                className="text-xs font-semibold text-[#1F4FD8] hover:underline flex items-center gap-1"
              >
                <span>Staff & admin</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <div className="text-center text-xs font-semibold text-slate-700 mb-2">
                  {attendance.present} of {attendance.total_expected} present
                </div>
                <div className="grid grid-cols-5 gap-1.5 text-center">
                  {[
                    ['Present', attendance.present],
                    ['On break', attendance.on_break],
                    ['Out', attendance.out],
                    ['Not present', attendance.not_present],
                    ['On leave', attendance.on_leave],
                  ].map(([label, count]) => (
                    <div key={label}>
                      <div className="text-sm font-bold text-slate-700">{count}</div>
                      <div className="text-[10px] text-slate-500 font-semibold">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1">
                {attendance.records.map((r) => (
                  <div key={r.user_id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-900">{r.display_name}</div>
                      <div className="text-[11px] text-slate-500 capitalize">{r.role}</div>
                    </div>
                    <AttendanceStatusChip
                      status={r.status}
                      leaveType={r.leave_type}
                      timeLabel={r.status === 'present' && r.clock_in_time
                        ? `In since ${new Date(r.clock_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' })}`
                        : r.status === 'on_break' && r.break_started_at
                        ? `Break since ${new Date(r.break_started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' })}`
                        : r.status === 'out' && r.clock_out_time
                        ? `Left ${new Date(r.clock_out_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' })}`
                        : undefined}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Operational Activity Card */}
          <Card className="shadow-xs border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Recent Activity</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Live operational event feed</p>
              </div>
              <Link
                href="/manager/reports"
                className="text-xs font-semibold text-[#1F4FD8] hover:underline flex items-center gap-1"
              >
                <span>Audit log</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="pt-3 divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {activity.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No recent audit activity logged.
                </div>
              ) : (
                activity.map((act) => (
                  <div key={act.id} className="py-2.5 text-xs first:pt-1 last:pb-1">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-slate-900">{act.action}</span>
                      <span className="text-[10px] text-slate-500 tabular-nums">{act.time_str}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      By <span className="font-medium text-slate-800">{act.actor}</span>
                      {act.reason && ` • "${act.reason}"`}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* OPEN DAY MODAL */}
      <OpenDayModal
        isOpen={openDayModalOpen}
        onClose={() => setOpenDayModalOpen(false)}
        onSuccess={() => refreshData()}
        role="manager"
      />
    </div>
  );
}
