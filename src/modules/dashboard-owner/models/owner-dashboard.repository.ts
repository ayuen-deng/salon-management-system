import { supabase, getServiceRoleClient } from '@/shared/lib/supabase';
import { Result, ok, fail } from '@/shared/models/result';
import { getUnifiedStaffAttendanceToday } from '@/shared/lib/attendance-presence';

export interface OwnerActivityVisitDetail {
  id: string;
  ticket_code: string;
  customer_name: string;
  status: 'queued' | 'in_service' | 'ready_for_checkout' | 'completed' | 'abandoned' | 'no_show';
  services: string[];
  stylist_name?: string;
  queued_at_str?: string;
  queued_at_iso?: string;
  started_at_str?: string;
  started_at_iso?: string;
  completed_at_str?: string;
  duration_minutes?: number;
  elapsed_minutes?: number;
  left_at_str?: string;
  is_paid: boolean;
}

export interface OwnerStaffAttendanceDetail {
  user_id: string;
  name: string;
  role: string;
  status: 'Present' | 'On break' | 'Out' | 'Not present' | 'On leave';
  clock_in_str?: string;
  clock_out_str?: string;
  break_started_str?: string;
  leave_type?: string;
}

export interface OwnerPaymentDetail {
  id: string;
  ticket_code: string;
  customer_name: string;
  time_str: string;
  method: 'cash' | 'mobile_money';
  amount_ugx: number;
  status: string; // 'recorded' | 'confirmed' | 'reconciled' | 'refunded'
  confirmation_level: string; // 'Awaiting manager reconciliation', 'Verified', etc.
  reference?: string;
}

export interface OwnerDashboardData {
  business_date: string;
  day_status: 'open' | 'closing' | 'closed' | 'not_opened';
  opened_at_str?: string;
  expected_open: string;
  last_activity_str: string;
  last_activity_iso: string;
  stale_unclosed_warning?: string;
  revenue_today_ugx: number;
  revenue_momo_ugx: number;
  revenue_cash_ugx: number;
  avg_same_weekday_ugx: number | null;
  comp_count: number;
  momo_verified_ugx: number;
  momo_awaiting_ugx: number;
  momo_verified_pct: number;
  activity: {
    waiting: number;
    in_service: number;
    completed: number;
    left_queue: number;
    no_show: number;
    avg_wait_minutes: number;
    longest_wait_minutes: number;
  };
  staff: {
    present: number;
    expected: number;
    on_break: number;
    out_count: number;
    not_present_count: number;
    on_leave_count: number;
  };
  details: {
    activity_visits: OwnerActivityVisitDetail[];
    staff_attendance: OwnerStaffAttendanceDetail[];
    payments: OwnerPaymentDetail[];
    momo_awaiting_payments: OwnerPaymentDetail[];
  };
  queue_snapshot: Array<{
    ticket_code: string;
    status: string;
    queued_time: string;
    customer_name: string;
  }>;
  review_items: Array<{
    id: string;
    category: string;
    title: string;
    actor: string;
    actor_role: string;
    time_str: string;
    full_datetime_str: string;
    at: string;
    reason: string;
    amount_ugx?: number;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    entity_type?: string;
    entity_id?: string;
    seen: boolean;
  }>;
  revenue_chart: Array<{
    day_label: string;
    amount_ugx: number;
  }>;
}

export class OwnerDashboardRepository {
  private locId = 'b0000000-0000-0000-0000-000000000001';

  async getDashboardSummary(): Promise<Result<OwnerDashboardData>> {
    try {
      const client = getServiceRoleClient();
      const now = new Date();
      const nowIso = now.toISOString();

      // Today's Kampala date (YYYY-MM-DD)
      const todayKampalaStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });

      // Check for any older business day that is still open
      const { data: staleOpenDays } = await client
        .from('business_day')
        .select('id, business_date, opened_at')
        .eq('location_id', this.locId)
        .eq('status', 'open')
        .lt('business_date', todayKampalaStr)
        .order('business_date', { ascending: false });

      let staleUnclosedWarning: string | undefined = undefined;
      if (staleOpenDays && staleOpenDays.length > 0) {
        const oldestStale = staleOpenDays[0];
        const staleDateObj = new Date(oldestStale.business_date);
        const staleFormatted = staleDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        staleUnclosedWarning = `The ${staleFormatted} day was never closed.`;
      }

      // 1. Get today's business day strictly by todayKampalaStr
      const { data: todayDayRows } = await client
        .from('business_day')
        .select('*')
        .eq('location_id', this.locId)
        .eq('business_date', todayKampalaStr)
        .limit(1);

      const activeDay = todayDayRows?.[0] || null;
      const businessDate = todayKampalaStr;
      const dayStatus = (activeDay?.status || 'not_opened') as OwnerDashboardData['day_status'];

      let openedAtStr: string | undefined = undefined;
      if (activeDay?.opened_at) {
        const d = new Date(activeDay.opened_at);
        openedAtStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' });
      }

      // 2. Payments today
      let momoRev = 0;
      let cashRev = 0;
      let refunds = 0;
      let momoVerified = 0;
      let momoAwaiting = 0;
      const paymentDetails: OwnerPaymentDetail[] = [];
      const momoAwaitingDetails: OwnerPaymentDetail[] = [];

      if (activeDay) {
        const { data: payments } = await client
          .from('payment')
          .select(`
            id, amount_ugx, method, status, created_at,
            visit:visit_id (ticket_code, customer:customer_id(first_name))
          `)
          .eq('business_day_id', activeDay.id)
          .order('created_at', { ascending: false });

        for (const p of payments || []) {
          const amt = Number(p.amount_ugx) || 0;
          const visitObj = p.visit as unknown as { ticket_code?: string; customer?: { first_name?: string } } | null;
          const ticketCode = visitObj?.ticket_code || 'Direct';
          const custName = visitObj?.customer?.first_name || 'Walk-in';
          const pTime = p.created_at
            ? new Date(p.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' })
            : '';

          const isVerified = ['confirmed', 'reconciled'].includes(p.status);
          const confirmationLevel = p.method === 'cash'
            ? 'Counted at day close'
            : isVerified
            ? 'Verified with statement'
            : 'Awaiting manager reconciliation';

          const detailItem: OwnerPaymentDetail = {
            id: p.id,
            ticket_code: ticketCode,
            customer_name: custName,
            time_str: pTime,
            method: p.method as 'cash' | 'mobile_money',
            amount_ugx: amt,
            status: p.status,
            confirmation_level: confirmationLevel,
          };

          if (p.status === 'refunded') {
            refunds += amt;
          } else if (['recorded', 'confirmed', 'reconciled'].includes(p.status)) {
            paymentDetails.push(detailItem);
            if (p.method === 'mobile_money') {
              momoRev += amt;
              if (isVerified) {
                momoVerified += amt;
              } else {
                momoAwaiting += amt;
                momoAwaitingDetails.push(detailItem);
              }
            } else if (p.method === 'cash') {
              cashRev += amt;
            }
          }
        }
      }

      const totalRevenue = Math.max(0, momoRev + cashRev - refunds);
      const momoTotal = momoVerified + momoAwaiting;
      const momoVerifiedPct = momoTotal > 0 ? Math.round((momoVerified / momoTotal) * 100) : 0;

      // 3. Same-weekday 4-week comparison
      const dayOfWeek = new Date(businessDate).getDay();
      const { data: closedDays } = await client
        .from('business_day')
        .select('id, business_date')
        .eq('location_id', this.locId)
        .eq('status', 'closed')
        .lt('business_date', businessDate)
        .order('business_date', { ascending: false });

      const sameWeekdayDays = (closedDays || [])
        .filter((d) => new Date(d.business_date).getDay() === dayOfWeek)
        .slice(0, 4);

      let avgSameWeekday: number | null = null;
      if (sameWeekdayDays.length > 0) {
        const ids = sameWeekdayDays.map((d) => d.id);
        const { data: histPayments } = await client
          .from('payment')
          .select('amount_ugx, business_day_id')
          .in('business_day_id', ids)
          .in('status', ['recorded', 'confirmed', 'reconciled']);

        const totalHist = (histPayments || []).reduce((sum, p) => sum + Number(p.amount_ugx), 0);
        avgSameWeekday = Math.round(totalHist / sameWeekdayDays.length);
      }

      // 4. Salon Activity & Detail Rows
      let waiting = 0;
      let inService = 0;
      let completed = 0;
      let leftQueue = 0;
      const activityVisits: OwnerActivityVisitDetail[] = [];
      const waitDurations: number[] = [];

      if (activeDay) {
        const { data: visits } = await client
          .from('visit')
          .select(`
            id, ticket_code, status, queued_at, completed_at, created_at,
            customer:customer_id (first_name),
            visit_service_line (
              id, status, started_at, completed_at,
              service:service_id (name),
              assigned_staff:assigned_staff_user_id (display_name)
            ),
            payment (id, status)
          `)
          .eq('business_day_id', activeDay.id)
          .order('queued_at', { ascending: true });

        for (const v of visits || []) {
          const cust = v.customer as unknown as { first_name?: string } | null;
          const lines = (v.visit_service_line || []) as Array<{
            id: string;
            status: string;
            started_at?: string;
            completed_at?: string;
            service?: { name?: string };
            assigned_staff?: { display_name?: string };
          }>;
          const serviceNames = lines.map((l) => l.service?.name).filter(Boolean) as string[];
          const assignedStaff = lines.map((l) => l.assigned_staff?.display_name).filter(Boolean);
          const stylistStr = assignedStaff.length > 0 ? assignedStaff.join(', ') : 'Unassigned';

          // Check if paid (payment-first rule)
          const payments = (v.payment || []) as Array<{ id: string; status: string }>;
          const isPaid = payments.some((p) => ['recorded', 'confirmed', 'reconciled'].includes(p.status));

          // Time formatting
          const queuedAtStr = v.queued_at
            ? new Date(v.queued_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' })
            : undefined;

          let startedAtStr: string | undefined;
          let elapsedMins: number | undefined;
          const firstStartedLine = lines.find((l) => l.started_at);
          if (firstStartedLine?.started_at) {
            startedAtStr = new Date(firstStartedLine.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' });
            elapsedMins = Math.max(0, Math.round((now.getTime() - new Date(firstStartedLine.started_at).getTime()) / 60000));
          }

          let completedAtStr: string | undefined;
          let durationMins: number | undefined;
          if (v.completed_at) {
            completedAtStr = new Date(v.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' });
            if (v.queued_at) {
              durationMins = Math.max(0, Math.round((new Date(v.completed_at).getTime() - new Date(v.queued_at).getTime()) / 60000));
            }
          }

          // Compute wait time for queued customers
          if (v.status === 'queued' && v.queued_at) {
            const waitMin = Math.max(0, Math.round((now.getTime() - new Date(v.queued_at).getTime()) / 60000));
            waitDurations.push(waitMin);
          }

          if (v.status === 'queued') waiting++;
          else if (v.status === 'in_service') inService++;
          else if (['ready_for_checkout', 'completed'].includes(v.status)) completed++;
          else if (v.status === 'abandoned') leftQueue++;

          activityVisits.push({
            id: v.id,
            ticket_code: v.ticket_code,
            customer_name: cust?.first_name || 'Walk-in',
            status: v.status as OwnerActivityVisitDetail['status'],
            services: serviceNames.length > 0 ? serviceNames : ['Service'],
            stylist_name: stylistStr,
            queued_at_str: queuedAtStr,
            queued_at_iso: v.queued_at || undefined,
            started_at_str: startedAtStr,
            started_at_iso: firstStartedLine?.started_at || undefined,
            completed_at_str: completedAtStr,
            duration_minutes: durationMins,
            elapsed_minutes: elapsedMins,
            left_at_str: v.status === 'abandoned' ? completedAtStr || queuedAtStr : undefined,
            is_paid: isPaid,
          });
        }
      }

      // No-show count & rows
      const { data: noShowAppointments } = await client
        .from('appointment')
        .select(`
          id, scheduled_time, duration_minutes,
          customer:customer_id(first_name),
          service:service_id(name),
          staff:staff_user_id(display_name)
        `)
        .eq('location_id', this.locId)
        .eq('status', 'no_show');

      for (const ns of noShowAppointments || []) {
        const cust = ns.customer as unknown as { first_name?: string } | null;
        const srv = ns.service as unknown as { name?: string } | null;
        const stf = ns.staff as unknown as { display_name?: string } | null;
        const timePart = ns.scheduled_time
          ? new Date(ns.scheduled_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' })
          : undefined;

        activityVisits.push({
          id: ns.id,
          ticket_code: 'APPT',
          customer_name: cust?.first_name || 'Booked Guest',
          status: 'no_show',
          services: srv?.name ? [srv.name] : ['Appointment'],
          stylist_name: stf?.display_name || 'Assigned Staff',
          queued_at_str: timePart,
          is_paid: false,
        });
      }

      const avgWait = waitDurations.length > 0 ? Math.round(waitDurations.reduce((a, b) => a + b, 0) / waitDurations.length) : 0;
      const maxWait = waitDurations.length > 0 ? Math.max(...waitDurations) : 0;

      // 5. Staff Attendance & Details (Single Source of Truth)
      const unifiedAttRes = await getUnifiedStaffAttendanceToday(businessDate);
      const unifiedAtt = unifiedAttRes.success
        ? unifiedAttRes.data
        : {
            businessDate,
            totalExpected: 7,
            presentCount: 0,
            onBreakCount: 0,
            outCount: 0,
            notPresentCount: 0,
            onLeaveCount: 0,
            staff: [],
          };

      const staffAttendanceDetails: OwnerStaffAttendanceDetail[] = [];

      for (const s of unifiedAtt.staff) {
        let statusDisplay: OwnerStaffAttendanceDetail['status'] = 'Not present';
        switch (s.status) {
          case 'present':
            statusDisplay = 'Present';
            break;
          case 'on_break':
            statusDisplay = 'On break';
            break;
          case 'out':
            statusDisplay = 'Out';
            break;
          case 'not_present':
            statusDisplay = 'Not present';
            break;
          case 'on_leave':
            statusDisplay = 'On leave';
            break;
        }

        staffAttendanceDetails.push({
          user_id: s.userId,
          name: s.displayName,
          role: s.role,
          status: statusDisplay,
          clock_in_str: s.clockInTimeStr,
          clock_out_str: s.clockOutTimeStr,
          break_started_str: s.breakStartedAtStr,
          leave_type: s.leaveType,
        });
      }

      // Keep the people currently in the salon at the top of the roster.
      const statusPriority: Record<string, number> = {
        Present: 1,
        'On break': 2,
        Out: 3,
        'Not present': 4,
        'On leave': 5,
      };
      staffAttendanceDetails.sort((a, b) => (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99));

      // 6. Live Queue Snapshot
      let queueSnapshot: OwnerDashboardData['queue_snapshot'] = [];
      if (activeDay) {
        const { data: liveVisits } = await client
          .from('visit')
          .select('ticket_code, status, queued_at, customer(first_name)')
          .eq('business_day_id', activeDay.id)
          .in('status', ['queued', 'in_service', 'ready_for_checkout'])
          .order('queued_at', { ascending: true })
          .limit(10);

        queueSnapshot = (liveVisits || []).map((v) => {
          const cust = v.customer as unknown as { first_name?: string } | null;
          const qTime = v.queued_at
            ? new Date(v.queued_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' })
            : '';
          return {
            ticket_code: v.ticket_code,
            status: v.status,
            queued_time: qTime,
            customer_name: cust?.first_name || 'Walk-in',
          };
        });
      }

      // 7. Last Activity Time (Always displays date if not today)
      const { data: lastAudit } = await client
        .from('audit_log')
        .select('at')
        .lte('at', nowIso)
        .order('at', { ascending: false })
        .limit(1);

      let lastActivityIso = lastAudit?.[0]?.at || nowIso;
      if (new Date(lastActivityIso).getTime() > now.getTime()) {
        lastActivityIso = nowIso;
      }
      const lastActivityDate = new Date(lastActivityIso);
      const lastActivityDateStr = lastActivityDate.toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
      const timePart = lastActivityDate.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Kampala',
      });
      const lastActivityStr = lastActivityDateStr === todayKampalaStr
        ? timePart
        : `${lastActivityDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${timePart}`;

      // 8. "For Your Review" Items
      const { data: reviewLogs } = await client
        .from('audit_log')
        .select('id, action, reason, actor_role, at, entity_type, entity_id, before, after, app_user(display_name)')
        .neq('actor_role', 'owner')
        .order('at', { ascending: false })
        .limit(30);

      const { data: seenRows } = await client
        .from('owner_review_seen')
        .select('entity_id');

      const seenSet = new Set((seenRows || []).map((s) => s.entity_id));
      const reviewItems: OwnerDashboardData['review_items'] = [];

      for (const al of reviewLogs || []) {
        const action = al.action.toUpperCase();
        let category: string | null = null;

        if (action.includes('CSV_IMPORT') || action.includes('CATALOGUE') || action.includes('PRICE')) {
          category = 'Price change';
        } else if (action.includes('DISCOUNT')) {
          category = 'Discount';
        } else if (action.includes('REFUND')) {
          category = 'Refund';
        } else if (action.includes('VOID')) {
          category = 'Void';
        } else if (action.includes('COMPLIMENTARY')) {
          category = 'Complimentary';
        } else if (action.includes('WRITE_OFF')) {
          category = 'Write-off';
        } else if (action.includes('REOPEN') || action.includes('UNDO_CLOSE')) {
          category = 'Reopened day';
        } else if (action.includes('CORRECTION') || action.includes('ADJUST_LINE')) {
          category = 'Correction';
        } else if (action.includes('EXPORT')) {
          category = 'Export';
        } else if (action.includes('HR') || action.includes('LEAVE') || action.includes('ROTA')) {
          category = 'HR';
        }

        if (!category) continue;

        const userObj = al.app_user as unknown as { display_name?: string } | null;
        const actorName = userObj?.display_name || al.actor_role;
        const dt = new Date(al.at);
        const tStr = dt.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Africa/Kampala',
        });
        const fullDateTimeStr = dt.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Africa/Kampala',
        });

        let amountUgx: number | undefined;
        if (al.after?.amount_ugx) amountUgx = Number(al.after.amount_ugx);
        else if (al.after?.discount_ugx) amountUgx = Number(al.after.discount_ugx);
        else if (al.after?.total_final_ugx) amountUgx = Number(al.after.total_final_ugx);

        reviewItems.push({
          id: String(al.id),
          category,
          title: al.reason || al.action,
          actor: actorName,
          actor_role: al.actor_role,
          time_str: tStr,
          full_datetime_str: fullDateTimeStr,
          at: al.at,
          reason: al.reason || 'No reason provided',
          amount_ugx: amountUgx,
          before: (al.before as Record<string, unknown>) || undefined,
          after: (al.after as Record<string, unknown>) || undefined,
          entity_type: al.entity_type,
          entity_id: al.entity_id,
          seen: seenSet.has(String(al.id)),
        });
      }

      // 9. Revenue Chart (Past 7 Days)
      const revenueChart: OwnerDashboardData['revenue_chart'] = [];
      const d = new Date(businessDate);
      for (let i = 6; i >= 0; i--) {
        const targetDate = new Date(d);
        targetDate.setDate(d.getDate() - i);
        const dateStr = targetDate.toISOString().split('T')[0];
        const dayLabel = targetDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

        const { data: dayObj } = await client
          .from('business_day')
          .select('id')
          .eq('location_id', this.locId)
          .eq('business_date', dateStr)
          .maybeSingle();

        let dayTotal = 0;
        if (dayObj) {
          const { data: pList } = await client
            .from('payment')
            .select('amount_ugx')
            .eq('business_day_id', dayObj.id)
            .in('status', ['recorded', 'confirmed', 'reconciled']);

          dayTotal = (pList || []).reduce((sum, p) => sum + Number(p.amount_ugx), 0);
        }

        revenueChart.push({ day_label: dayLabel, amount_ugx: dayTotal });
      }

      return ok({
        business_date: businessDate,
        day_status: dayStatus,
        opened_at_str: openedAtStr,
        expected_open: '08:00',
        last_activity_str: lastActivityStr,
        last_activity_iso: lastActivityIso,
        stale_unclosed_warning: staleUnclosedWarning,
        revenue_today_ugx: totalRevenue,
        revenue_momo_ugx: momoRev,
        revenue_cash_ugx: cashRev,
        avg_same_weekday_ugx: avgSameWeekday,
        comp_count: sameWeekdayDays.length,
        momo_verified_ugx: momoVerified,
        momo_awaiting_ugx: momoAwaiting,
        momo_verified_pct: momoVerifiedPct,
        activity: {
          waiting,
          in_service: inService,
          completed,
          left_queue: leftQueue,
          no_show: (noShowAppointments || []).length,
          avg_wait_minutes: avgWait,
          longest_wait_minutes: maxWait,
        },
        staff: {
          present: unifiedAtt.presentCount,
          expected: unifiedAtt.totalExpected,
          on_break: unifiedAtt.onBreakCount,
          out_count: unifiedAtt.outCount,
          not_present_count: unifiedAtt.notPresentCount,
          on_leave_count: unifiedAtt.onLeaveCount,
        },
        details: {
          activity_visits: activityVisits,
          staff_attendance: staffAttendanceDetails,
          payments: paymentDetails,
          momo_awaiting_payments: momoAwaitingDetails,
        },
        queue_snapshot: queueSnapshot,
        review_items: reviewItems,
        revenue_chart: revenueChart,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error generating owner summary';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async markReviewItemSeen(itemId: string, ownerId: string): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      await client.from('owner_review_seen').upsert(
        {
          entity_type: 'audit_log',
          entity_id: itemId,
          seen_by: ownerId,
          seen_at: new Date().toISOString(),
        },
        { onConflict: 'entity_type,entity_id,seen_by' }
      );

      await client.from('audit_log').insert({
        actor_id: ownerId,
        actor_role: 'owner',
        action: 'ACKNOWLEDGE_REVIEW_ITEM',
        entity_type: 'audit_log',
        entity_id: itemId,
        reason: 'Owner marked item as seen from Kampala monitor',
        category: 'access',
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark seen';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async markAllReviewItemsSeen(itemIds: string[], ownerId: string): Promise<Result<{ count: number }>> {
    try {
      const client = getServiceRoleClient();
      const records = itemIds.map((id) => ({
        entity_type: 'audit_log',
        entity_id: id,
        seen_by: ownerId,
        seen_at: new Date().toISOString(),
      }));

      await client
        .from('owner_review_seen')
        .upsert(records, { onConflict: 'entity_type,entity_id,seen_by' });

      await client.from('audit_log').insert({
        actor_id: ownerId,
        actor_role: 'owner',
        action: 'ACKNOWLEDGE_ALL_REVIEW_ITEMS',
        entity_type: 'audit_log',
        entity_id: 'batch',
        reason: `Owner marked ${itemIds.length} review items as seen from Kampala monitor`,
        category: 'access',
        after: { item_count: itemIds.length },
      });

      return ok({ count: itemIds.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark all seen';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }
}
