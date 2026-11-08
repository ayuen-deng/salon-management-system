import { getServiceRoleClient } from '@/shared/lib/supabase';
import { Result, ok, fail } from '@/shared/models/result';
import { normalizeUgPhone } from '@/shared/models/phone';
import { getKampalaDateString } from '@/shared/lib/format-duration';
import { getUnifiedStaffAttendanceToday, UnifiedAttendanceStatus } from '@/shared/lib/attendance-presence';

export interface ManagerTodayStats {
  waiting: number;
  in_service: number;
  completed: number;
  left_queue: number;
  unpaid: number;
  orders_awaiting_payment: number;
  pending_approvals: number;
}

export interface ManagerQueueItem {
  visit_id: string;
  ticket_code: string;
  customer_name: string;
  status: string;
  queued_at: string;
  current_service_name?: string;
  current_staff_name?: string;
  assignment_mode: string;
  sequence_no: number;
  between_services: boolean;
  between_services_minutes?: number;
  flag: 'none' | 'warn' | 'escalate';
}

export interface ManagerAttendanceSummary {
  present: number;
  on_break: number;
  out: number;
  not_present: number;
  on_leave: number;
  total_expected: number;
  records: Array<{
    user_id: string;
    display_name: string;
    role: string;
    status: UnifiedAttendanceStatus;
    clock_in_time?: string;
    clock_out_time?: string;
    break_started_at?: string;
    leave_type?: string;
  }>;
}

export interface ApprovalRequestItem {
  id: string;
  kind: string;
  ticket_code: string;
  customer_name: string;
  service_name: string;
  requested_by_name: string;
  requested_by_role: string;
  original_price_ugx: number;
  requested_discount_ugx: number;
  receptionist_limit_ugx: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  decided_at?: string;
  decided_by_name?: string;
}

export interface QueueLineCard {
  line_id: string;
  visit_id: string;
  ticket_code: string;
  customer_name: string;
  service_name: string;
  expected_minutes: number;
  sequence_no: number;
  status: 'ready' | 'in_progress' | 'blocked';
  assignment_mode: string;
  ready_at?: string;
  started_at?: string;
  preference_strict: boolean;
  between_services: boolean;
}

export interface StylistColumn {
  stylist_id: string;
  display_name: string;
  is_available: boolean;
  active_line: QueueLineCard | null;
  queued_lines: QueueLineCard[];
}

export interface QueueBoardData {
  pool_lines: QueueLineCard[];
  stylists: StylistColumn[];
}

export interface ManagerVisitRecord {
  id: string;
  ticket_code: string;
  order_code?: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  source: string;
  entered_via: string;
  queued_at: string;
  total_list_ugx: number;
  total_discount_ugx: number;
  total_final_ugx: number;
  lines: Array<{
    id: string;
    variant_name: string;
    staff_name: string;
    status: string;
    ready_at?: string;
    started_at?: string;
    ended_at?: string;
    times_source?: string;
    final_price_ugx: number;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amount_ugx: number;
    status: string;
    confirmation_level: string;
    provider_reference?: string;
  }>;
}

export interface ManagerPaymentItem {
  id: string;
  business_date: string;
  ticket_code: string;
  method: string;
  amount_ugx: number;
  status: string;
  confirmation_level: string;
  provider_reference?: string;
  recorded_by_name: string;
  created_at: string;
}

export interface ManagerRecentActivity {
  id: string;
  at: string;
  time_str: string;
  action: string;
  actor: string;
  reason?: string;
  category: string;
}

export class ManagerOperationsRepository {
  private locId = 'b0000000-0000-0000-0000-000000000001';

  async getPendingApprovalsCount(): Promise<Result<number>> {
    try {
      const client = getServiceRoleClient();
      const { count, error } = await client
        .from('approval_request')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      return ok(count || 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching pending approvals count';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getTodayStats(): Promise<Result<ManagerTodayStats>> {
    try {
      const client = getServiceRoleClient();
      const today = getKampalaDateString();

      // Find business day for today
      const { data: day } = await client
        .from('business_day')
        .select('id, status')
        .eq('location_id', this.locId)
        .eq('business_date', today)
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count: pendingCount } = await client
        .from('approval_request')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      // If no business day exists for today or it is not open, today's live queue figures are zero
      if (!day || day.status !== 'open') {
        return ok({
          waiting: 0,
          in_service: 0,
          completed: 0,
          left_queue: 0,
          unpaid: 0,
          orders_awaiting_payment: 0,
          pending_approvals: pendingCount || 0,
        });
      }

      const { data: visits, error: vErr } = await client
        .from('visit')
        .select('status, id')
        .eq('business_day_id', day.id);

      if (vErr) return fail({ code: 'INTERNAL_ERROR', message: vErr.message });

      const { count: kioskOrderCount, error: kioskOrderError } = await client
        .from('visit')
        .select('id', { count: 'exact', head: true })
        .eq('business_day_id', day.id)
        .eq('created_via', 'desk_tablet')
        .eq('status', 'draft');
      if (kioskOrderError) return fail({ code: 'INTERNAL_ERROR', message: kioskOrderError.message });

      const waiting = (visits || []).filter((v) => v.status === 'queued').length;
      const in_service = (visits || []).filter((v) => v.status === 'in_service').length;
      const completed = (visits || []).filter((v) => v.status === 'paid' || v.status === 'completed').length;
      const left_queue = (visits || []).filter((v) => v.status === 'left_queue').length;
      const unpaid = (visits || []).filter((v) => v.status === 'ready_for_checkout' || v.status === 'payment_pending').length;

      return ok({
        waiting,
        in_service,
        completed,
        left_queue,
        unpaid,
        orders_awaiting_payment: kioskOrderCount || 0,
        pending_approvals: pendingCount || 0,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching manager stats';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getLiveQueue(): Promise<Result<{ items: ManagerQueueItem[]; washHoldWarning: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const today = getKampalaDateString();

      // Find today's open business day
      const { data: day } = await client
        .from('business_day')
        .select('id, status')
        .eq('location_id', this.locId)
        .eq('business_date', today)
        .eq('status', 'open')
        .limit(1)
        .maybeSingle();

      // If day is not open, queue is empty
      if (!day) {
        return ok({ items: [], washHoldWarning: false });
      }

      const { data: visits, error } = await client
        .from('visit')
        .select(`
          id, ticket_code, status, queued_at,
          customer ( first_name ),
          visit_service (
            id, sequence_no, status, assignment_mode, ready_at, started_at, ended_at,
            service_variant ( name ),
            staff:app_user!visit_service_staff_user_id_fkey ( display_name )
          )
        `)
        .eq('business_day_id', day.id)
        .in('status', ['queued', 'in_service'])
        .order('queued_at', { ascending: true });

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const now = Date.now();
      let blowDryWaitingCount = 0;
      const items: ManagerQueueItem[] = [];

      for (const v of visits || []) {
        const services = (v.visit_service || []).sort(
          (a: { sequence_no: number }, b: { sequence_no: number }) => a.sequence_no - b.sequence_no
        );

        // Find active or next service
        const currentService =
          services.find((s: { status: string }) => s.status === 'in_progress' || s.status === 'ready' || s.status === 'waiting_for_resource') ||
          services[0];

        const prevDoneService = services.find(
          (s: { status: string; ended_at: string | null }) => s.status === 'done' && s.ended_at
        );

        let betweenServices = false;
        let betweenMinutes = 0;
        let flag: 'none' | 'warn' | 'escalate' = 'none';

        if (
          prevDoneService &&
          currentService &&
          currentService.status === 'ready' &&
          prevDoneService.ended_at
        ) {
          betweenServices = true;
          const waitMs = now - new Date(prevDoneService.ended_at).getTime();
          betweenMinutes = Math.max(0, Math.floor(waitMs / 60000));

          if (betweenMinutes >= 20) {
            flag = 'escalate';
          } else if (betweenMinutes >= 10) {
            flag = 'warn';
          }
        }

        const variantRaw = currentService?.service_variant as any;
        const sName = Array.isArray(variantRaw) ? variantRaw[0]?.name || 'General Styling' : variantRaw?.name || 'General Styling';
        if (sName.toLowerCase().includes('blow-dry') && (v.status === 'queued' || betweenServices)) {
          blowDryWaitingCount++;
        }

        items.push({
          visit_id: v.id,
          ticket_code: v.ticket_code,
          customer_name: (v.customer as { first_name?: string })?.first_name || 'Walk-in Guest',
          status: v.status,
          queued_at: v.queued_at,
          current_service_name: sName,
          current_staff_name: (currentService?.staff as { display_name?: string })?.display_name || 'Any Stylist',
          assignment_mode: currentService?.assignment_mode || 'any',
          sequence_no: currentService?.sequence_no || 1,
          between_services: betweenServices,
          between_services_minutes: betweenMinutes,
          flag,
        });
      }

      // Wash hold triggered if 3 or more waiting for blow dry
      const washHoldWarning = blowDryWaitingCount >= 3;

      return ok({ items, washHoldWarning });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching live queue';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getAttendanceSnapshot(): Promise<Result<ManagerAttendanceSummary>> {
    try {
      const today = getKampalaDateString();
      const unifiedRes = await getUnifiedStaffAttendanceToday(today);
      if (!unifiedRes.success) {
        return fail({ code: 'INTERNAL_ERROR', message: unifiedRes.error?.message || 'Error fetching attendance snapshot' });
      }

      const uData = unifiedRes.data;
      const records = uData.staff.map((s) => ({
        user_id: s.userId,
        display_name: s.displayName,
        role: s.role,
        status: s.status,
        clock_in_time: s.clockInTime,
        clock_out_time: s.clockOutTime,
        break_started_at: s.breakStartedAt,
        leave_type: s.leaveType,
      }));

      return ok({
        present: uData.presentCount,
        on_break: uData.onBreakCount,
        out: uData.outCount,
        not_present: uData.notPresentCount,
        on_leave: uData.onLeaveCount,
        total_expected: uData.totalExpected,
        records,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching attendance snapshot';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getRecentActivity(): Promise<Result<ManagerRecentActivity[]>> {
    try {
      const client = getServiceRoleClient();
      const { data: logs, error } = await client
        .from('audit_log')
        .select(`
          id, at, action, reason, category,
          actor:app_user!audit_log_actor_id_fkey ( display_name )
        `)
        .order('at', { ascending: false })
        .limit(8);

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const items: ManagerRecentActivity[] = (logs || []).map((l) => {
        const d = new Date(l.at);
        const timeStr = d.toLocaleDateString('en-UG', {
          month: 'short',
          day: 'numeric',
          timeZone: 'Africa/Kampala',
        }) + ' ' + d.toLocaleTimeString('en-UG', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Africa/Kampala',
        });
        return {
          id: l.id,
          at: l.at,
          time_str: timeStr,
          action: l.action,
          actor: (l.actor as { display_name?: string })?.display_name || 'System',
          reason: l.reason || undefined,
          category: l.category,
        };
      });

      return ok(items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching recent activity';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getApprovalRequests(status: 'pending' | 'decided' = 'pending'): Promise<Result<ApprovalRequestItem[]>> {
    try {
      const client = getServiceRoleClient();
      let query = client
        .from('approval_request')
        .select(`
          id, kind, payload, status, created_at, decided_at,
          requested_by_user:app_user!approval_request_requested_by_fkey ( display_name, role ),
          decided_by_user:app_user!approval_request_decided_by_fkey ( display_name )
        `)
        .order('created_at', { ascending: false });

      if (status === 'pending') {
        query = query.eq('status', 'pending');
      } else {
        query = query.in('status', ['approved', 'rejected']);
      }

      const { data, error } = await query;
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const items: ApprovalRequestItem[] = (data || []).map((row) => {
        const payload = (row.payload as Record<string, unknown>) || {};
        return {
          id: row.id,
          kind: row.kind,
          ticket_code: (payload.ticket_code as string) || 'TICKET',
          customer_name: (payload.customer_name as string) || 'Customer',
          service_name: (payload.service_name as string) || 'Service',
          requested_by_name: (row.requested_by_user as { display_name?: string })?.display_name || 'Staff',
          requested_by_role: (row.requested_by_user as { role?: string })?.role || 'receptionist',
          original_price_ugx: Number(payload.original_price_ugx || payload.list_price_ugx || 0),
          requested_discount_ugx: Number(payload.amount_ugx || 0),
          receptionist_limit_ugx: Number(payload.receptionist_limit_ugx || 5000),
          reason: (payload.reason as string) || 'No reason provided',
          status: row.status as 'pending' | 'approved' | 'rejected',
          created_at: row.created_at,
          decided_at: row.decided_at || undefined,
          decided_by_name: (row.decided_by_user as { display_name?: string })?.display_name || undefined,
        };
      });

      return ok(items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching approval requests';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async decideApprovalRequest(
    requestId: string,
    managerUserId: string,
    decision: 'approved' | 'rejected',
    approvedAmountUgx?: number,
    declineReason?: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const now = new Date().toISOString();

      const { data: request, error: fetchErr } = await client
        .from('approval_request')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchErr || !request) {
        return fail({ code: 'NOT_FOUND', message: 'Approval request not found' });
      }

      const payload = (request.payload as Record<string, unknown>) || {};
      const visitId = payload.visit_id as string | undefined;

      // Update approval_request record
      const updatedPayload = {
        ...payload,
        decided_amount_ugx: decision === 'approved' ? (approvedAmountUgx ?? payload.amount_ugx) : 0,
        decline_reason: decision === 'rejected' ? declineReason : undefined,
      };

      const { error: updErr } = await client
        .from('approval_request')
        .update({
          status: decision,
          decided_by: managerUserId,
          decided_at: now,
          payload: updatedPayload,
        })
        .eq('id', requestId);

      if (updErr) return fail({ code: 'INTERNAL_ERROR', message: updErr.message });

      // Execute approved action depending on kind
      if (decision === 'approved') {
        if (request.kind === 'discount' && visitId) {
          const discountVal = Number(approvedAmountUgx ?? payload.amount_ugx ?? 0);
          const { data: v } = await client
            .from('visit')
            .select('total_list_ugx, total_discount_ugx')
            .eq('id', visitId)
            .single();

          if (v) {
            const newList = Number(v.total_list_ugx);
            const newDiscount = Number(v.total_discount_ugx) + discountVal;
            const newFinal = Math.max(0, newList - newDiscount);

            await client
              .from('visit')
              .update({
                total_discount_ugx: newDiscount,
                total_final_ugx: newFinal,
              })
              .eq('id', visitId);

            // Insert into discount table
            await client.from('discount').insert({
              visit_id: visitId,
              amount_ugx: discountVal,
              reason_code: (payload.reason as string) || 'manager_approval',
              applied_by: request.requested_by,
              approved_by: managerUserId,
            });
          }
        } else if (request.kind === 'remove_started_line') {
          const lineId = payload.line_id as string;
          if (lineId) {
            await client
              .from('visit_service')
              .update({ status: 'cancelled', ended_at: now })
              .eq('id', lineId);
          }
        } else if (request.kind === 'dispute_adjustment' && visitId) {
          const adjustAmount = Number(approvedAmountUgx ?? payload.amount_ugx ?? 0);
          if (adjustAmount > 0) {
            const { data: v } = await client
              .from('visit')
              .select('total_final_ugx')
              .eq('id', visitId)
              .single();
            if (v) {
              const newFinal = Math.max(0, Number(v.total_final_ugx) - adjustAmount);
              await client
                .from('visit')
                .update({ total_final_ugx: newFinal })
                .eq('id', visitId);
            }
          }
        } else if (request.kind === 'late_appointment_conversion') {
          const appointmentId = payload.appointment_id as string;
          if (appointmentId) {
            // Convert late appointment to queued visit with manager authorization
            await client
              .from('appointment')
              .update({ status: 'completed', late: true })
              .eq('id', appointmentId);
          }
        }
      }

      // Write audit log row
      await client.from('audit_log').insert({
        organization_id: request.organization_id,
        location_id: request.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: decision === 'approved' ? 'APPROVAL_GRANTED' : 'APPROVAL_DECLINED',
        entity_type: 'approval_request',
        entity_id: requestId,
        category: 'money',
        reason: decision === 'approved' ? `Approved UGX ${approvedAmountUgx ?? payload.amount_ugx}` : (declineReason || 'Declined by manager'),
        before: { status: 'pending', amount_ugx: payload.amount_ugx },
        after: { status: decision, decided_amount_ugx: approvedAmountUgx ?? payload.amount_ugx },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error resolving approval request';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getQueueBoard(): Promise<Result<QueueBoardData>> {
    try {
      const client = getServiceRoleClient();
      const today = new Date().toISOString().split('T')[0];

      // 1. Fetch active stylists
      const { data: stylistsRaw, error: sErr } = await client
        .from('app_user')
        .select('id, display_name')
        .eq('role', 'staff')
        .order('display_name', { ascending: true });

      if (sErr) return fail({ code: 'INTERNAL_ERROR', message: sErr.message });

      // Fetch today's attendance to know availability
      const { data: attList } = await client
        .from('attendance')
        .select('staff_user_id, clock_in, clock_out, on_break, absence_type')
        .eq('business_date', today);

      const attMap = new Map((attList || []).map((a) => [a.staff_user_id, a]));

      // 2. Fetch active service lines
      const { data: linesRaw, error: lErr } = await client
        .from('visit_service')
        .select(`
          id, visit_id, sequence_no, status, assignment_mode, ready_at, started_at, ended_at, staff_user_id,
          service_variant ( id, name, expected_minutes ),
          staff:app_user!visit_service_staff_user_id_fkey ( id, display_name ),
          visit:visit!visit_service_visit_id_fkey ( ticket_code, status, customer ( first_name ) )
        `)
        .in('status', ['ready', 'in_progress', 'blocked'])
        .order('sequence_no', { ascending: true });

      if (lErr) return fail({ code: 'INTERNAL_ERROR', message: lErr.message });

      const pool_lines: QueueLineCard[] = [];
      const stylistColumns: Map<string, StylistColumn> = new Map();

      for (const s of stylistsRaw || []) {
        const att = attMap.get(s.id);
        const isAvailable = Boolean(att && att.clock_in && !att.clock_out && !att.on_break && att.absence_type === 'none');
        stylistColumns.set(s.id, {
          stylist_id: s.id,
          display_name: s.display_name,
          is_available: isAvailable,
          active_line: null,
          queued_lines: [],
        });
      }

      for (const row of linesRaw || []) {
        const visit = (row.visit as unknown) as { ticket_code?: string; status?: string; customer?: { first_name?: string } };
        const variant = (row.service_variant as unknown) as { name?: string; expected_minutes?: number };

        const card: QueueLineCard = {
          line_id: row.id,
          visit_id: row.visit_id,
          ticket_code: visit?.ticket_code || 'TICKET',
          customer_name: visit?.customer?.first_name || 'Walk-in',
          service_name: variant?.name || 'Service',
          expected_minutes: variant?.expected_minutes || 30,
          sequence_no: row.sequence_no,
          status: row.status as 'ready' | 'in_progress' | 'blocked',
          assignment_mode: row.assignment_mode,
          ready_at: row.ready_at || undefined,
          started_at: row.started_at || undefined,
          preference_strict: row.assignment_mode === 'named_strict',
          between_services: row.sequence_no > 1 && row.status === 'ready',
        };

        if (row.staff_user_id && stylistColumns.has(row.staff_user_id)) {
          const col = stylistColumns.get(row.staff_user_id)!;
          if (row.status === 'in_progress' && !col.active_line) {
            col.active_line = card;
          } else {
            col.queued_lines.push(card);
          }
        } else {
          pool_lines.push(card);
        }
      }

      return ok({
        pool_lines,
        stylists: Array.from(stylistColumns.values()),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error loading queue board';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async reassignLine(
    lineId: string,
    managerUserId: string,
    targetStaffId: string | null, // null means back to pool
    reasonCode: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: line, error: fErr } = await client
        .from('visit_service')
        .select('*')
        .eq('id', lineId)
        .single();

      if (fErr || !line) return fail({ code: 'NOT_FOUND', message: 'Line not found' });

      const newAssignment = targetStaffId ? 'named_preferred' : 'any';
      await client
        .from('visit_service')
        .update({
          staff_user_id: targetStaffId,
          assignment_mode: newAssignment,
        })
        .eq('id', lineId);

      // Record queue_override
      await client.from('queue_override').insert({
        visit_service_id: lineId,
        by_user_id: managerUserId,
        reason_code: reasonCode,
      });

      // Audit log
      await client.from('audit_log').insert({
        organization_id: line.organization_id || 'a0000000-0000-0000-0000-000000000001',
        location_id: this.locId,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'LINE_REASSIGNED',
        entity_type: 'visit_service',
        entity_id: lineId,
        category: 'operations',
        reason: reasonCode,
        before: { staff_user_id: line.staff_user_id, assignment_mode: line.assignment_mode },
        after: { staff_user_id: targetStaffId, assignment_mode: newAssignment },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error reassigning line';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async startOutOfOrder(
    lineId: string,
    managerUserId: string,
    staffId: string,
    reasonCode: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const now = new Date().toISOString();

      const { data: line } = await client.from('visit_service').select('*').eq('id', lineId).single();
      if (!line) return fail({ code: 'NOT_FOUND', message: 'Line not found' });

      await client
        .from('visit_service')
        .update({
          status: 'in_progress',
          staff_user_id: staffId,
          started_at: now,
        })
        .eq('id', lineId);

      // Update parent visit to in_service if queued
      await client.from('visit').update({ status: 'in_service' }).eq('id', line.visit_id);

      await client.from('queue_override').insert({
        visit_service_id: lineId,
        by_user_id: managerUserId,
        reason_code: reasonCode,
      });

      await client.from('audit_log').insert({
        organization_id: line.organization_id || 'a0000000-0000-0000-0000-000000000001',
        location_id: this.locId,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'START_OUT_OF_ORDER',
        entity_type: 'visit_service',
        entity_id: lineId,
        category: 'operations',
        reason: reasonCode,
        before: { status: line.status, started_at: line.started_at },
        after: { status: 'in_progress', started_at: now },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error starting line out of order';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async removeStartedLine(
    lineId: string,
    managerUserId: string,
    reasonCode: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: line } = await client.from('visit_service').select('*').eq('id', lineId).single();
      if (!line) return fail({ code: 'NOT_FOUND', message: 'Line not found' });

      await client
        .from('visit_service')
        .update({
          status: 'cancelled',
        })
        .eq('id', lineId);

      await client.from('audit_log').insert({
        organization_id: line.organization_id || 'a0000000-0000-0000-0000-000000000001',
        location_id: this.locId,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'REMOVE_STARTED_LINE',
        entity_type: 'visit_service',
        entity_id: lineId,
        category: 'operations',
        reason: reasonCode,
        before: { status: line.status },
        after: { status: 'cancelled' },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error removing line';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async markStylistUnavailable(
    stylistId: string,
    managerUserId: string,
    reasonCode: string
  ): Promise<Result<{ returnedToPoolCount: number; strictFlaggedCount: number }>> {
    try {
      const client = getServiceRoleClient();
      const today = new Date().toISOString().split('T')[0];

      // 1. Mark attendance on_break or off
      const { data: att } = await client
        .from('attendance')
        .select('id')
        .eq('staff_user_id', stylistId)
        .eq('business_date', today)
        .maybeSingle();

      if (att) {
        await client
          .from('attendance')
          .update({ on_break: true, break_started_at: new Date().toISOString() })
          .eq('id', att.id);
      }

      // 2. Fetch waiting lines assigned to this stylist
      const { data: lines } = await client
        .from('visit_service')
        .select('id, assignment_mode')
        .eq('staff_user_id', stylistId)
        .in('status', ['ready', 'blocked']);

      let returnedToPoolCount = 0;
      let strictFlaggedCount = 0;

      for (const l of lines || []) {
        if (l.assignment_mode === 'named_strict') {
          // Keep assigned but audit/flag for receptionist
          strictFlaggedCount++;
        } else {
          // Return to pool (set staff_user_id = null and assignment_mode = 'any')
          await client
            .from('visit_service')
            .update({ staff_user_id: null, assignment_mode: 'any' })
            .eq('id', l.id);
          returnedToPoolCount++;
        }
      }

      await client.from('audit_log').insert({
        organization_id: 'a0000000-0000-0000-0000-000000000001',
        location_id: this.locId,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'STYLIST_UNAVAILABLE',
        entity_type: 'app_user',
        entity_id: stylistId,
        category: 'operations',
        reason: reasonCode,
        before: { is_available: true },
        after: { is_available: false, returnedToPoolCount, strictFlaggedCount },
      });

      return ok({ returnedToPoolCount, strictFlaggedCount });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error marking stylist unavailable';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // -------------------------------------------------------------
  // VISITS MANAGEMENT
  // -------------------------------------------------------------
  async getVisits(tab: 'today' | 'all' | 'unpaid' | 'abandoned' | 'awaiting' = 'today'): Promise<Result<ManagerVisitRecord[]>> {
    try {
      const client = getServiceRoleClient();
      let query = client
        .from('visit')
        .select(`
          id, ticket_code, order_code, draft_first_name, draft_phone_e164, created_via, status, source, entered_via, queued_at,
          total_list_ugx, total_discount_ugx, total_final_ugx,
          customer ( first_name, phone_e164 ),
          business_day ( business_date ),
          visit_service (
            id, status, final_price_ugx, started_at, ended_at, ready_at, times_source,
            service_variant ( name ),
            staff:app_user!visit_service_staff_user_id_fkey ( display_name )
          ),
          payment (
            id, method, amount_ugx, status, confirmation_level, provider_reference
          )
        `)
        .order('queued_at', { ascending: false });

      if (tab === 'today') {
        query = query.limit(50);
      } else if (tab === 'unpaid') {
        query = query.eq('status', 'completed');
      } else if (tab === 'awaiting') {
        query = query.eq('created_via', 'desk_tablet').eq('status', 'draft').order('created_at', { ascending: false });
      } else if (tab === 'abandoned') {
        query = query.in('status', ['abandoned', 'cancelled', 'expired']).order('created_at', { ascending: false });
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const mapped: ManagerVisitRecord[] = (data || []).map((v: any) => ({
        id: v.id,
        ticket_code: v.ticket_code || v.order_code || '—',
        order_code: v.order_code || undefined,
        customer_name: v.customer?.first_name || v.draft_first_name || 'Walk-in Client',
        customer_phone: v.customer?.phone_e164 || v.draft_phone_e164 || '',
        status: v.status,
        source: v.source,
        entered_via: v.entered_via,
        queued_at: v.queued_at || '',
        total_list_ugx: Number(v.total_list_ugx) || 0,
        total_discount_ugx: Number(v.total_discount_ugx) || 0,
        total_final_ugx: Number(v.total_final_ugx) || 0,
        lines: (v.visit_service || []).map((s: any) => ({
          id: s.id,
          variant_name: s.service_variant?.name || 'Service Line',
          staff_name: s.staff?.display_name || 'Any Staff',
          status: s.status,
          ready_at: s.ready_at || undefined,
          started_at: s.started_at || undefined,
          ended_at: s.ended_at || undefined,
          times_source: s.times_source || 'live',
          final_price_ugx: Number(s.final_price_ugx) || 0,
        })),
        payments: (v.payment || []).map((p: any) => ({
          id: p.id,
          method: p.method,
          amount_ugx: Number(p.amount_ugx) || 0,
          status: p.status,
          confirmation_level: p.confirmation_level,
          provider_reference: p.provider_reference || undefined,
        })),
      }));

      return ok(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching visits';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async addComplimentaryLine(
    visitId: string,
    managerUserId: string,
    serviceVariantId: string,
    reasonCode: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: variant } = await client.from('service_variant').select('*').eq('id', serviceVariantId).single();
      if (!variant) return fail({ code: 'NOT_FOUND', message: 'Service variant not found' });

      // Insert complimentary line (final_price_ugx = 0, price_source = 'complimentary')
      await client.from('visit_service').insert({
        visit_id: visitId,
        service_variant_id: serviceVariantId,
        assignment_mode: 'any',
        sequence_no: 99,
        status: 'ready',
        list_price_ugx: variant.list_price_ugx,
        discount_ugx: variant.list_price_ugx,
        final_price_ugx: 0,
        price_source: 'complimentary',
        ready_at: new Date().toISOString(),
      });

      await client.from('audit_log').insert({
        organization_id: 'a0000000-0000-0000-0000-000000000001',
        location_id: this.locId,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'ADD_COMPLIMENTARY_LINE',
        entity_type: 'visit',
        entity_id: visitId,
        category: 'money',
        reason: reasonCode,
        after: { variant_id: serviceVariantId, variant_name: variant.name },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error adding complimentary line';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async adjustVisitTotal(
    visitId: string,
    managerUserId: string,
    newTotalUgx: number,
    reasonCode: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: v } = await client.from('visit').select('*').eq('id', visitId).single();
      if (!v) return fail({ code: 'NOT_FOUND', message: 'Visit not found' });

      const diff = Number(v.total_final_ugx) - newTotalUgx;

      await client
        .from('visit')
        .update({
          total_discount_ugx: Number(v.total_discount_ugx) + diff,
          total_final_ugx: newTotalUgx,
        })
        .eq('id', visitId);

      await client.from('audit_log').insert({
        organization_id: v.organization_id,
        location_id: v.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'VISIT_TOTAL_ADJUSTED',
        entity_type: 'visit',
        entity_id: visitId,
        category: 'money',
        reason: reasonCode,
        before: { total_final_ugx: v.total_final_ugx },
        after: { total_final_ugx: newTotalUgx, adjusted_diff_ugx: diff },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error adjusting visit total';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async correctTimestamps(
    lineId: string,
    managerUserId: string,
    startedAt: string,
    endedAt: string,
    reasonCode: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: line } = await client.from('visit_service').select('*').eq('id', lineId).single();
      if (!line) return fail({ code: 'NOT_FOUND', message: 'Line not found' });

      await client
        .from('visit_service')
        .update({
          started_at: startedAt,
          ended_at: endedAt,
          times_source: 'corrected',
        })
        .eq('id', lineId);

      await client.from('audit_log').insert({
        organization_id: line.organization_id || 'a0000000-0000-0000-0000-000000000001',
        location_id: this.locId,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'TIMESTAMPS_CORRECTED',
        entity_type: 'visit_service',
        entity_id: lineId,
        category: 'operations',
        reason: reasonCode,
        before: { started_at: line.started_at, ended_at: line.ended_at },
        after: { started_at: startedAt, ended_at: endedAt, times_source: 'corrected' },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error correcting timestamps';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // -------------------------------------------------------------
  // PAYMENTS MANAGEMENT
  // -------------------------------------------------------------
  async getPayments(): Promise<Result<ManagerPaymentItem[]>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client
        .from('payment')
        .select(`
          id, method, amount_ugx, status, confirmation_level, provider_reference, created_at,
          business_day ( business_date ),
          visit ( ticket_code ),
          cashier:app_user!payment_recorded_by_fkey ( display_name )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const mapped: ManagerPaymentItem[] = (data || []).map((p: any) => ({
        id: p.id,
        business_date: p.business_day?.business_date || '',
        ticket_code: p.visit?.ticket_code || 'Counter',
        method: p.method,
        amount_ugx: Number(p.amount_ugx) || 0,
        status: p.status,
        confirmation_level: p.confirmation_level,
        provider_reference: p.provider_reference || undefined,
        recorded_by_name: p.cashier?.display_name || 'Cashier',
        created_at: p.created_at,
      }));

      return ok(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching payments';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async recordPayment(
    visitId: string,
    managerUserId: string,
    method: 'cash' | 'mobile_money',
    amountUgx: number,
    providerReference: string | undefined,
    idempotencyKey: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: v } = await client.from('visit').select('business_day_id, organization_id, location_id').eq('id', visitId).single();
      if (!v) return fail({ code: 'NOT_FOUND', message: 'Visit not found' });

      await client.from('payment').insert({
        organization_id: v.organization_id,
        location_id: v.location_id,
        visit_id: visitId,
        business_day_id: v.business_day_id,
        method,
        amount_ugx: amountUgx,
        status: 'confirmed',
        confirmation_level: method === 'cash' ? 'confirmed_via_provider' : 'attested',
        provider_reference: providerReference || null,
        idempotency_key: idempotencyKey,
        recorded_by: managerUserId,
      });

      // Mark visit paid
      await client.from('visit').update({ status: 'paid' }).eq('id', visitId);

      await client.from('audit_log').insert({
        organization_id: v.organization_id,
        location_id: v.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'PAYMENT_RECORDED',
        entity_type: 'visit',
        entity_id: visitId,
        category: 'money',
        reason: `Recorded ${method} payment of UGX ${amountUgx}`,
        after: { method, amount_ugx: amountUgx, provider_reference: providerReference },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error recording payment';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async attachPaymentReference(
    paymentId: string,
    managerUserId: string,
    reference: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: p } = await client.from('payment').select('*').eq('id', paymentId).single();
      if (!p) return fail({ code: 'NOT_FOUND', message: 'Payment not found' });

      await client
        .from('payment')
        .update({
          provider_reference: reference,
          confirmation_level: 'attested',
        })
        .eq('id', paymentId);

      await client.from('audit_log').insert({
        organization_id: p.organization_id,
        location_id: p.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'PAYMENT_REFERENCE_ATTACHED',
        entity_type: 'payment',
        entity_id: paymentId,
        category: 'money',
        reason: `Attached MoMo reference ${reference}`,
        before: { provider_reference: p.provider_reference },
        after: { provider_reference: reference },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error attaching payment reference';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async voidPayment(
    paymentId: string,
    managerUserId: string,
    reasonCode: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: p } = await client.from('payment').select('*').eq('id', paymentId).single();
      if (!p) return fail({ code: 'NOT_FOUND', message: 'Payment not found' });

      // Create linked negative adjustment row (immutable row pattern)
      await client.from('payment_adjustment').insert({
        payment_id: paymentId,
        amount_ugx: -Number(p.amount_ugx),
        reason_code: reasonCode,
        approved_by: managerUserId,
      });

      // Update payment status to voided
      await client.from('payment').update({ status: 'voided' }).eq('id', paymentId);

      await client.from('audit_log').insert({
        organization_id: p.organization_id,
        location_id: p.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'PAYMENT_VOIDED',
        entity_type: 'payment',
        entity_id: paymentId,
        category: 'money',
        reason: reasonCode,
        before: { status: p.status, amount_ugx: p.amount_ugx },
        after: { status: 'voided', adjustment_ugx: -Number(p.amount_ugx) },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error voiding payment';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async refundPayment(
    paymentId: string,
    managerUserId: string,
    amountUgx: number,
    reasonCode: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: p } = await client.from('payment').select('*').eq('id', paymentId).single();
      if (!p) return fail({ code: 'NOT_FOUND', message: 'Payment not found' });

      // Create linked negative adjustment row (immutable row pattern)
      await client.from('payment_adjustment').insert({
        payment_id: paymentId,
        amount_ugx: -amountUgx,
        reason_code: reasonCode,
        approved_by: managerUserId,
      });

      // Update payment status to refunded
      await client.from('payment').update({ status: 'refunded' }).eq('id', paymentId);

      await client.from('audit_log').insert({
        organization_id: p.organization_id,
        location_id: p.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'PAYMENT_REFUNDED',
        entity_type: 'payment',
        entity_id: paymentId,
        category: 'money',
        reason: reasonCode,
        before: { status: p.status },
        after: { status: 'refunded', refunded_amount_ugx: amountUgx },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error refunding payment';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // ==========================================
  // PHASE 2: APPOINTMENTS
  // ==========================================
  async getAppointments(): Promise<Result<ManagerAppointmentItem[]>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client
        .from('appointment')
        .select(`
          id, starts_at, expected_minutes, status, late, visit_id,
          customer:customer(id, first_name, phone_e164),
          service:service(id, name),
          staff:app_user(id, display_name)
        `)
        .order('starts_at', { ascending: true });

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const mapped: ManagerAppointmentItem[] = (data || []).map((row: any) => ({
        id: row.id,
        starts_at: row.starts_at,
        expected_minutes: row.expected_minutes,
        status: row.status,
        late: row.late,
        visit_id: row.visit_id || undefined,
        customer_name: row.customer?.first_name || 'Customer',
        customer_phone: row.customer?.phone_e164 || '',
        service_name: row.service?.name || 'Service',
        staff_name: row.staff?.display_name || 'Any Stylist',
      }));

      return ok(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching appointments';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async createAppointment(payload: {
    customerName: string;
    customerPhone: string;
    serviceId: string;
    stylistId?: string;
    startsAt: string;
    expectedMinutes?: number;
    managerUserId: string;
  }): Promise<Result<{ id: string }>> {
    try {
      const client = getServiceRoleClient();
      const phoneClean = normalizeUgPhone(payload.customerPhone);
      if (!phoneClean) {
        return fail({ code: 'VALIDATION_ERROR', message: 'Valid Ugandan phone number required (e.g. 07...)' });
      }

      const { data: org } = await client.from('organization').select('id').limit(1).single();
      const { data: loc } = await client.from('location').select('id').limit(1).single();

      if (!org || !loc) {
        return fail({ code: 'NOT_FOUND', message: 'Location not found' });
      }

      // Find or create customer
      let customerId: string;
      const { data: existingCust } = await client
        .from('customer')
        .select('id, first_name')
        .eq('phone_e164', phoneClean)
        .maybeSingle();

      if (existingCust) {
        customerId = existingCust.id;
        if (payload.customerName.trim() && payload.customerName.trim() !== existingCust.first_name) {
          await client.from('customer').update({ first_name: payload.customerName.trim() }).eq('id', customerId);
        }
      } else {
        const { data: newCust, error: cErr } = await client
          .from('customer')
          .insert({
            organization_id: org.id,
            first_name: payload.customerName.trim() || 'Client',
            phone_e164: phoneClean,
          })
          .select('id')
          .single();

        if (cErr || !newCust) {
          return fail({ code: 'INTERNAL_ERROR', message: cErr?.message || 'Failed to create customer' });
        }
        customerId = newCust.id;
      }

      const { data: appt, error: aErr } = await client
        .from('appointment')
        .insert({
          organization_id: org.id,
          location_id: loc.id,
          customer_id: customerId,
          service_id: payload.serviceId || null,
          staff_user_id: payload.stylistId || null,
          starts_at: payload.startsAt,
          expected_minutes: payload.expectedMinutes || 30,
          status: 'booked',
          late: false,
        })
        .select('id')
        .single();

      if (aErr || !appt) {
        return fail({ code: 'INTERNAL_ERROR', message: aErr?.message || 'Failed to book appointment' });
      }

      return ok({ id: appt.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error creating appointment';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async checkInAppointment(appointmentId: string, managerUserId: string): Promise<Result<{ ticket_code: string; visit_id: string }>> {
    try {
      const client = getServiceRoleClient();
      const { data: appt, error } = await client
        .from('appointment')
        .select('*, customer(*), service(*)')
        .eq('id', appointmentId)
        .single();

      if (error || !appt) return fail({ code: 'NOT_FOUND', message: 'Appointment not found' });

      const { data: bday } = await client.from('business_day').select('id').eq('status', 'open').maybeSingle();
      if (!bday) return fail({ code: 'CONFLICT', message: 'No open business day found' });

      // Generate next ticket code
      const ticketCode = `A${Math.floor(10 + Math.random() * 89)}`;

      const { data: visit, error: vErr } = await client
        .from('visit')
        .insert({
          organization_id: appt.organization_id,
          location_id: appt.location_id,
          business_day_id: bday.id,
          customer_id: appt.customer_id,
          status: 'queued',
          source: 'appointment',
          ticket_code: ticketCode,
        })
        .select()
        .single();

      if (vErr || !visit) return fail({ code: 'INTERNAL_ERROR', message: vErr?.message || 'Could not create visit' });

      // Find first variant of service
      const { data: variant } = await client.from('service_variant').select('id, expected_minutes').eq('service_id', appt.service_id).limit(1).maybeSingle();

      if (variant) {
        await client.from('visit_service').insert({
          organization_id: appt.organization_id,
          location_id: appt.location_id,
          visit_id: visit.id,
          service_variant_id: variant.id,
          sequence_no: 1,
          status: 'ready',
          assignment_mode: appt.staff_user_id ? 'named_strict' : 'pool',
          staff_user_id: appt.staff_user_id || null,
        });
      }

      await client.from('appointment').update({ status: 'completed', visit_id: visit.id }).eq('id', appointmentId);

      await client.from('audit_log').insert({
        organization_id: appt.organization_id,
        location_id: appt.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'APPOINTMENT_CHECKED_IN',
        entity_type: 'appointment',
        entity_id: appointmentId,
        category: 'workflow',
        after: { ticket_code: ticketCode, visit_id: visit.id },
      });

      return ok({ ticket_code: ticketCode, visit_id: visit.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error checking in appointment';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // ==========================================
  // PHASE 2: CATALOGUE & PRICES
  // ==========================================
  async getCatalogue(): Promise<Result<ManagerCatalogueItem[]>> {
    try {
      const client = getServiceRoleClient();
      const { data: services, error } = await client
        .from('service')
        .select(`
          id, name, category, active, default_minutes,
          service_variant (
            id, name, list_price_ugx, min_price_ugx, max_price_ugx, expected_minutes, active
          )
        `)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const mapped: ManagerCatalogueItem[] = (services || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        active: s.active,
        default_minutes: s.default_minutes,
        variants: (s.service_variant || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          list_price_ugx: Number(v.list_price_ugx),
          min_price_ugx: Number(v.min_price_ugx),
          max_price_ugx: Number(v.max_price_ugx),
          expected_minutes: v.expected_minutes,
          active: v.active,
        })),
      }));

      return ok(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching catalogue';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async updateVariantPrice(
    variantId: string,
    managerUserId: string,
    newListPrice: number,
    newMinPrice: number,
    newMaxPrice: number,
    reason: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: v } = await client.from('service_variant').select('*, service(organization_id, location_id)').eq('id', variantId).single();
      if (!v) return fail({ code: 'NOT_FOUND', message: 'Variant not found' });

      // Record price history
      await client.from('price_history').insert({
        service_variant_id: variantId,
        old_price_ugx: v.list_price_ugx,
        new_price_ugx: newListPrice,
        changed_by: managerUserId,
      });

      await client.from('service_variant').update({
        list_price_ugx: newListPrice,
        min_price_ugx: newMinPrice,
        max_price_ugx: newMaxPrice,
      }).eq('id', variantId);

      await client.from('audit_log').insert({
        organization_id: v.service?.organization_id,
        location_id: v.service?.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'PRICE_CHANGE',
        entity_type: 'service_variant',
        entity_id: variantId,
        category: 'price',
        reason,
        before: { list_price_ugx: v.list_price_ugx, min_price_ugx: v.min_price_ugx, max_price_ugx: v.max_price_ugx },
        after: { list_price_ugx: newListPrice, min_price_ugx: newMinPrice, max_price_ugx: newMaxPrice },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error updating price';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // ==========================================
  // PHASE 2: RULES
  // ==========================================
  async getDiscountRules(): Promise<Result<ManagerDiscountReason[]>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client
        .from('discount_reason')
        .select('id, code, label, active')
        .order('code', { ascending: true });

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      return ok(data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching discount reasons';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async toggleDiscountReason(reasonId: string, active: boolean, managerUserId: string): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: prev } = await client.from('discount_reason').select('*').eq('id', reasonId).single();
      if (!prev) return fail({ code: 'NOT_FOUND', message: 'Rule not found' });

      await client.from('discount_reason').update({ active }).eq('id', reasonId);

      await client.from('audit_log').insert({
        organization_id: prev.organization_id,
        location_id: prev.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'DISCOUNT_RULE_TOGGLED',
        entity_type: 'discount_reason',
        entity_id: reasonId,
        category: 'action',
        before: { active: prev.active },
        after: { active },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error toggling discount rule';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // ==========================================
  // PHASE 2: RECONCILIATION
  // ==========================================
  async getReconciliationData(): Promise<Result<ManagerReconciliationData>> {
    try {
      const client = getServiceRoleClient();
      const today = getKampalaDateString();
      const { data: bday } = await client
        .from('business_day')
        .select('*')
        .eq('business_date', today)
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!bday) return fail({ code: 'CONFLICT', message: 'No business day found for today' });

      // Live recorded payments for today
      const { data: payments } = await client
        .from('payment')
        .select('id, amount_ugx, method, status, provider_reference, confirmation_level, created_at')
        .eq('business_day_id', bday.id);

      const recordedTotal = (payments || [])
        .filter((p: any) => p.status === 'confirmed')
        .reduce((sum: number, p: any) => sum + Number(p.amount_ugx), 0);

      const recordedCash = (payments || [])
        .filter((p: any) => p.status === 'confirmed' && p.method === 'cash')
        .reduce((sum: number, p: any) => sum + Number(p.amount_ugx), 0);

      const recordedMoMo = (payments || [])
        .filter((p: any) => p.status === 'confirmed' && p.method === 'mobile_money')
        .reduce((sum: number, p: any) => sum + Number(p.amount_ugx), 0);

      // Latest statement import
      const { data: stmt } = await client
        .from('statement_import')
        .select('id, provider, total_records, total_ugx, imported_at')
        .order('imported_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let entries: ManagerReconciliationEntry[] = [];
      let statementTotal = 0;

      if (stmt) {
        const { data: entriesRaw } = await client
          .from('reconciliation_entry')
          .select('id, reference, amount_ugx, matched_payment_id, status, write_off_reason, reconciled_at')
          .eq('statement_import_id', stmt.id);

        statementTotal = Number(stmt.total_ugx);
        entries = (entriesRaw || []).map((e: any) => ({
          id: e.id,
          reference: e.reference,
          amount_ugx: Number(e.amount_ugx),
          matched_payment_id: e.matched_payment_id || undefined,
          status: e.status,
          write_off_reason: e.write_off_reason || undefined,
          reconciled_at: e.reconciled_at || undefined,
        }));
      }

      const difference = statementTotal - recordedMoMo;

      return ok({
        business_day_id: bday.id,
        business_date: bday.business_date,
        recorded_total_ugx: recordedTotal,
        recorded_cash_ugx: recordedCash,
        recorded_momo_ugx: recordedMoMo,
        statement_total_ugx: statementTotal,
        difference_ugx: difference,
        statement_provider: stmt?.provider || 'None',
        statement_imported_at: stmt?.imported_at || undefined,
        entries,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching reconciliation';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async writeOffReconciliationDiscrepancy(
    entryId: string,
    managerUserId: string,
    reason: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: entry } = await client.from('reconciliation_entry').select('*').eq('id', entryId).single();
      if (!entry) return fail({ code: 'NOT_FOUND', message: 'Reconciliation entry not found' });

      await client.from('reconciliation_entry').update({
        status: 'written_off',
        written_off_by: managerUserId,
        write_off_reason: reason,
        reconciled_at: new Date().toISOString(),
      }).eq('id', entryId);

      const { data: bday } = await client.from('business_day').select('id, organization_id, location_id').eq('status', 'open').maybeSingle();

      await client.from('audit_log').insert({
        organization_id: bday?.organization_id,
        location_id: bday?.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'WRITE_OFF',
        entity_type: 'reconciliation_entry',
        entity_id: entryId,
        category: 'money',
        reason,
        before: { status: entry.status },
        after: { status: 'written_off', write_off_reason: reason },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error writing off discrepancy';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // ==========================================
  // PHASE 2: DAY LIFECYCLE (OPEN / CLOSE / REOPEN)
  // ==========================================
  async beginCloseDay(
    businessDayId: string,
    managerUserId: string
  ): Promise<Result<{ open_visits_count: number }>> {
    try {
      const client = getServiceRoleClient();
      const { data: bday } = await client.from('business_day').select('*').eq('id', businessDayId).single();
      if (!bday) return fail({ code: 'NOT_FOUND', message: 'Business day not found' });

      const { count } = await client
        .from('visit')
        .select('id', { count: 'exact', head: true })
        .eq('business_day_id', businessDayId)
        .in('status', ['queued', 'in_service', 'ready_for_checkout', 'payment_pending']);

      await client.from('business_day').update({ status: 'closing' }).eq('id', businessDayId);

      await client.from('audit_log').insert({
        organization_id: bday.organization_id,
        location_id: bday.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'BEGIN_CLOSE_DAY',
        entity_type: 'business_day',
        entity_id: businessDayId,
        category: 'workflow',
        reason: 'Manager initiated day closing review',
        before: { status: bday.status },
        after: { status: 'closing' },
      });

      return ok({ open_visits_count: count || 0 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error starting day closing';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async cancelClosing(
    businessDayId: string,
    managerUserId: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: bday } = await client.from('business_day').select('*').eq('id', businessDayId).single();
      if (!bday) return fail({ code: 'NOT_FOUND', message: 'Business day not found' });

      await client.from('business_day').update({ status: 'open' }).eq('id', businessDayId);

      await client.from('audit_log').insert({
        organization_id: bday.organization_id,
        location_id: bday.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'CANCEL_CLOSING',
        entity_type: 'business_day',
        entity_id: businessDayId,
        category: 'workflow',
        reason: 'Manager resumed day operations',
        before: { status: bday.status },
        after: { status: 'open' },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error cancelling closing';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async undoClose(
    businessDayId: string,
    managerUserId: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: bday } = await client.from('business_day').select('*').eq('id', businessDayId).single();
      if (!bday) return fail({ code: 'NOT_FOUND', message: 'Business day not found' });

      if (bday.status !== 'closed' || !bday.closed_at) {
        return fail({ code: 'CONFLICT', message: 'Day is not closed.' });
      }

      const closedTime = new Date(bday.closed_at).getTime();
      const now = Date.now();
      const diffMinutes = (now - closedTime) / 60000;
      if (diffMinutes > 15) {
        return fail({ code: 'CONFLICT', message: 'Undo window (15 minutes) has expired. Use Emergency Reopen instead.' });
      }

      await client.from('business_day').update({
        status: 'open',
        closed_at: null,
        closed_by: null,
      }).eq('id', businessDayId);

      await client.from('audit_log').insert({
        organization_id: bday.organization_id,
        location_id: bday.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'UNDO_CLOSE',
        entity_type: 'business_day',
        entity_id: businessDayId,
        category: 'workflow',
        reason: 'Undo day close within 15-minute grace window',
        before: { status: bday.status, closed_at: bday.closed_at },
        after: { status: 'open' },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error undoing day close';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async closeBusinessDay(
    businessDayId: string,
    managerUserId: string,
    cashCountedUgx: number,
    notes?: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: bday } = await client.from('business_day').select('*').eq('id', businessDayId).single();
      if (!bday) return fail({ code: 'NOT_FOUND', message: 'Business day not found' });

      await client.from('business_day').update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by: managerUserId,
        cash_counted: cashCountedUgx,
      }).eq('id', businessDayId);

      await client.from('audit_log').insert({
        organization_id: bday.organization_id,
        location_id: bday.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'CLOSE_DAY',
        entity_type: 'business_day',
        entity_id: businessDayId,
        category: 'workflow',
        reason: notes || 'Daily operations closed by manager',
        before: { status: bday.status, cash_counted: bday.cash_counted },
        after: { status: 'closed', cash_counted: cashCountedUgx },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error closing day';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async reopenBusinessDay(
    businessDayId: string,
    managerUserId: string,
    reason: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: bday } = await client.from('business_day').select('*').eq('id', businessDayId).single();
      if (!bday) return fail({ code: 'NOT_FOUND', message: 'Business day not found' });

      await client.from('business_day').update({
        status: 'open',
        closed_at: null,
        closed_by: null,
      }).eq('id', businessDayId);

      await client.from('audit_log').insert({
        organization_id: bday.organization_id,
        location_id: bday.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'REOPEN_DAY',
        entity_type: 'business_day',
        entity_id: businessDayId,
        category: 'workflow',
        reason,
        before: { status: bday.status },
        after: { status: 'open' },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error reopening day';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // ==========================================
  // PHASE 3: STAFF ADMINISTRATION
  // ==========================================
  async getStaffList(): Promise<Result<ManagerStaffMember[]>> {
    try {
      const client = getServiceRoleClient();
      const { data: users, error } = await client
        .from('app_user')
        .select(`
          id, full_name, display_name, phone, role, status, start_date,
          staff_skill ( service_id )
        `)
        .order('role', { ascending: true })
        .order('display_name', { ascending: true });

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const { data: authUsers } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const usernameById = new Map((authUsers?.users || []).map((authUser) => [
        authUser.id,
        (authUser.email || '').split('@')[0],
      ]));

      const { data: targetsSetting } = await client
        .from('app_setting')
        .select('value')
        .eq('key', 'staff_targets')
        .maybeSingle();

      const targetsMap: Record<string, StaffTargetSetting> = (targetsSetting?.value as any) || {};

      // Calculate recent customer counts for staff
      const { data: doneLines } = await client
        .from('visit_service')
        .select('staff_user_id, visit_id')
        .eq('status', 'done');

      const staffVisitsMap: Record<string, Set<string>> = {};
      (doneLines || []).forEach((dl: any) => {
        if (!dl.staff_user_id) return;
        if (!staffVisitsMap[dl.staff_user_id]) staffVisitsMap[dl.staff_user_id] = new Set();
        staffVisitsMap[dl.staff_user_id].add(dl.visit_id);
      });

      const mapped: ManagerStaffMember[] = (users || []).map((u: any) => ({
        id: u.id,
        full_name: u.full_name,
        display_name: u.display_name,
        username: usernameById.get(u.id) || u.display_name.toLowerCase(),
        phone: u.phone,
        role: u.role,
        status: u.status,
        start_date: u.start_date,
        skill_count: (u.staff_skill || []).length,
        target: targetsMap[u.id],
        customers_served_period: staffVisitsMap[u.id]?.size || 0,
      }));

      return ok(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching staff';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async setStaffTarget(
    staffId: string,
    targetCustomers: number,
    period: 'weekly' | 'monthly' | '3-month',
    deadline: string,
    commissionBasePercent: number,
    managerUserId: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: setting } = await client
        .from('app_setting')
        .select('id, value')
        .eq('key', 'staff_targets')
        .maybeSingle();

      const existingTargets: Record<string, StaffTargetSetting> = (setting?.value as any) || {};
      existingTargets[staffId] = {
        staff_id: staffId,
        target_customers: targetCustomers,
        period,
        deadline,
        commission_base_percent: commissionBasePercent || 10,
      };

      if (setting) {
        await client
          .from('app_setting')
          .update({ value: existingTargets })
          .eq('id', setting.id);
      } else {
        const { data: loc } = await client.from('location').select('id').limit(1).single();
        if (loc) {
          await client
            .from('app_setting')
            .insert({
              location_id: loc.id,
              key: 'staff_targets',
              value: existingTargets,
            });
        }
      }

      // Log manager action to audit_log
      const { data: org } = await client.from('organization').select('id').limit(1).single();
      const { data: loc } = await client.from('location').select('id').limit(1).single();
      if (org && loc) {
        await client.from('audit_log').insert({
          organization_id: org.id,
          location_id: loc.id,
          actor_user_id: managerUserId,
          action: 'SET_STAFF_TARGET',
          category: 'operations',
          summary: `Set ${period} target of ${targetCustomers} customers for staff ${staffId} with deadline ${deadline}`,
          details: {
            staff_id: staffId,
            target_customers: targetCustomers,
            period,
            deadline,
            commission_base_percent: commissionBasePercent,
          },
        });
      }

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error setting staff target';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async toggleStaffStatus(userId: string, newStatus: 'active' | 'inactive', managerUserId: string): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: user } = await client.from('app_user').select('*, organization_id, location_id').eq('id', userId).single();
      if (!user) return fail({ code: 'NOT_FOUND', message: 'Staff member not found' });

      await client.from('app_user').update({ status: newStatus }).eq('id', userId);

      await client.from('audit_log').insert({
        organization_id: user.organization_id,
        location_id: user.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'STAFF_STATUS_UPDATE',
        entity_type: 'app_user',
        entity_id: userId,
        category: 'people',
        before: { status: user.status },
        after: { status: newStatus },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error updating staff status';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // ==========================================
  // PHASE 3: DEVICES & PAIRING
  // ==========================================
  async getDevices(): Promise<Result<ManagerDeviceItem[]>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client
        .from('device')
        .select(`
          id, kind, name, pairing_code, revoked_at, created_at,
          paired_by_user:app_user(display_name)
        `)
        .order('created_at', { ascending: false });

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const mapped: ManagerDeviceItem[] = (data || []).map((d: any) => ({
        id: d.id,
        kind: d.kind,
        name: d.name,
        pairing_code: d.pairing_code,
        revoked: Boolean(d.revoked_at),
        created_at: d.created_at,
        paired_by_name: d.paired_by_user?.display_name || 'System',
      }));

      return ok(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching devices';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async pairDevice(name: string, kind: 'reception_tablet' | 'queue_screen', managerUserId: string): Promise<Result<{ device_id: string; pairing_code: string }>> {
    try {
      const client = getServiceRoleClient();
      const { data: bday } = await client.from('business_day').select('organization_id, location_id').limit(1).single();
      const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
      const token = `TOK-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      const { data: dev, error } = await client.from('device').insert({
        organization_id: bday?.organization_id,
        location_id: bday?.location_id,
        kind,
        name,
        pairing_code: pairingCode,
        device_token: token,
        paired_by: managerUserId,
      }).select().single();

      if (error || !dev) return fail({ code: 'INTERNAL_ERROR', message: error?.message || 'Failed pairing' });

      await client.from('audit_log').insert({
        organization_id: bday?.organization_id,
        location_id: bday?.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'DEVICE_PAIRED',
        entity_type: 'device',
        entity_id: dev.id,
        category: 'access',
        after: { name, kind, pairing_code: pairingCode },
      });

      return ok({ device_id: dev.id, pairing_code: pairingCode });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error pairing device';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async revokeDevice(deviceId: string, managerUserId: string): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: dev } = await client.from('device').select('*, organization_id, location_id').eq('id', deviceId).single();
      if (!dev) return fail({ code: 'NOT_FOUND', message: 'Device not found' });

      await client.from('device').update({ revoked_at: new Date().toISOString() }).eq('id', deviceId);

      await client.from('audit_log').insert({
        organization_id: dev.organization_id,
        location_id: dev.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'DEVICE_REVOKED',
        entity_type: 'device',
        entity_id: deviceId,
        category: 'access',
        before: { revoked_at: null },
        after: { revoked_at: new Date().toISOString() },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error revoking device';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // ==========================================
  // PHASE 3: CUSTOMERS & MERGE
  // ==========================================
  async getCustomers(): Promise<Result<ManagerCustomerItem[]>> {
    try {
      const client = getServiceRoleClient();
      const { data: custs, error } = await client
        .from('customer')
        .select('id, first_name, phone_e164, merged_into, created_at')
        .is('merged_into', null)
        .order('created_at', { ascending: false });

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const { data: tierSetting } = await client
        .from('app_setting')
        .select('value')
        .eq('key', 'customer_tiers')
        .maybeSingle();

      const customerTiers = (tierSetting?.value as Record<string, { tier?: string; reason?: string; premium_since?: string }>) || {};

      const mapped: ManagerCustomerItem[] = (custs || []).map((c: any) => {
        const tierInfo = customerTiers[c.id];
        return {
          id: c.id,
          first_name: c.first_name,
          phone_e164: c.phone_e164,
          created_at: c.created_at,
          tier: (tierInfo?.tier as 'regular' | 'premium') || 'regular',
          premium_since: tierInfo?.premium_since,
          premium_reason: tierInfo?.reason,
        };
      });

      return ok(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching customers';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async setCustomerTier(
    customerId: string,
    tier: 'regular' | 'premium',
    reason: string,
    actorId: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: setting } = await client
        .from('app_setting')
        .select('value')
        .eq('key', 'customer_tiers')
        .maybeSingle();

      const tiers = (setting?.value as Record<string, any>) || {};
      const previous = tiers[customerId];

      if (tier === 'premium') {
        tiers[customerId] = {
          tier: 'premium',
          reason: reason.trim(),
          premium_since: previous?.premium_since || new Date().toISOString(),
        };
      } else {
        delete tiers[customerId];
      }

      const { error: upsertErr } = await client.from('app_setting').upsert(
        {
          location_id: this.locId,
          key: 'customer_tiers',
          value: tiers,
        },
        { onConflict: 'location_id,key' }
      );

      if (upsertErr) return fail({ code: 'INTERNAL_ERROR', message: upsertErr.message });

      await client.from('audit_log').insert({
        actor_id: actorId,
        actor_role: 'manager',
        action: tier === 'premium' ? 'MARK_CUSTOMER_PREMIUM' : 'UNMARK_CUSTOMER_PREMIUM',
        entity_type: 'customer',
        entity_id: customerId,
        reason: reason.trim(),
        category: 'reception',
        before: previous || { tier: 'regular' },
        after: { tier, reason: reason.trim() },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error setting customer tier';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async mergeCustomers(
    sourceCustomerId: string,
    targetCustomerId: string,
    managerUserId: string,
    reason: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: source } = await client.from('customer').select('*').eq('id', sourceCustomerId).single();
      const { data: target } = await client.from('customer').select('*').eq('id', targetCustomerId).single();

      if (!source || !target) return fail({ code: 'NOT_FOUND', message: 'Customer record not found' });

      // Move visits to target customer
      await client.from('visit').update({ customer_id: targetCustomerId }).eq('customer_id', sourceCustomerId);
      // Move appointments
      await client.from('appointment').update({ customer_id: targetCustomerId }).eq('customer_id', sourceCustomerId);
      // Mark source as merged
      await client.from('customer').update({ merged_into: targetCustomerId }).eq('id', sourceCustomerId);

      await client.from('audit_log').insert({
        organization_id: source.organization_id,
        location_id: source.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'CUSTOMER_MERGE',
        entity_type: 'customer',
        entity_id: targetCustomerId,
        category: 'customer',
        reason,
        before: { source_customer_id: sourceCustomerId },
        after: { target_customer_id: targetCustomerId },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error merging customers';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // ==========================================
  // PHASE 3: PAPER ENTRY & FORMS
  // ==========================================
  async enterPaperVisit(
    customerPhone: string,
    customerName: string,
    variantId: string,
    staffUserId: string | undefined,
    amountUgx: number,
    paperRef: string,
    managerUserId: string
  ): Promise<Result<{ ticket_code: string; visit_id: string }>> {
    try {
      const client = getServiceRoleClient();
      const { data: bday } = await client.from('business_day').select('*').eq('status', 'open').maybeSingle();
      if (!bday) return fail({ code: 'CONFLICT', message: 'No open business day found' });

      // Find or create customer
      let { data: cust } = await client.from('customer').select('id').eq('phone_e164', customerPhone).maybeSingle();
      if (!cust) {
        const { data: newCust } = await client.from('customer').insert({
          organization_id: bday.organization_id,
          location_id: bday.location_id,
          phone_e164: customerPhone,
          first_name: customerName,
          created_by: managerUserId,
        }).select().single();
        cust = newCust;
      }

      const ticketCode = `P${Math.floor(10 + Math.random() * 89)}`;

      const { data: visit, error: vErr } = await client.from('visit').insert({
        organization_id: bday.organization_id,
        location_id: bday.location_id,
        business_day_id: bday.id,
        customer_id: cust?.id,
        status: 'paid',
        source: 'walk_in',
        ticket_code: ticketCode,
      }).select().single();

      if (vErr || !visit) return fail({ code: 'INTERNAL_ERROR', message: vErr?.message || 'Failed creating visit' });

      // Record completed service line
      await client.from('visit_service').insert({
        organization_id: bday.organization_id,
        location_id: bday.location_id,
        visit_id: visit.id,
        service_variant_id: variantId,
        sequence_no: 1,
        status: 'done',
        assignment_mode: staffUserId ? 'named_strict' : 'pool',
        staff_user_id: staffUserId || null,
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
      });

      // Record cash payment
      await client.from('payment').insert({
        organization_id: bday.organization_id,
        location_id: bday.location_id,
        visit_id: visit.id,
        business_day_id: bday.id,
        method: 'cash',
        amount_ugx: amountUgx,
        status: 'confirmed',
        confirmation_level: 'attested',
        provider_reference: paperRef,
        idempotency_key: `PAPER-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        recorded_by: managerUserId,
      });

      await client.from('audit_log').insert({
        organization_id: bday.organization_id,
        location_id: bday.location_id,
        actor_id: managerUserId,
        actor_role: 'manager',
        action: 'PAPER_VISIT_ENTERED',
        entity_type: 'visit',
        entity_id: visit.id,
        category: 'operations',
        reason: `Paper tally sheet entry ref: ${paperRef}`,
        after: { ticket_code: ticketCode, amount_ugx: amountUgx },
      });

      return ok({ ticket_code: ticketCode, visit_id: visit.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error entering paper visit';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // ==========================================
  // PHASE 3: REPORTS
  // ==========================================
  async getManagerReportsData(): Promise<Result<ManagerReportsData>> {
    try {
      const client = getServiceRoleClient();
      const { data: bdays } = await client
        .from('business_day')
        .select('*')
        .order('business_date', { ascending: false })
        .limit(14);

      const { data: payments } = await client
        .from('payment')
        .select('amount_ugx, method, status, business_day_id, created_at')
        .eq('status', 'confirmed');

      const { data: visits } = await client
        .from('visit')
        .select('id, status, business_day_id');

      let totalRevenue = 0;
      let totalVisits = (visits || []).length;
      let cashRevenue = 0;
      let momoRevenue = 0;

      (payments || []).forEach((p: any) => {
        const amt = Number(p.amount_ugx);
        totalRevenue += amt;
        if (p.method === 'cash') cashRevenue += amt;
        if (p.method === 'mobile_money') momoRevenue += amt;
      });

      return ok({
        totalRevenueUgx: totalRevenue,
        cashRevenueUgx: cashRevenue,
        momoRevenueUgx: momoRevenue,
        totalVisitsCount: totalVisits,
        businessDaysCount: (bdays || []).length,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error generating reports';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }
}

export interface StaffTargetSetting {
  staff_id: string;
  target_customers: number;
  period: 'weekly' | 'monthly' | '3-month';
  deadline: string;
  commission_base_percent?: number;
}

export interface ManagerStaffMember {
  id: string;
  full_name: string;
  display_name: string;
  username: string;
  phone: string;
  role: string;
  status: string;
  start_date: string;
  skill_count: number;
  target?: StaffTargetSetting;
  customers_served_period?: number;
}

export interface ManagerDeviceItem {
  id: string;
  kind: string;
  name: string;
  pairing_code: string;
  revoked: boolean;
  created_at: string;
  paired_by_name: string;
}

export interface ManagerCustomerItem {
  id: string;
  first_name: string;
  phone_e164: string;
  created_at: string;
  tier?: 'regular' | 'premium';
  premium_since?: string;
  premium_reason?: string;
}

export interface ManagerReportsData {
  totalRevenueUgx: number;
  cashRevenueUgx: number;
  momoRevenueUgx: number;
  totalVisitsCount: number;
  businessDaysCount: number;
}


// Supporting Interfaces
export interface ManagerAppointmentItem {
  id: string;
  starts_at: string;
  expected_minutes: number;
  status: string;
  late: boolean;
  visit_id?: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  staff_name: string;
}

export interface ManagerCatalogueVariant {
  id: string;
  name: string;
  list_price_ugx: number;
  min_price_ugx: number;
  max_price_ugx: number;
  expected_minutes: number;
  active: boolean;
}

export interface ManagerCatalogueItem {
  id: string;
  name: string;
  category: string;
  active: boolean;
  default_minutes: number;
  variants: ManagerCatalogueVariant[];
}

export interface ManagerDiscountReason {
  id: string;
  code: string;
  label: string;
  active: boolean;
}

export interface ManagerReconciliationEntry {
  id: string;
  reference: string;
  amount_ugx: number;
  matched_payment_id?: string;
  status: 'unmatched' | 'matched' | 'written_off';
  write_off_reason?: string;
  reconciled_at?: string;
}

export interface ManagerReconciliationData {
  business_day_id: string;
  business_date: string;
  recorded_total_ugx: number;
  recorded_cash_ugx: number;
  recorded_momo_ugx: number;
  statement_total_ugx: number;
  difference_ugx: number;
  statement_provider: string;
  statement_imported_at?: string;
  entries: ManagerReconciliationEntry[];
}

