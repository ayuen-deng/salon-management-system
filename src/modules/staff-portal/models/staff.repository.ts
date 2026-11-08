import { getServiceRoleClient } from '@/shared/lib/supabase';
import { ok, fail, type Result } from '@/shared/models/result';
import { normalizeCustomerName } from '@/shared/lib/normalize-name';

function cleanFirstName(name: string | null | undefined): string {
  if (!name) return 'Guest';
  const normalized = normalizeCustomerName(name);
  const first = normalized.trim().split(/\s+/)[0];
  return first || 'Guest';
}

export interface StaffQueueItem {
  lineId: string;
  visitId: string;
  ticketCode: string;
  customerFirstName: string;
  serviceName: string;
  variantName: string;
  status: 'in_progress' | 'ready' | 'blocked';
  sequenceNo: number;
  readyAt: string | null;
  startedAt: string | null;
  expectedReadyAt: string | null;
  source: 'mine' | 'pool';
}

export interface StaffAppointmentItem {
  id: string;
  startsAt: string;
  expectedMinutes: number;
  status: string;
  late: boolean;
  customerFirstName: string;
  serviceName: string;
}

export interface StaffTargetInfo {
  targetCustomers: number;
  currentCustomers: number;
  period: 'weekly' | 'monthly' | '3-month';
  deadline: string;
  percentComplete: number;
  paceNote?: string;
}

export interface StaffLeaveRequest {
  id: string;
  from_date: string;
  to_date: string;
  leave_type: 'annual_leave' | 'unpaid_leave' | 'other_approved_leave';
  status: 'requested' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
  decided_at: string | null;
}

export interface StaffLeaveBalance {
  leave_year_start: string;
  entitlement_days: number | null;
  days_taken: number;
  days_approved_upcoming: number;
  days_pending: number;
  days_remaining: number | null;
}

export interface StaffLeavePreview {
  working_days: number;
  overlaps_existing: boolean;
  entitlement_days: number | null;
  days_taken: number;
  days_approved_upcoming: number;
  days_pending: number;
  days_remaining: number | null;
  exceeds_balance: boolean;
}

export interface StaffPortalState {
  staffUserId: string;
  displayName: string;
  attendanceStatus: 'in' | 'break' | 'out';
  now: StaffQueueItem | null; // At most one in-progress
  next: StaffQueueItem[];     // Own ready + pool ready matching skills
  comingUp: StaffQueueItem[]; // Blocked lines with expectedReadyAt
  totalCustomersServed: number; // Historical unique customers worked on
  todayAppointments: StaffAppointmentItem[]; // Assigned bookings with date & details
  targetInfo: StaffTargetInfo | null; // Manager customer target & progress
}

export class StaffRepository {
  async getMyLeaveData(staffUserId: string): Promise<Result<{ balance: StaffLeaveBalance | null; requests: StaffLeaveRequest[] }>> {
    try {
      const client = getServiceRoleClient();
      const [{ data: balance, error: balanceError }, { data: requests, error: requestsError }] = await Promise.all([
        client.from('hr_leave_balance').select('leave_year_start,entitlement_days,days_taken,days_approved_upcoming,days_pending,days_remaining').eq('staff_user_id', staffUserId).maybeSingle(),
        client.from('leave_request').select('id,from_date,to_date,leave_type,status,created_at,decided_at').eq('staff_user_id', staffUserId).order('from_date', { ascending: false }),
      ]);
      if (balanceError) return fail({ code: 'INTERNAL_ERROR', message: balanceError.message });
      if (requestsError) return fail({ code: 'INTERNAL_ERROR', message: requestsError.message });
      const normalizedBalance = balance ? {
        ...balance,
        entitlement_days: balance.entitlement_days === null ? null : Number(balance.entitlement_days),
        days_taken: Number(balance.days_taken), days_approved_upcoming: Number(balance.days_approved_upcoming), days_pending: Number(balance.days_pending),
        days_remaining: balance.days_remaining === null ? null : Number(balance.days_remaining),
      } as StaffLeaveBalance : null;
      return ok({ balance: normalizedBalance, requests: (requests || []) as StaffLeaveRequest[] });
    } catch (error) {
      return fail({ code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Could not load leave data.' });
    }
  }

  async previewMyLeaveRequest(staffUserId: string, fromDate: string, toDate: string, leaveType: StaffLeaveRequest['leave_type']): Promise<Result<StaffLeavePreview>> {
    try {
      const { data, error } = await getServiceRoleClient().rpc('preview_my_leave_request', { p_staff_user_id: staffUserId, p_from_date: fromDate, p_to_date: toDate, p_leave_type: leaveType });
      if (error) return fail({ code: 'VALIDATION_ERROR', message: error.message });
      return ok(data as StaffLeavePreview);
    } catch (error) { return fail({ code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Could not estimate leave days.' }); }
  }

  async requestMyLeave(staffUserId: string, fromDate: string, toDate: string, leaveType: StaffLeaveRequest['leave_type']): Promise<Result<StaffLeavePreview & { success: true; request_id: string }>> {
    try {
      const { data, error } = await getServiceRoleClient().rpc('request_my_leave', { p_staff_user_id: staffUserId, p_from_date: fromDate, p_to_date: toDate, p_leave_type: leaveType });
      if (error) return fail({ code: 'VALIDATION_ERROR', message: error.message });
      return ok(data as StaffLeavePreview & { success: true; request_id: string });
    } catch (error) { return fail({ code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Could not submit leave request.' }); }
  }

  async cancelMyLeaveRequest(staffUserId: string, leaveId: string): Promise<Result<{ success: true }>> {
    try {
      const { data, error } = await getServiceRoleClient().rpc('cancel_my_leave_request', { p_staff_user_id: staffUserId, p_leave_id: leaveId });
      if (error) return fail({ code: 'VALIDATION_ERROR', message: error.message });
      return ok(data as { success: true });
    } catch (error) { return fail({ code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Could not cancel leave request.' }); }
  }

  async getStaffPortalQueue(staffUserId: string): Promise<Result<StaffPortalState>> {
    try {
      const client = getServiceRoleClient();
      const todayDate = new Date().toISOString().split('T')[0];

      // 1. Fetch staff profile (name only, no earnings or admin data)
      const { data: user, error: uErr } = await client
        .from('app_user')
        .select('id, display_name, full_name, role')
        .eq('id', staffUserId)
        .single();

      if (uErr || !user) {
        return fail({ code: 'NOT_FOUND', message: 'Staff profile not found' });
      }

      // 2. Attendance Status from database
      const { data: att } = await client
        .from('attendance')
        .select('clock_in, clock_out, on_break')
        .eq('staff_user_id', staffUserId)
        .eq('business_date', todayDate)
        .maybeSingle();

      let attendanceStatus: 'in' | 'break' | 'out' = 'out';
      if (att) {
        if (att.clock_out) attendanceStatus = 'out';
        else if (att.on_break) attendanceStatus = 'break';
        else if (att.clock_in) attendanceStatus = 'in';
      }

      // 3. Active open business day
      const { data: bday } = await client
        .from('business_day')
        .select('id')
        .eq('status', 'open')
        .order('business_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Lifetime unique customer visits
      const { data: doneLines } = await client
        .from('visit_service')
        .select('visit_id')
        .eq('staff_user_id', staffUserId)
        .eq('status', 'done');
      const uniqueVisits = new Set((doneLines || []).map((d: any) => d.visit_id));

      // Fetch target info
      const { data: targetsSetting } = await client
        .from('app_setting')
        .select('value')
        .eq('key', 'staff_targets')
        .maybeSingle();

      const targetsMap: Record<string, any> = (targetsSetting?.value as any) || {};
      const staffTarget = targetsMap[staffUserId];

      let targetInfo: StaffTargetInfo | null = null;
      if (staffTarget) {
        const goal = staffTarget.target_customers || 1;
        const current = uniqueVisits.size;
        const percent = Math.min(100, Math.round((current / goal) * 100));

        let paceNote = 'On track';
        if (percent >= 100) {
          paceNote = 'Target achieved!';
        } else if (percent < 40) {
          paceNote = 'Behind pace - focus on active hours';
        } else if (percent < 80) {
          paceNote = 'Steady progress';
        }

        targetInfo = {
          targetCustomers: goal,
          currentCustomers: current,
          period: staffTarget.period || 'monthly',
          deadline: staffTarget.deadline || '',
          percentComplete: percent,
          paceNote,
        };
      }

      if (!bday) {
        return ok({
          staffUserId,
          displayName: user.display_name || user.full_name,
          attendanceStatus,
          now: null,
          next: [],
          comingUp: [],
          totalCustomersServed: uniqueVisits.size,
          todayAppointments: [],
          targetInfo,
        });
      }

      // 4. Staff skills for pool matching
      const { data: skills } = await client
        .from('staff_skill')
        .select('service_id')
        .eq('staff_user_id', staffUserId);

      const skillSet = new Set((skills || []).map((s) => s.service_id));

      // Also fetch all services that have at least one assigned skill
      const { data: allAssignedSkills } = await client
        .from('staff_skill')
        .select('service_id');
      const servicesWithAssignments = new Set((allAssignedSkills || []).map((s) => s.service_id));

      // 5. Query active lines for today's visits
      const { data: lines, error: lErr } = await client
        .from('visit_service')
        .select(`
          id, visit_id, sequence_no, status, ready_at, started_at, staff_user_id,
          service_variant:service_variant(
            id, name, expected_minutes,
            service:service(id, name)
          ),
          visit:visit!inner(
            id, ticket_code, status, queued_at, business_day_id,
            customer:customer(first_name)
          )
        `)
        .eq('visit.business_day_id', bday.id)
        .in('visit.status', ['in_service', 'queued'])
        .in('status', ['in_progress', 'ready', 'blocked'])
        .order('sequence_no', { ascending: true });

      if (lErr) {
        return fail({ code: 'INTERNAL_ERROR', message: lErr.message });
      }

      let nowItem: StaffQueueItem | null = null;
      const myReady: StaffQueueItem[] = [];
      const poolReady: StaffQueueItem[] = [];
      const comingUp: StaffQueueItem[] = [];

      (lines || []).forEach((l: any) => {
        const isMine = l.staff_user_id === staffUserId;
        const isPool = !l.staff_user_id;
        const serviceId = l.service_variant?.service?.id;
        // Prompt 19 rule: A person is eligible if they hold a skill for the service.
        // If a service has no staff assigned at all, any clocked-in staff member is eligible.
        const serviceHasNoAssignments = !servicesWithAssignments.has(serviceId);
        const hasSkill = isPool ? (serviceHasNoAssignments || skillSet.has(serviceId)) : true;

        if (!isMine && !isPool) return; // assigned to another stylist

        const item: StaffQueueItem = {
          lineId: l.id,
          visitId: l.visit.id,
          ticketCode: l.visit.ticket_code || 'TKT',
          customerFirstName: cleanFirstName(l.visit.customer?.first_name),
          serviceName: l.service_variant?.service?.name || 'Service',
          variantName: l.service_variant?.name || 'Standard',
          status: l.status,
          sequenceNo: l.sequence_no,
          readyAt: l.ready_at,
          startedAt: l.started_at,
          expectedReadyAt: null,
          source: isMine ? 'mine' : 'pool',
        };

        if (isMine && l.status === 'in_progress' && !nowItem) {
          nowItem = item;
        } else if (l.status === 'ready') {
          if (isMine) {
            myReady.push(item);
          } else if (isPool && hasSkill) {
            poolReady.push(item);
          }
        } else if (l.status === 'blocked' && (isMine || (isPool && hasSkill))) {
          // Calculate expected ready time
          const estimatedMin = 15;
          const expTime = new Date(Date.now() + estimatedMin * 60000).toISOString();
          item.expectedReadyAt = expTime;
          comingUp.push(item);
        }
      });

      // Limit pool items to top 3 longest waiting
      const topPool = poolReady.slice(0, 3);
      const nextList = [...myReady, ...topPool];

      const totalCustomersServed = uniqueVisits.size;

      // 9. Staff's appointments (bookings assigned to this stylist)
      const { data: appts } = await client
        .from('appointment')
        .select(`
          id, starts_at, expected_minutes, status, late,
          customer:customer(first_name),
          service:service(name)
        `)
        .eq('staff_user_id', staffUserId)
        .order('starts_at', { ascending: true });

      const todayAppointments: StaffAppointmentItem[] = (appts || []).map((a: any) => ({
        id: a.id,
        startsAt: a.starts_at,
        expectedMinutes: a.expected_minutes || 30,
        status: a.status,
        late: a.late,
        customerFirstName: cleanFirstName(a.customer?.first_name),
        serviceName: a.service?.name || 'Service',
      }));

      return ok({
        staffUserId,
        displayName: user.display_name || user.full_name,
        attendanceStatus,
        now: nowItem,
        next: nextList,
        comingUp,
        totalCustomersServed,
        todayAppointments,
        targetInfo,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error loading staff queue';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async startLine(lineId: string, actorUserId: string): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const now = new Date().toISOString();
      const todayDate = now.split('T')[0];

      // 1. Clock-in rule
      const { data: att } = await client
        .from('attendance')
        .select('clock_in, clock_out, on_break')
        .eq('staff_user_id', actorUserId)
        .eq('business_date', todayDate)
        .maybeSingle();

      if (!att || !att.clock_in || att.clock_out || att.on_break) {
        return fail({ code: 'FORBIDDEN', message: "Tap I'm in first" });
      }

      // 2. One active line rule
      const { count: activeCount } = await client
        .from('visit_service')
        .select('id', { count: 'exact', head: true })
        .eq('staff_user_id', actorUserId)
        .eq('status', 'in_progress');

      if (activeCount && activeCount > 0) {
        return fail({ code: 'CONFLICT', message: 'Finish your current service first' });
      }

      // 3. Fetch line details
      const { data: line, error: lErr } = await client
        .from('visit_service')
        .select('id, visit_id, sequence_no, status, staff_user_id')
        .eq('id', lineId)
        .single();

      if (lErr || !line) {
        return fail({ code: 'NOT_FOUND', message: 'Service line not found' });
      }

      // 4. Atomic pool claim / ownership check
      if (line.staff_user_id && line.staff_user_id !== actorUserId) {
        return fail({ code: 'FORBIDDEN', message: 'This line is assigned to another team member' });
      }

      if (line.status === 'in_progress' && line.staff_user_id === actorUserId) {
        return ok({ success: true });
      }

      // 5. Sequence rule: previous sequential line must be done
      if (line.sequence_no > 1) {
        const { data: prevLine } = await client
          .from('visit_service')
          .select('id, status, sequence_no')
          .eq('visit_id', line.visit_id)
          .eq('sequence_no', line.sequence_no - 1)
          .maybeSingle();

        if (prevLine && prevLine.status !== 'done' && prevLine.status !== 'skipped' && prevLine.status !== 'cancelled') {
          return fail({
            code: 'FORBIDDEN',
            message: 'Earlier step not finished',
          });
        }
      }

      // 6. Atomic claim and update
      const { error: updErr, count } = await client
        .from('visit_service')
        .update({
          status: 'in_progress',
          staff_user_id: actorUserId,
          started_at: now,
        })
        .eq('id', lineId)
        .in('status', ['ready', 'in_progress']);

      if (updErr) {
        return fail({ code: 'INTERNAL_ERROR', message: updErr.message });
      }

      // 7. Ensure visit status is in_service
      await client
        .from('visit')
        .update({ status: 'in_service', updated_at: now })
        .eq('id', line.visit_id);

      // 8. Audit log
      await client.from('audit_log').insert({
        organization_id: 'a0000000-0000-0000-0000-000000000001',
        location_id: 'b0000000-0000-0000-0000-000000000001',
        actor_id: actorUserId,
        actor_role: 'staff',
        action: 'LINE_STARTED',
        entity_type: 'visit_service',
        entity_id: lineId,
        category: 'operations',
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start service line';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async finishLine(lineId: string, actorUserId: string): Promise<Result<{ success: boolean; visitReadyForCheckout: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const now = new Date().toISOString();

      const { data: line, error: lErr } = await client
        .from('visit_service')
        .select('id, visit_id, sequence_no, status, staff_user_id')
        .eq('id', lineId)
        .single();

      if (lErr || !line) {
        return fail({ code: 'NOT_FOUND', message: 'Service line not found' });
      }

      if (line.staff_user_id !== actorUserId) {
        return fail({ code: 'FORBIDDEN', message: 'Only the assigned staff member can complete this service line' });
      }

      // 1. Mark line done (releases station and staff)
      await client
        .from('visit_service')
        .update({ status: 'done', ended_at: now })
        .eq('id', lineId);

      // 2. Check for next sequential line
      const { data: nextLine } = await client
        .from('visit_service')
        .select('id, status')
        .eq('visit_id', line.visit_id)
        .eq('sequence_no', line.sequence_no + 1)
        .maybeSingle();

      let visitReadyForCheckout = false;

      if (nextLine) {
        if (nextLine.status === 'blocked') {
          await client
            .from('visit_service')
            .update({ status: 'ready', ready_at: now })
            .eq('id', nextLine.id);
        }
      } else {
        const { data: remainingLines } = await client
          .from('visit_service')
          .select('id')
          .eq('visit_id', line.visit_id)
          .not('status', 'in', '("done","cancelled","skipped")');

        if (!remainingLines || remainingLines.length === 0) {
          // Check if visit has payments
          const { data: payRecords } = await client
            .from('payment')
            .select('id, amount_ugx, status')
            .eq('visit_id', line.visit_id)
            .in('status', ['confirmed', 'recorded', 'reconciled']);

          const hasConfirmedPayment = payRecords && payRecords.length > 0;

          await client
            .from('visit')
            .update({
              status: hasConfirmedPayment ? 'paid' : 'payment_pending',
              updated_at: now,
            })
            .eq('id', line.visit_id);

          visitReadyForCheckout = false;
        }
      }

      // 3. Audit log
      await client.from('audit_log').insert({
        organization_id: 'a0000000-0000-0000-0000-000000000001',
        location_id: 'b0000000-0000-0000-0000-000000000001',
        actor_id: actorUserId,
        actor_role: 'staff',
        action: 'LINE_FINISHED',
        entity_type: 'visit_service',
        entity_id: lineId,
        category: 'operations',
      });

      return ok({ success: true, visitReadyForCheckout });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to complete service line';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async undoAction(lineId: string, actorUserId: string): Promise<Result<{ success: boolean; revertedTo: string }>> {
    try {
      const client = getServiceRoleClient();
      const now = new Date();

      const { data: line, error: lErr } = await client
        .from('visit_service')
        .select('id, visit_id, sequence_no, status, staff_user_id, started_at, ended_at')
        .eq('id', lineId)
        .single();

      if (lErr || !line) return fail({ code: 'NOT_FOUND', message: 'Service line not found' });
      if (line.staff_user_id !== actorUserId) {
        return fail({ code: 'FORBIDDEN', message: 'Only the staff member who performed this action can undo it' });
      }

      // Undo Done -> In Progress
      if (line.status === 'done' && line.ended_at) {
        const diffSeconds = (now.getTime() - new Date(line.ended_at).getTime()) / 1000;
        if (diffSeconds > 10) {
          return fail({ code: 'CONFLICT', message: 'Undo window has expired (10s limit)' });
        }

        await client
          .from('visit_service')
          .update({ status: 'in_progress', ended_at: null })
          .eq('id', lineId);

        // Revert next line if made ready
        await client
          .from('visit_service')
          .update({ status: 'blocked', ready_at: null })
          .eq('visit_id', line.visit_id)
          .eq('sequence_no', line.sequence_no + 1)
          .eq('status', 'ready');

        // Revert visit to in_service
        await client
          .from('visit')
          .update({ status: 'in_service', updated_at: now.toISOString() })
          .eq('id', line.visit_id);

        await client.from('audit_log').insert({
          organization_id: 'a0000000-0000-0000-0000-000000000001',
          location_id: 'b0000000-0000-0000-0000-000000000001',
          actor_id: actorUserId,
          actor_role: 'staff',
          action: 'LINE_UNDO_DONE',
          entity_type: 'visit_service',
          entity_id: lineId,
          category: 'operations',
          reason: 'Staff undone Done action within 10s window',
        });

        return ok({ success: true, revertedTo: 'in_progress' });
      }

      // Undo Start -> Ready
      if (line.status === 'in_progress' && line.started_at) {
        const diffSeconds = (now.getTime() - new Date(line.started_at).getTime()) / 1000;
        if (diffSeconds > 10) {
          return fail({ code: 'CONFLICT', message: 'Undo window has expired (10s limit)' });
        }

        await client
          .from('visit_service')
          .update({ status: 'ready', started_at: null })
          .eq('id', lineId);

        await client.from('audit_log').insert({
          organization_id: 'a0000000-0000-0000-0000-000000000001',
          location_id: 'b0000000-0000-0000-0000-000000000001',
          actor_id: actorUserId,
          actor_role: 'staff',
          action: 'LINE_UNDO_START',
          entity_type: 'visit_service',
          entity_id: lineId,
          category: 'operations',
          reason: 'Staff undone Start action within 10s window',
        });

        return ok({ success: true, revertedTo: 'ready' });
      }

      return fail({ code: 'VALIDATION_ERROR', message: 'Action cannot be undone' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Undo failed';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getMyServiceHistory(staffUserId: string): Promise<Result<{
    totalServed: number;
    recentServices: {
      id: string;
      ticketCode: string;
      customerFirstName: string;
      serviceName: string;
      variantName: string;
      completedAt: string;
    }[];
  }>> {
    try {
      const client = getServiceRoleClient();

      const { data: doneLines, error } = await client
        .from('visit_service')
        .select(`
          id, completed_at,
          service_variant:service_variant(
            id, name,
            service:service(name)
          ),
          visit:visit(
            id, ticket_code,
            customer:customer(first_name)
          )
        `)
        .eq('staff_user_id', staffUserId)
        .eq('status', 'done')
        .order('completed_at', { ascending: false })
        .limit(20);

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const uniqueVisits = new Set((doneLines || []).map((d: any) => d.visit?.id));

      const recent = (doneLines || []).map((d: any) => ({
        id: d.id,
        ticketCode: d.visit?.ticket_code || 'TKT',
        customerFirstName: cleanFirstName(d.visit?.customer?.first_name),
        serviceName: d.service_variant?.service?.name || 'Service',
        variantName: d.service_variant?.name || 'Standard',
        completedAt: d.completed_at || new Date().toISOString(),
      }));

      return ok({
        totalServed: uniqueVisits.size,
        recentServices: recent,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query service history';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getMyAttendanceLogs(staffUserId: string): Promise<Result<{
    todayStatus: 'in' | 'break' | 'out';
    last7Days: { date: string; firstIn: string | null; lastOut: string | null; status: 'present' | 'out' | 'not_present' | 'on_leave' }[];
  }>> {
    try {
      const client = getServiceRoleClient();
      const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });

      const { data: logs, error } = await client
        .from('attendance')
        .select('business_date, clock_in, clock_out, on_break, absence_type')
        .eq('staff_user_id', staffUserId)
        .order('business_date', { ascending: false })
        .limit(7);

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const todayLog = (logs || []).find((l) => l.business_date === todayDate);
      let todayStatus: 'in' | 'break' | 'out' = 'out';
      if (todayLog) {
        if (todayLog.clock_out) todayStatus = 'out';
        else if (todayLog.on_break) todayStatus = 'break';
        else if (todayLog.clock_in) todayStatus = 'in';
      }

      const last7Days = (logs || []).map((l) => ({
        date: new Date(`${l.business_date}T12:00:00+03:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Kampala' }),
        firstIn: l.clock_in ? new Date(l.clock_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' }) : null,
        lastOut: l.clock_out ? new Date(l.clock_out).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' }) : null,
        status: l.absence_type === 'approved_leave' ? 'on_leave' as const : l.clock_in ? (l.clock_out ? 'out' as const : 'present' as const) : 'not_present' as const,
      }));

      return ok({ todayStatus, last7Days });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query attendance history';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }
}
