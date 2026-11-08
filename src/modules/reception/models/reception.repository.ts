import { getServiceRoleClient } from '@/shared/lib/supabase';
import { Result, ok, fail } from '@/shared/models/result';
import { normalizeUgPhone } from '@/shared/models/phone';
import { normalizeCustomerName } from '@/shared/lib/normalize-name';
import { getUnifiedStaffAttendanceToday, UnifiedAttendanceStatus } from '@/shared/lib/attendance-presence';

export interface ReceptionCustomerMatch {
  id: string;
  first_name: string;
  phone_e164: string;
  recent_visits?: {
    date: string;
    services: string;
    stylist?: string;
  }[];
  usual_stylist?: string;
  tier?: 'regular' | 'premium';
  premium_since?: string;
  premium_reason?: string;
}

export interface ReceptionStylistOption {
  id: string;
  display_name: string;
  full_name: string;
  status: UnifiedAttendanceStatus;
  current_queue_count: number;
  estimated_wait_minutes: number;
  service_ids: string[];
}

export interface ReceptionServiceLineDraft {
  service_id: string;
  variant_id: string;
  service_name: string;
  variant_name: string;
  list_price_ugx: number;
  original_price_ugx?: number;
  min_price_ugx: number;
  max_price_ugx: number;
  custom_price_ugx?: number;
  custom_price_reason?: string;
  expected_minutes: number;
  concurrent_with_previous: boolean;
  preferred_stylist_id?: string;
  preferred_stylist_strict: boolean;
}

export interface ReceptionKioskOrder {
  id: string;
  order_code: string;
  first_name: string;
  phone: string;
  total_ugx: number;
  created_at: string;
  claimed_by: string | null;
  claimed_at: string | null;
  claimant_name?: string | null;
  lines: ReceptionServiceLineDraft[];
}

export interface ReceptionKioskOrderListItem {
  id: string; order_code: string; first_name: string; phone: string; total_ugx: number;
  created_at: string; claimed_by: string | null; claimed_at: string | null; claimant_name?: string | null;
  status: 'draft' | 'expired' | 'cancelled'; services: { service_name: string; variant_name: string }[];
}

export interface ReceptionQueueItem {
  id: string;
  ticket_code: string;
  customer_id: string;
  customer_name: string;
  phone_e164: string;
  status: 'queued' | 'in_service' | 'payment_pending' | 'paid' | 'completed' | 'closed';
  queued_at: string;
  created_at?: string;
  services_summary: string;
  total_price_ugx: number;
  total_discount_ugx?: number;
  between_services_stage?: 'warn' | 'escalate' | null;
  idle_minutes?: number;
  lines: {
    id: string;
    variant_name: string;
    service_name?: string;
    staff_user_id?: string;
    staff_name?: string;
    status: 'blocked' | 'ready' | 'in_progress' | 'in_service' | 'done' | 'completed' | 'cancelled' | 'skipped';
    list_price_ugx: number;
    discount_ugx?: number;
    final_price_ugx: number;
    ready_at?: string;
    started_at?: string;
    ended_at?: string;
  }[];
  payments?: {
    id: string;
    method: string;
    amount_ugx: number;
    status: string;
    provider_reference?: string;
    created_at?: string;
    print_count?: number;
  }[];
}

export interface ReceptionStaffAttendanceSummary {
  staff_id: string;
  display_name: string;
  status: UnifiedAttendanceStatus;
  clock_in?: string;
  clock_out?: string;
}

export interface TabletDraftSession {
  mode: 'menu' | 'select' | 'confirm';
  phone_confirm?: string;
  selected_variants: {
    id: string;
    name: string;
    list_price_ugx: number;
    min_price_ugx: number;
    max_price_ugx: number;
    expected_minutes: number;
  }[];
  updated_at: string;
}

export class ReceptionOperationsRepository {
  async getKioskOrdersPage(actorId: string, status: 'waiting' | 'handling' | 'expired' | 'cancelled', search: string, limit = 50, offset = 0): Promise<Result<{ items: ReceptionKioskOrderListItem[]; total: number }>> {
    try {
      const { data, error } = await getServiceRoleClient().rpc('list_reception_kiosk_orders_page', {
        p_actor_id: actorId, p_status: status, p_search: search, p_limit: limit, p_offset: offset,
      });
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      return ok({
        total: Number(data?.total) || 0,
        items: (Array.isArray(data?.items) ? data.items : []).map((row: any) => ({
          id: row.id, order_code: row.order_code, first_name: row.first_name, phone: row.phone,
          total_ugx: Number(row.total_ugx) || 0, created_at: row.created_at,
          claimed_by: row.claimed_by || null, claimed_at: row.claimed_at || null,
          claimant_name: row.claimant_name || null, status: row.status,
          services: Array.isArray(row.services) ? row.services : [],
        })),
      });
    } catch (err) {
      return fail({ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Could not load kiosk orders.' });
    }
  }

  async getPendingKioskOrders(actorId: string): Promise<Result<ReceptionKioskOrder[]>> {
    try {
      // Match the same status filters and scoped RPC used by the Kiosk Orders
      // screen so Check-in's preview cannot drift from its source list. Include
      // currently claimed drafts because they are still unpaid and awaiting
      // reception confirmation.
      const [waiting, handling] = await Promise.all([
        this.getKioskOrdersPage(actorId, 'waiting', '', 50, 0),
        this.getKioskOrdersPage(actorId, 'handling', '', 50, 0),
      ]);
      if (!waiting.success) return fail(waiting.error);
      if (!handling.success) return fail(handling.error);
      const items = [...waiting.data.items, ...handling.data.items]
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      return ok(items.map((order) => ({
        ...order,
        lines: order.services.map((line) => ({
          service_id: '', variant_id: '', service_name: line.service_name,
          variant_name: line.variant_name, list_price_ugx: 0, min_price_ugx: 0,
          max_price_ugx: 0, expected_minutes: 0, preferred_stylist_strict: false,
          concurrent_with_previous: false,
        })),
      })));
    } catch (err) {
      return fail({ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Could not load kiosk orders.' });
    }
  }

  async kioskOrderCount(actorId: string): Promise<Result<number>> {
    const result = await this.getPendingKioskOrders(actorId);
    return result.success ? ok(result.data.length) : fail(result.error);
  }

  async getKioskDiscountApproval(orderId: string, requestedAmount: number): Promise<Result<{ approved: boolean; pending: boolean }>> {
    try {
      const { data, error } = await getServiceRoleClient().from('approval_request')
        .select('status,payload').eq('kind', 'discount').contains('payload', { visit_id: orderId })
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      const payload = (data?.payload || {}) as Record<string, unknown>;
      return ok({ approved: data?.status === 'approved' && Number(payload.decided_amount_ugx || 0) >= requestedAmount,
        pending: data?.status === 'pending' });
    } catch (err) {
      return fail({ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Could not check discount approval.' });
    }
  }

  async claimKioskOrder(orderId: string, actorId: string): Promise<Result<ReceptionKioskOrder>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client.rpc('claim_reception_kiosk_order', { p_order_id: orderId, p_actor_id: actorId });
      if (error) return fail({ code: 'CONFLICT', message: error.message });
      if (!data?.success) return fail({ code: 'CONFLICT', message: data?.message || 'Could not claim this order.' });

      // The claim RPC returns the current draft snapshot in the same transaction.
      // Use that snapshot directly: a second list query can race with claim/list
      // filters and leave the receptionist at an empty builder after a successful
      // claim.
      const rows = Array.isArray(data.order) ? data.order : [];
      const row = rows.find((item: any) => item.id === orderId);
      if (!row) return fail({ code: 'NOT_FOUND', message: 'The order was claimed but its details were not returned. Refresh the kiosk order list and reopen it.' });
      return ok({
        id: row.id,
        order_code: row.order_code,
        first_name: row.first_name,
        phone: row.phone,
        total_ugx: Number(row.total_ugx) || 0,
        created_at: row.created_at,
        claimed_by: row.claimed_by || null,
        claimed_at: row.claimed_at || null,
        claimant_name: row.claimant_name || null,
        lines: (Array.isArray(row.lines) ? row.lines : []).map((line: any) => ({
          service_id: line.service_id,
          variant_id: line.variant_id,
          service_name: line.service_name,
          variant_name: line.variant_name,
          list_price_ugx: Number(line.list_price_ugx) || 0,
          original_price_ugx: Number(line.original_price_ugx) || undefined,
          min_price_ugx: Number(line.min_price_ugx) || 0,
          max_price_ugx: Number(line.max_price_ugx) || 0,
          expected_minutes: Number(line.expected_minutes) || 0,
          preferred_stylist_id: line.preferred_stylist_id || undefined,
          preferred_stylist_strict: Boolean(line.preferred_stylist_id),
          concurrent_with_previous: false,
        })),
      });
    } catch (err) {
      return fail({ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Could not claim this order.' });
    }
  }

  async touchKioskClaim(orderId: string, actorId: string): Promise<Result<boolean>> {
    const { data, error } = await getServiceRoleClient().rpc('touch_reception_kiosk_claim', { p_order_id: orderId, p_actor_id: actorId });
    return error ? fail({ code: 'CONFLICT', message: error.message }) : ok(Boolean(data));
  }

  async releaseKioskOrder(orderId: string, actorId: string): Promise<Result<{ success: boolean }>> {
    const { data, error } = await getServiceRoleClient().rpc('release_reception_kiosk_order', { p_order_id: orderId, p_actor_id: actorId });
    if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
    return data?.success ? ok({ success: true }) : fail({ code: 'CONFLICT', message: data?.message || 'Could not release this order.' });
  }

  async cancelKioskOrder(orderId: string, actorId: string, reason: string): Promise<Result<{ success: boolean }>> {
    const { data, error } = await getServiceRoleClient().rpc('cancel_reception_kiosk_order', { p_order_id: orderId, p_actor_id: actorId, p_reason: reason });
    if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
    return data?.success ? ok({ success: true }) : fail({ code: 'CONFLICT', message: data?.message || 'Could not cancel this order.' });
  }

  async confirmKioskOrder(payload: {
    order_id: string; actor_id: string; first_name: string; phone: string;
    lines: ReceptionServiceLineDraft[]; discount_ugx: number; discount_reason?: string;
    method: 'cash' | 'mobile_money'; provider_reference?: string; idempotency_key: string; number_read_back: boolean;
  }): Promise<Result<{ visit_id: string; ticket_code: string; receipt_id: string; receipt_number: string; total_final_ugx: number }>> {
    try {
      const { data, error } = await getServiceRoleClient().rpc('confirm_reception_kiosk_order', {
        p_order_id: payload.order_id, p_actor_id: payload.actor_id, p_customer_first_name: payload.first_name,
        p_phone: payload.phone, p_lines: payload.lines.map((line) => ({
          variant_id: line.variant_id, preferred_stylist_id: line.preferred_stylist_id || null,
          concurrent_with_previous: line.concurrent_with_previous,
          price_ugx: line.custom_price_ugx ?? line.list_price_ugx,
          custom_price_reason: line.custom_price_reason || null,
        })), p_discount_ugx: payload.discount_ugx, p_discount_reason: payload.discount_reason || null,
        p_method: payload.method, p_provider_reference: payload.provider_reference || null,
        p_idempotency_key: payload.idempotency_key, p_number_read_back: payload.number_read_back,
      });
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      if (!data?.success) return fail({ code: data?.code || 'CONFLICT', message: data?.message || 'Could not confirm this payment.' });
      return ok({ visit_id: data.visit_id, ticket_code: data.ticket_code, receipt_id: data.receipt_id,
        receipt_number: data.receipt_number, total_final_ugx: Number(data.total_final_ugx) || 0 });
    } catch (err) {
      return fail({ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Could not confirm payment.' });
    }
  }

  async getBusinessDayStatus(): Promise<Result<{ is_open: boolean; business_day_id?: string; date?: string }>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client
        .from('business_day')
        .select('id, business_date, status')
        .eq('status', 'open')
        .order('business_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      if (!data) return ok({ is_open: false });

      return ok({
        is_open: true,
        business_day_id: data.id,
        date: data.business_date,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query business day status';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async lookupCustomers(phoneQuery: string): Promise<Result<ReceptionCustomerMatch[]>> {
    try {
      const client = getServiceRoleClient();
      const normalized = normalizeUgPhone(phoneQuery);

      const { data, error } = await client
        .from('customer')
        .select(`
          id, first_name, phone_e164,
          visit (
            id, queued_at, status,
            visit_service (
              staff_user:app_user(display_name),
              service_variant:service_variant(name)
            )
          )
        `)
        .eq('phone_e164', normalized)
        .is('merged_into', null)
        .limit(5);

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const { data: tierSetting } = await client
        .from('app_setting')
        .select('value')
        .eq('key', 'customer_tiers')
        .maybeSingle();

      const customerTiers = (tierSetting?.value as Record<string, { tier?: string; reason?: string; premium_since?: string }>) || {};

      const matches: ReceptionCustomerMatch[] = (data || []).map((c: any) => {
        const visits = (c.visit || [])
          .filter((v: any) => v.queued_at)
          .sort((a: any, b: any) => new Date(b.queued_at).getTime() - new Date(a.queued_at).getTime())
          .slice(0, 3)
          .map((v: any) => {
            const firstLine = v.visit_service?.[0];
            return {
              date: new Date(v.queued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
              services: (v.visit_service || []).map((s: any) => s.service_variant?.name).filter(Boolean).join(', '),
              stylist: firstLine?.staff_user?.display_name || undefined,
            };
          });

        const stylistCounts: Record<string, number> = {};
        (c.visit || []).forEach((v: any) => {
          (v.visit_service || []).forEach((s: any) => {
            const name = s.staff_user?.display_name;
            if (name) stylistCounts[name] = (stylistCounts[name] || 0) + 1;
          });
        });
        const usual_stylist = Object.entries(stylistCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        const tierInfo = customerTiers[c.id];

        return {
          id: c.id,
          first_name: c.first_name,
          phone_e164: c.phone_e164,
          recent_visits: visits,
          usual_stylist,
          tier: (tierInfo?.tier as 'regular' | 'premium') || 'regular',
          premium_since: tierInfo?.premium_since,
          premium_reason: tierInfo?.reason,
        };
      });

      return ok(matches);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to lookup customer profiles';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getStylistsToday(): Promise<Result<ReceptionStylistOption[]>> {
    try {
      const client = getServiceRoleClient();
      const unifiedRes = await getUnifiedStaffAttendanceToday();
      if (!unifiedRes.success) {
        return fail({ code: 'INTERNAL_ERROR', message: unifiedRes.error?.message || 'Failed to fetch attendance' });
      }

      // Filter to stylists (role === 'staff')
      const stylistsOnly = unifiedRes.data.staff.filter((s) => s.role === 'staff');

      // Get active queue lines count per staff
      const { data: activeLines } = await client
        .from('visit_service')
        .select('staff_user_id, status')
        .in('status', ['ready', 'in_service']);

      const queueCounts: Record<string, number> = {};
      (activeLines || []).forEach((l: any) => {
        if (l.staff_user_id) {
          queueCounts[l.staff_user_id] = (queueCounts[l.staff_user_id] || 0) + 1;
        }
      });

      const { data: skills } = await client.from('staff_skill').select('staff_user_id, service_id')
        .in('staff_user_id', stylistsOnly.map((staff) => staff.userId));
      const skillsByStaff: Record<string, string[]> = {};
      (skills || []).forEach((skill: any) => { (skillsByStaff[skill.staff_user_id] ||= []).push(skill.service_id); });

      const stylists: ReceptionStylistOption[] = stylistsOnly.map((u) => {
        const count = queueCounts[u.userId] || 0;
        const estimated_wait_minutes = count * 25; // 25 min baseline per queued ticket

        return {
          id: u.userId,
          display_name: u.displayName,
          full_name: u.fullName,
          status: u.status,
          current_queue_count: count,
          estimated_wait_minutes,
          service_ids: skillsByStaff[u.userId] || [],
        };
      });

      return ok(stylists);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stylists';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getLiveQueue(): Promise<Result<ReceptionQueueItem[]>> {
    try {
      const client = getServiceRoleClient();
      const bdayRes = await this.getBusinessDayStatus();
      if (!bdayRes.success || !bdayRes.data.is_open || !bdayRes.data.business_day_id) {
        return ok([]);
      }

      const { data, error } = await client
        .from('visit')
        .select(`
          id, ticket_code, status, queued_at, customer_id, total_final_ugx,
          customer:customer(first_name, phone_e164),
          visit_service (
            id, service_variant_id, staff_user_id, status, list_price_ugx, final_price_ugx, sequence_no, ready_at, started_at, ended_at,
            staff_user:app_user!visit_service_staff_user_id_fkey(display_name),
            service_variant:service_variant(name)
          )
        `)
        .eq('business_day_id', bdayRes.data.business_day_id)
        .in('status', ['queued', 'in_service', 'payment_pending'])
        .order('queued_at', { ascending: true });

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const now = Date.now();

      const items: ReceptionQueueItem[] = (data || []).map((v: any) => {
        const lines = (v.visit_service || [])
          .sort((a: any, b: any) => a.sequence_no - b.sequence_no)
          .map((l: any) => ({
            id: l.id,
            variant_name: l.service_variant?.name || 'Service',
            staff_user_id: l.staff_user_id,
            staff_name: l.staff_user?.display_name,
            status: l.status,
            list_price_ugx: Number(l.list_price_ugx),
            final_price_ugx: Number(l.final_price_ugx),
            started_at: l.started_at,
            ended_at: l.ended_at,
          }));

        // Detect between-services flag
        let between_services_stage: 'warn' | 'escalate' | null = null;
        let idle_minutes = 0;

        // A visit has a finished line, and next line is waiting/ready
        const lastEnded = lines.filter((l: any) => l.status === 'completed' && l.ended_at).sort((a: any, b: any) => new Date(b.ended_at!).getTime() - new Date(a.ended_at!).getTime())[0];
        const nextPending = lines.find((l: any) => l.status === 'ready');

        if (lastEnded && nextPending && lastEnded.ended_at) {
          const diffMinutes = Math.floor((now - new Date(lastEnded.ended_at).getTime()) / 60000);
          idle_minutes = diffMinutes;
          if (diffMinutes >= 15) {
            between_services_stage = 'escalate';
          } else if (diffMinutes >= 7) {
            between_services_stage = 'warn';
          }
        }

        const services_summary = lines.map((l: any) => l.variant_name).join(', ');

        return {
          id: v.id,
          ticket_code: v.ticket_code || 'A00',
          customer_id: v.customer_id,
          customer_name: (v.customer as any)?.first_name || 'Walk-in Guest',
          phone_e164: (v.customer as any)?.phone_e164 || '—',
          status: v.status,
          queued_at: v.queued_at || new Date().toISOString(),
          services_summary,
          total_price_ugx: Number(v.total_final_ugx) || 0,
          between_services_stage,
          idle_minutes,
          lines,
        };
      });

      return ok(items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query live queue';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async createVisitWithLines(payload: {
    customer: { id?: string; phone: string; first_name: string };
    lines: ReceptionServiceLineDraft[];
    receptionist_user_id: string;
    discount_ugx?: number;
    discount_reason?: string;
    payment?: {
      method: 'cash' | 'momo';
      amount_ugx: number;
      provider_reference?: string;
      idempotency_key: string;
    };
  }): Promise<Result<{
    ticket_code: string;
    visit_id: string;
    estimated_wait_minutes_range: [number, number];
    payment_id?: string;
    receipt_number?: string;
  }>> {
    try {
      const client = getServiceRoleClient();
      const bdayRes = await this.getBusinessDayStatus();
      if (!bdayRes.success || !bdayRes.data.is_open || !bdayRes.data.business_day_id) {
        return fail({ code: 'CONFLICT', message: 'The business day is not open. Ask the manager to open the day first.' });
      }
      const bdayId = bdayRes.data.business_day_id;

      // 1. Resolve or create customer
      let customerId = payload.customer.id;
      const normalizedPhone = normalizeUgPhone(payload.customer.phone);

      if (!customerId) {
        const { data: newCust, error: cErr } = await client
          .from('customer')
          .insert({
            organization_id: 'a0000000-0000-0000-0000-000000000001',
            location_id: 'b0000000-0000-0000-0000-000000000001',
            phone_e164: normalizedPhone,
            first_name: normalizeCustomerName(payload.customer.first_name),
          })
          .select('id')
          .single();

        if (cErr || !newCust) return fail({ code: 'INTERNAL_ERROR', message: cErr?.message || 'Failed to register customer' });
        customerId = newCust.id;
      }

      // Calculate total list & final
      let totalList = 0;
      let totalFinal = 0;
      payload.lines.forEach((l) => {
        const finalLinePrice = l.custom_price_ugx !== undefined ? l.custom_price_ugx : l.list_price_ugx;
        totalList += l.list_price_ugx;
        totalFinal += finalLinePrice;
      });

      const discountUgx = payload.discount_ugx || 0;
      totalFinal = Math.max(0, totalFinal - discountUgx);

      // Generate Ticket Code
      const { data: codeData, error: codeErr } = await client.rpc('next_ticket_code', {
        p_business_day_id: bdayId,
        p_prefix: 'A',
      });
      const ticketCode = codeData || 'A' + Math.floor(10 + Math.random() * 89);

      // 2. Insert Visit (status: 'queued' ready for immediate service dispatch)
      const { data: visit, error: vErr } = await client
        .from('visit')
        .insert({
          organization_id: 'a0000000-0000-0000-0000-000000000001',
          location_id: 'b0000000-0000-0000-0000-000000000001',
          business_day_id: bdayId,
          customer_id: customerId,
          status: 'queued',
          source: 'walk_in',
          ticket_code: ticketCode,
          total_list_ugx: totalList,
          total_discount_ugx: Math.max(0, totalList - totalFinal),
          total_final_ugx: totalFinal,
          queued_at: new Date().toISOString(),
          created_via: 'receptionist',
        })
        .select('id')
        .single();

      if (vErr || !visit) return fail({ code: 'INTERNAL_ERROR', message: vErr?.message || 'Failed to create visit' });

      // 3. Insert Service Lines
      for (let i = 0; i < payload.lines.length; i++) {
        const line = payload.lines[i];
        const linePrice = line.custom_price_ugx !== undefined ? line.custom_price_ugx : line.list_price_ugx;
        const lineDiscount = Math.max(0, line.list_price_ugx - linePrice);
        const isFirst = i === 0 || line.concurrent_with_previous;

        const { error: lineErr } = await client.from('visit_service').insert({
          visit_id: visit.id,
          service_variant_id: line.variant_id,
          staff_user_id: line.preferred_stylist_id || null,
          sequence_no: i + 1,
          status: isFirst ? 'ready' : 'blocked',
          list_price_ugx: line.list_price_ugx,
          discount_ugx: lineDiscount,
          final_price_ugx: linePrice,
          assignment_mode: line.preferred_stylist_id ? 'strict' : 'any',
          price_source: line.custom_price_ugx !== undefined ? 'custom_override' : 'catalogue',
          ready_at: isFirst ? new Date().toISOString() : null,
        });

        if (lineErr) {
          return fail({ code: 'INTERNAL_ERROR', message: lineErr.message });
        }
      }

      // 4. Payment-First: Record payment upfront if provided
      let paymentId: string | undefined;
      let receiptNumber: string | undefined;

      if (payload.payment) {
        receiptNumber = 'REC-' + Math.floor(100000 + Math.random() * 900000);
        const { data: newPay, error: pErr } = await client
          .from('payment')
          .insert({
            organization_id: 'a0000000-0000-0000-0000-000000000001',
            location_id: 'b0000000-0000-0000-0000-000000000001',
            visit_id: visit.id,
            business_day_id: bdayId,
            method: payload.payment.method === 'momo' ? 'mobile_money' : 'cash',
            provider: payload.payment.method === 'momo' ? 'mtn_airtel_manual' : 'manual',
            amount_ugx: payload.payment.amount_ugx,
            status: 'confirmed',
            confirmation_level: payload.payment.method === 'cash' ? 'confirmed_via_provider' : 'attested',
            provider_reference: payload.payment.provider_reference?.trim() || null,
            idempotency_key: payload.payment.idempotency_key,
            recorded_by: payload.receptionist_user_id,
          })
          .select('id')
          .single();

        if (!pErr && newPay) {
          paymentId = newPay.id;

          await client.from('audit_log').insert({
            actor_id: payload.receptionist_user_id,
            actor_role: 'receptionist',
            action: 'UPFRONT_PAYMENT_RECORDED',
            entity_type: 'payment',
            entity_id: paymentId,
            category: 'financial',
            business_day_id: bdayId,
            after: {
              visit_id: visit.id,
              ticket_code: ticketCode,
              method: payload.payment.method,
              amount_ugx: payload.payment.amount_ugx,
              receipt_number: receiptNumber,
            },
          });
        }
      }

      // 5. Log Audit Event
      await client.from('audit_log').insert({
        actor_id: payload.receptionist_user_id,
        actor_role: 'receptionist',
        action: 'VISIT_CREATED_PAYMENT_FIRST',
        entity_type: 'visit',
        entity_id: visit.id,
        category: 'operations',
        business_day_id: bdayId,
        after: {
          ticket_code: ticketCode,
          customer_id: customerId,
          lines_count: payload.lines.length,
          total_final_ugx: totalFinal,
          paid_upfront: Boolean(paymentId),
        },
      });

      // Clear any pending tablet draft if phone matched
      await client.from('desk_session').delete().match({ mode: 'confirm' });

      // Estimated wait calculation (15-35 min window)
      const minWait = 15;
      const maxWait = 35;

      return ok({
        ticket_code: ticketCode,
        visit_id: visit.id,
        estimated_wait_minutes_range: [minWait, maxWait],
        payment_id: paymentId,
        receipt_number: receiptNumber,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to confirm visit';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async requestManagerApproval(payload: {
    kind: 'discount' | 'remove_started_line' | 'dispute_adjustment' | 'late_appointment_conversion';
    receptionist_id: string;
    visit_id?: string;
    reason: string;
    details: Record<string, any>;
  }): Promise<Result<{ request_id: string }>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client
        .from('approval_request')
        .insert({
          organization_id: 'a0000000-0000-0000-0000-000000000001',
          location_id: 'b0000000-0000-0000-0000-000000000001',
          kind: payload.kind,
          payload: {
            visit_id: payload.visit_id,
            reason: payload.reason,
            ...payload.details,
          },
          requested_by: payload.receptionist_id,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error || !data) return fail({ code: 'INTERNAL_ERROR', message: error?.message || 'Failed to submit approval request' });

      return ok({ request_id: data.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error creating approval request';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async removeFromQueue(visitId: string, reason: string, actorUserId: string): Promise<Result<{ success: boolean }>> {
    try {
      if (!reason || reason.trim().length === 0) {
        return fail({ code: 'VALIDATION_ERROR', message: 'A reason code is mandatory to remove a visit from the queue.' });
      }
      const client = getServiceRoleClient();
      const { error } = await client
        .from('visit')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', visitId);

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      await client.from('audit_log').insert({
        actor_id: actorUserId,
        actor_role: 'receptionist',
        action: 'VISIT_CANCELLED',
        entity_type: 'visit',
        entity_id: visitId,
        category: 'operations',
        reason,
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to remove visit from queue';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async reassignLine(lineId: string, newStaffUserId: string, reason: string, actorUserId: string): Promise<Result<{ success: boolean }>> {
    try {
      if (!reason || reason.trim().length === 0) {
        return fail({ code: 'VALIDATION_ERROR', message: 'Reason required for stylist reassignment.' });
      }
      const client = getServiceRoleClient();
      const { error } = await client
        .from('visit_service')
        .update({ staff_user_id: newStaffUserId })
        .eq('id', lineId);

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      await client.from('audit_log').insert({
        actor_id: actorUserId,
        actor_role: 'receptionist',
        action: 'LINE_REASSIGNED',
        entity_type: 'visit_service',
        entity_id: lineId,
        category: 'operations',
        reason,
        after: { new_staff_user_id: newStaffUserId },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reassign line';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async startLineOnBehalf(lineId: string, reason: string, actorUserId: string): Promise<Result<{ success: boolean }>> {
    try {
      if (!reason || !reason.trim()) {
        return fail({ code: 'VALIDATION_ERROR', message: 'Reason is required when acting on behalf of staff.' });
      }

      const client = getServiceRoleClient();
      const now = new Date().toISOString();

      // Fetch line details
      const { data: line, error: lErr } = await client
        .from('visit_service')
        .select('id, visit_id, sequence_no, status, staff_user_id')
        .eq('id', lineId)
        .single();

      if (lErr || !line) {
        return fail({ code: 'NOT_FOUND', message: 'Service line not found.' });
      }

      if (line.status === 'in_progress') {
        return ok({ success: true });
      }

      // Check sequence rule: earlier sequential lines must be 'done'
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
            message: `Earlier step (sequence ${prevLine.sequence_no}) is not finished yet. Complete prior step before starting.`,
          });
        }
      }

      const { error } = await client
        .from('visit_service')
        .update({ status: 'in_progress', started_at: now })
        .eq('id', lineId);

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      // Ensure visit is in_service
      await client
        .from('visit')
        .update({ status: 'in_service', updated_at: now })
        .eq('id', line.visit_id);

      await client.from('audit_log').insert({
        actor_id: actorUserId,
        actor_role: 'receptionist',
        action: 'LINE_STARTED_ON_BEHALF',
        entity_type: 'visit_service',
        entity_id: lineId,
        category: 'operations',
        reason: reason.trim(),
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start line';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async finishLineOnBehalf(lineId: string, actorUserId: string, reason?: string): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const now = new Date().toISOString();

      // Find line and its visit
      const { data: line, error: lErr } = await client
        .from('visit_service')
        .select('id, visit_id, sequence_no, status')
        .eq('id', lineId)
        .single();

      if (lErr || !line) return fail({ code: 'NOT_FOUND', message: 'Service line not found.' });

      // 1. Mark line done (Postgres enum is 'done', releasing staff & station)
      await client
        .from('visit_service')
        .update({ status: 'done', ended_at: now })
        .eq('id', lineId);

      // 2. Ready next line if exists
      const { data: nextLine } = await client
        .from('visit_service')
        .select('id, status')
        .eq('visit_id', line.visit_id)
        .eq('sequence_no', line.sequence_no + 1)
        .maybeSingle();

      if (nextLine) {
        if (nextLine.status === 'blocked') {
          await client
            .from('visit_service')
            .update({ status: 'ready', ready_at: now })
            .eq('id', nextLine.id);
        }
      } else {
        // Check if any other lines remain unfinished
        const { data: remainingLines } = await client
          .from('visit_service')
          .select('id')
          .eq('visit_id', line.visit_id)
          .not('status', 'in', '("done","cancelled","skipped")');

        if (!remainingLines || remainingLines.length === 0) {
          const { data: payRecords } = await client
            .from('payment')
            .select('id, status')
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
        }
      }

      await client.from('audit_log').insert({
        actor_id: actorUserId,
        actor_role: 'receptionist',
        action: 'LINE_FINISHED_ON_BEHALF',
        entity_type: 'visit_service',
        entity_id: lineId,
        category: 'operations',
        reason: reason || 'Receptionist finished line on behalf of staff',
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to finish line';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async markStaffAttendanceOnBehalf(staffUserId: string, status: 'in' | 'late', reason: string, actorUserId: string): Promise<Result<{ success: boolean }>> {
    try {
      if (!reason || reason.trim().length === 0) {
        return fail({ code: 'VALIDATION_ERROR', message: 'Reason required to mark staff attendance.' });
      }
      const client = getServiceRoleClient();
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      const { data: existing } = await client
        .from('attendance')
        .select('id')
        .eq('staff_user_id', staffUserId)
        .eq('business_date', today)
        .maybeSingle();

      if (existing) {
        await client
          .from('attendance')
          .update({
            clock_in: now,
            absence_type: status === 'late' ? 'late' : 'none',
            corrected_by: actorUserId,
            corrected_reason: reason,
          })
          .eq('id', existing.id);
      } else {
        await client.from('attendance').insert({
          organization_id: 'a0000000-0000-0000-0000-000000000001',
          location_id: 'b0000000-0000-0000-0000-000000000001',
          staff_user_id: staffUserId,
          business_date: today,
          clock_in: now,
          absence_type: status === 'late' ? 'late' : 'none',
          corrected_by: actorUserId,
          corrected_reason: reason,
        });
      }

      await client.from('audit_log').insert({
        actor_id: actorUserId,
        actor_role: 'receptionist',
        action: 'STAFF_ATTENDANCE_OVERRIDE',
        entity_type: 'attendance',
        entity_id: staffUserId,
        category: 'operations',
        reason,
        after: { status, business_date: today },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to record attendance override';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getTabletDraft(): Promise<Result<TabletDraftSession | null>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client
        .from('desk_session')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      if (!data) return ok(null);

      return ok({
        mode: data.mode,
        phone_confirm: data.draft?.phone_confirm,
        selected_variants: data.draft?.selected_variants || [],
        updated_at: data.updated_at,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query tablet draft';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async pushTabletCategory(category: string | null): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: session } = await client.from('desk_session').select('id').limit(1).maybeSingle();

      if (session) {
        await client.from('desk_session').update({
          pushed_category: category,
          updated_at: new Date().toISOString(),
        }).eq('id', session.id);
      }
      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to push tablet category';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async revokeTabletDevice(deviceId: string, actorUserId: string): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const now = new Date().toISOString();

      await client
        .from('device')
        .update({ revoked_at: now })
        .eq('id', deviceId);

      await client.from('audit_log').insert({
        actor_id: actorUserId,
        actor_role: 'receptionist',
        action: 'DEVICE_REVOKED',
        entity_type: 'device',
        entity_id: deviceId,
        category: 'devices',
        reason: 'Receptionist revoked tablet device session',
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to revoke device';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getCheckoutVisits(): Promise<Result<{
    ready: ReceptionQueueItem[];
    today_totals: { cash_ugx: number; momo_ugx: number; total_ugx: number; paid_count: number };
  }>> {
    try {
      const client = getServiceRoleClient();
      const bdayRes = await this.getBusinessDayStatus();
      const bdayId = bdayRes.success ? bdayRes.data.business_day_id : undefined;

      let q = client
        .from('visit')
        .select(`
          id, ticket_code, status, queued_at, customer_id, total_list_ugx, total_final_ugx,
          customer:customer(first_name, phone_e164),
          visit_service (
            id, service_variant_id, staff_user_id, status, list_price_ugx, final_price_ugx, sequence_no,
            staff_user:app_user!visit_service_staff_user_id_fkey(display_name),
            service_variant:service_variant(name)
          )
        `)
        .in('status', ['ready_for_checkout', 'payment_pending'])
        .order('queued_at', { ascending: false });

      if (bdayId) {
        q = q.eq('business_day_id', bdayId);
      }

      const { data: visitsRaw, error: vErr } = await q;

      if (vErr) return fail({ code: 'INTERNAL_ERROR', message: vErr.message });

      const ready: ReceptionQueueItem[] = (visitsRaw || []).map((v: any) => {
        const lines = (v.visit_service || [])
          .sort((a: any, b: any) => a.sequence_no - b.sequence_no)
          .map((l: any) => ({
            id: l.id,
            variant_name: l.service_variant?.name || 'Service',
            staff_user_id: l.staff_user_id,
            staff_name: l.staff_user?.display_name,
            status: l.status,
            list_price_ugx: Number(l.list_price_ugx),
            final_price_ugx: Number(l.final_price_ugx),
          }));

        return {
          id: v.id,
          ticket_code: v.ticket_code || 'A00',
          customer_id: v.customer_id,
          customer_name: (v.customer as any)?.first_name || 'Customer',
          phone_e164: (v.customer as any)?.phone_e164 || '',
          status: v.status,
          queued_at: v.queued_at,
          created_at: v.created_at,
          services_summary: lines.map((l: any) => l.variant_name).join(', '),
          total_price_ugx: Number(v.total_final_ugx) || 0,
          total_discount_ugx: Number(v.total_discount_ugx) || 0,
          lines,
          payments: (v.payment || []).map((p: any) => ({
            id: p.id,
            method: p.method,
            amount_ugx: Number(p.amount_ugx),
            status: p.status,
            provider_reference: p.provider_reference,
            created_at: p.created_at,
          })),
        };
      });

      // 2. Today's Totals from payments
      let cash_ugx = 0;
      let momo_ugx = 0;
      let paid_count = 0;

      if (bdayId) {
        const { data: payments } = await client
          .from('payment')
          .select('method, amount_ugx, status')
          .eq('business_day_id', bdayId)
          .in('status', ['confirmed', 'recorded', 'reconciled']);

        (payments || []).forEach((p: any) => {
          const amt = Number(p.amount_ugx);
          paid_count++;
          if (p.method === 'cash') cash_ugx += amt;
          else momo_ugx += amt;
        });
      }

      return ok({
        ready,
        today_totals: {
          cash_ugx,
          momo_ugx,
          total_ugx: cash_ugx + momo_ugx,
          paid_count,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query checkout visits';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getVisitsTabsData(search?: string, dateRange?: { start?: string; end?: string }): Promise<Result<{
    active: ReceptionQueueItem[];
    completedToday: ReceptionQueueItem[];
    history: ReceptionQueueItem[];
    today_totals: { cash_ugx: number; momo_ugx: number; total_ugx: number; paid_count: number };
  }>> {
    try {
      const client = getServiceRoleClient();
      const bdayRes = await this.getBusinessDayStatus();
      const bdayId = bdayRes.success ? bdayRes.data.business_day_id : undefined;

      // Base query for all visits
      let q = client
        .from('visit')
        .select(`
          id, ticket_code, status, queued_at, created_at, customer_id, total_list_ugx, total_discount_ugx, total_final_ugx, business_day_id,
          customer:customer(id, first_name, phone_e164),
          visit_service (
            id, service_variant_id, staff_user_id, status, list_price_ugx, discount_ugx, final_price_ugx, sequence_no, ready_at, started_at, ended_at,
            staff_user:app_user!visit_service_staff_user_id_fkey(id, full_name, display_name),
            service_variant:service_variant(name, service(name))
          ),
          payment (
            id, method, amount_ugx, status, created_at, provider_reference
          ),
          receipt ( print_count )
        `)
        .order('created_at', { ascending: false });

      const { data: allVisitsRaw, error: vErr } = await q;
      if (vErr) return fail({ code: 'INTERNAL_ERROR', message: vErr.message });

      const mapped: ReceptionQueueItem[] = (allVisitsRaw || []).map((v: any) => {
        const lines = (v.visit_service || [])
          .sort((a: any, b: any) => a.sequence_no - b.sequence_no)
          .map((l: any) => ({
            id: l.id,
            variant_name: l.service_variant?.name || 'Service',
            service_name: l.service_variant?.service?.name || '',
            staff_user_id: l.staff_user_id,
            staff_name: l.staff_user?.display_name || l.staff_user?.full_name || 'Unassigned',
            status: l.status,
            list_price_ugx: Number(l.list_price_ugx) || 0,
            discount_ugx: Number(l.discount_ugx) || 0,
            final_price_ugx: Number(l.final_price_ugx) || 0,
            ready_at: l.ready_at,
            started_at: l.started_at,
            ended_at: l.ended_at,
          }));

        const receiptPrintCount = Number((v.receipt || [])[0]?.print_count || 1);
        return {
          id: v.id,
          ticket_code: v.ticket_code || 'A00',
          customer_id: v.customer_id,
          customer_name: (v.customer as any)?.first_name || 'Customer',
          phone_e164: (v.customer as any)?.phone_e164 || '',
          status: v.status,
          queued_at: v.queued_at,
          created_at: v.created_at,
          services_summary: lines.map((l: any) => l.variant_name).join(', '),
          total_price_ugx: Number(v.total_final_ugx) || 0,
          total_discount_ugx: Number(v.total_discount_ugx) || 0,
          lines,
          payments: (v.payment || []).map((p: any) => ({
            id: p.id,
            method: p.method,
            amount_ugx: Number(p.amount_ugx),
            status: p.status,
            provider_reference: p.provider_reference,
            created_at: p.created_at,
            print_count: receiptPrintCount,
          })),
        };
      });

      // Active tab: queued, in_service, payment_pending
      const active = mapped.filter((v) =>
        ['queued', 'in_service', 'payment_pending'].includes(v.status)
      );

      // Completed today tab: status in paid or closed, AND matches today's business day (or today's date if no open day)
      const completedToday = mapped.filter((v) => {
        const isDone = ['paid', 'closed'].includes(v.status);
        if (!isDone) return false;
        if (bdayId) {
          const raw = allVisitsRaw.find((x: any) => x.id === v.id);
          return raw?.business_day_id === bdayId;
        }
        const todayStr = new Date().toISOString().split('T')[0];
        return (v as any).created_at?.startsWith(todayStr);
      });

      // History tab: all, filtered by search query and optional date range
      let history = [...mapped];
      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        const digits = term.replace(/[^0-9]/g, '');
        history = history.filter((v) => {
          const nameMatch = v.customer_name.toLowerCase().includes(term);
          const ticketMatch = v.ticket_code.toLowerCase().includes(term);
          const phoneClean = (v.phone_e164 || '').replace(/[^0-9]/g, '');
          const phoneMatch = digits && phoneClean.includes(digits);
          return nameMatch || ticketMatch || phoneMatch;
        });
      }

      // Today's Totals from payments
      let cash_ugx = 0;
      let momo_ugx = 0;
      let paid_count = 0;

      if (bdayId) {
        const { data: payments } = await client
          .from('payment')
          .select('method, amount_ugx, status')
          .eq('business_day_id', bdayId)
          .in('status', ['confirmed', 'recorded', 'reconciled']);

        (payments || []).forEach((p: any) => {
          const amt = Number(p.amount_ugx);
          paid_count++;
          if (p.method === 'cash') cash_ugx += amt;
          else momo_ugx += amt;
        });
      }

      return ok({
        active,
        completedToday,
        history,
        today_totals: {
          cash_ugx,
          momo_ugx,
          total_ugx: cash_ugx + momo_ugx,
          paid_count,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query visits tabs data';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async recordPayment(payload: {
    visit_id: string;
    method: 'cash' | 'momo';
    amount_ugx: number;
    provider_reference?: string;
    idempotency_key: string;
    receptionist_user_id: string;
  }): Promise<Result<{ payment_id: string; receipt_number: string; is_overpayment: boolean }>> {
    try {
      const client = getServiceRoleClient();

      if (payload.method === 'momo' && (!payload.provider_reference || !payload.provider_reference.trim())) {
        return fail({ code: 'VALIDATION_ERROR', message: 'A transaction reference is mandatory for Mobile Money payments.' });
      }

      const { data: visit, error: vErr } = await client
        .from('visit')
        .select('id, business_day_id, organization_id, location_id, total_final_ugx, status, ticket_code')
        .eq('id', payload.visit_id)
        .single();

      if (vErr || !visit) return fail({ code: 'NOT_FOUND', message: 'Visit not found.' });

      const is_overpayment = payload.amount_ugx > Number(visit.total_final_ugx);
      const receiptNumber = 'REC-' + Math.floor(100000 + Math.random() * 900000);

      // Check existing payment with idempotency key
      const { data: existingPay } = await client
        .from('payment')
        .select('id')
        .eq('idempotency_key', payload.idempotency_key)
        .maybeSingle();

      let paymentId = existingPay?.id;

      if (!paymentId) {
        const { data: newPay, error: pErr } = await client
          .from('payment')
          .insert({
            organization_id: visit.organization_id,
            location_id: visit.location_id,
            visit_id: visit.id,
            business_day_id: visit.business_day_id,
            method: payload.method === 'momo' ? 'mobile_money' : 'cash',
            provider: payload.method === 'momo' ? 'mtn_airtel_manual' : 'manual',
            amount_ugx: payload.amount_ugx,
            status: 'confirmed',
            confirmation_level: payload.method === 'cash' ? 'confirmed_via_provider' : 'attested',
            provider_reference: payload.provider_reference ? payload.provider_reference.trim() : null,
            idempotency_key: payload.idempotency_key,
            recorded_by: payload.receptionist_user_id,
          })
          .select('id')
          .single();

        if (pErr || !newPay) return fail({ code: 'INTERNAL_ERROR', message: pErr?.message || 'Failed to record payment' });
        paymentId = newPay.id;
      }

      // Mark visit as paid/closed
      await client
        .from('visit')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', visit.id);

      // Log receipt print audit
      await client.from('audit_log').insert({
        actor_id: payload.receptionist_user_id,
        actor_role: 'receptionist',
        action: 'PAYMENT_RECORDED',
        entity_type: 'payment',
        entity_id: paymentId,
        category: 'financial',
        business_day_id: visit.business_day_id,
        after: {
          visit_id: visit.id,
          ticket_code: visit.ticket_code,
          method: payload.method,
          amount_ugx: payload.amount_ugx,
          is_overpayment,
          provider_reference: payload.provider_reference,
          receipt_number: receiptNumber,
        },
      });

      return ok({
        payment_id: paymentId,
        receipt_number: receiptNumber,
        is_overpayment,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error recording payment';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async flagPaymentPending(visitId: string, receptionistUserId: string, reason: string): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      await client
        .from('visit')
        .update({ status: 'payment_pending', updated_at: new Date().toISOString() })
        .eq('id', visitId);

      await client.from('audit_log').insert({
        actor_id: receptionistUserId,
        actor_role: 'receptionist',
        action: 'PAYMENT_PENDING_FLAGGED',
        entity_type: 'visit',
        entity_id: visitId,
        category: 'financial',
        reason: reason || 'Customer states they paid; awaiting mobile money network SMS confirmation',
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to flag payment pending';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getAppointments(): Promise<Result<{
    appointments: any[];
    stylists: { id: string; name: string }[];
  }>> {
    try {
      const client = getServiceRoleClient();
      const todayDate = new Date().toISOString().split('T')[0];

      const { data: apps, error: aErr } = await client
        .from('appointment')
        .select(`
          id, starts_at, expected_minutes, status, late, visit_id,
          customer:customer(id, first_name, phone_e164),
          staff_user:app_user(id, display_name),
          service:service(id, name)
        `)
        .order('starts_at', { ascending: true });

      if (aErr) return fail({ code: 'INTERNAL_ERROR', message: aErr.message });

      const { data: staffList } = await client
        .from('app_user')
        .select('id, display_name')
        .eq('role', 'staff')
        .eq('status', 'active');

      const mapped = (apps || []).map((a: any) => ({
        id: a.id,
        starts_at: a.starts_at,
        expected_minutes: a.expected_minutes,
        status: a.status,
        is_late: a.late,
        visit_id: a.visit_id,
        customer_name: a.customer?.first_name || 'Guest',
        customer_phone: a.customer?.phone_e164 || '',
        stylist_id: a.staff_user?.id,
        stylist_name: a.staff_user?.display_name || 'Unassigned',
        service_name: a.service?.name || 'Hair Care',
      }));

      const { data: servicesList } = await client
        .from('service')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      return ok({
        appointments: mapped,
        stylists: (staffList || []).map((s: any) => ({ id: s.id, name: s.display_name })),
        services: (servicesList || []).map((srv: any) => ({ id: srv.id, name: srv.name })),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query appointments';
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
    actorUserId?: string;
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
        return fail({ code: 'NOT_FOUND', message: 'Salon location not found' });
      }

      // 1. Find or create customer
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

      // 2. Insert appointment
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

  async convertAppointmentToVisit(appointmentId: string, receptionistUserId: string): Promise<Result<{ ticket_code: string; visit_id: string }>> {
    try {
      const client = getServiceRoleClient();
      const { data: app, error } = await client
        .from('appointment')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (error || !app) return fail({ code: 'NOT_FOUND', message: 'Appointment not found' });

      // Check 15-minute grace period
      const appointmentStart = new Date(app.starts_at).getTime();
      const nowTime = Date.now();
      const diffMinutes = Math.floor((nowTime - appointmentStart) / 60000);

      if (diffMinutes > 15) {
        // Exceeded grace period -> Receptionist CANNOT slot in directly!
        await client.from('appointment').update({ late: true }).eq('id', appointmentId);
        return fail({
          code: 'FORBIDDEN',
          message: `Appointment is ${diffMinutes} minutes past schedule (exceeds 15-minute grace period). Request manager approval to slot in as walk-in.`,
        });
      }

      // Convert into queued visit
      const bdayRes = await this.getBusinessDayStatus();
      if (!bdayRes.success || !bdayRes.data.is_open || !bdayRes.data.business_day_id) {
        return fail({ code: 'CONFLICT', message: 'Business day not open.' });
      }
      const bdayId = bdayRes.data.business_day_id;

      const { data: codeData } = await client.rpc('next_ticket_code', {
        p_business_day_id: bdayId,
        p_prefix: 'A',
      });
      const ticketCode = codeData || 'A' + Math.floor(10 + Math.random() * 89);

      const { data: visit, error: vErr } = await client
        .from('visit')
        .insert({
          organization_id: app.organization_id,
          location_id: app.location_id,
          business_day_id: bdayId,
          customer_id: app.customer_id,
          status: 'queued',
          source: 'appointment',
          ticket_code: ticketCode,
          queued_at: new Date().toISOString(),
          created_by_role: 'receptionist',
        })
        .select('id')
        .single();

      if (vErr || !visit) return fail({ code: 'INTERNAL_ERROR', message: vErr?.message || 'Could not create visit' });

      // Link appointment
      await client.from('appointment').update({ status: 'completed', visit_id: visit.id }).eq('id', appointmentId);

      return ok({ ticket_code: ticketCode, visit_id: visit.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error converting appointment';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async markAppointmentLate(appointmentId: string, receptionistUserId: string): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      await client.from('appointment').update({ late: true, status: 'late' }).eq('id', appointmentId);
      await client.from('audit_log').insert({
        actor_id: receptionistUserId,
        actor_role: 'receptionist',
        action: 'APPOINTMENT_MARKED_LATE',
        entity_type: 'appointment',
        entity_id: appointmentId,
        category: 'operations',
      });
      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark appointment late';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async cancelAppointment(appointmentId: string, reason: string, receptionistUserId: string): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      await client.from('appointment').update({ status: 'cancelled' }).eq('id', appointmentId);
      await client.from('audit_log').insert({
        actor_id: receptionistUserId,
        actor_role: 'receptionist',
        action: 'APPOINTMENT_CANCELLED',
        entity_type: 'appointment',
        entity_id: appointmentId,
        category: 'operations',
        reason,
      });
      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel appointment';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getCustomersList(searchQuery?: string): Promise<Result<any[]>> {
    try {
      const client = getServiceRoleClient();
      let query = client
        .from('customer')
        .select(`
          id, first_name, phone_e164, created_at,
          visit (
            id, ticket_code, status, queued_at, total_final_ugx,
            payment ( id, method, provider_reference, created_at ),
            visit_service (
              id, final_price_ugx,
              service_variant:service_variant(name)
            )
          )
        `)
        .is('merged_into', null)
        .order('created_at', { ascending: false })
        .limit(100);

      const { data, error } = await query;
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      // Calculate shared phones counts across all profiles
      const phoneProfileCounts: Record<string, number> = {};
      (data || []).forEach((c: any) => {
        const cleanDigits = (c.phone_e164 || '').replace(/[^0-9]/g, '');
        if (cleanDigits) {
          phoneProfileCounts[cleanDigits] = (phoneProfileCounts[cleanDigits] || 0) + 1;
        }
      });

      let mapped = (data || []).map((c: any) => {
        const visits = (c.visit || []).map((v: any) => {
          const lines = (v.visit_service || []).map((l: any) => l.service_variant?.name).filter(Boolean);
          const pay = v.payment?.[0];
          return {
            visit_id: v.id,
            ticket_code: v.ticket_code,
            status: v.status,
            date: v.queued_at ? new Date(v.queued_at).toLocaleDateString('en-GB') : '—',
            services: lines.join(', ') || 'Service',
            total_price_ugx: Number(v.total_final_ugx) || 0,
            payment_ref: pay?.provider_reference || pay?.method || 'Unpaid',
            receipt_no: pay?.id ? 'REC-' + pay.id.slice(0, 6).toUpperCase() : '—',
          };
        });

        const cleanDigits = (c.phone_e164 || '').replace(/[^0-9]/g, '');
        const sharedCount = phoneProfileCounts[cleanDigits] || 1;

        return {
          id: c.id,
          first_name: c.first_name,
          phone_e164: c.phone_e164,
          created_at: c.created_at,
          total_visits: visits.length,
          shared_count: sharedCount,
          visits,
        };
      });

      // Filter in-memory for flexible matching: name (case-insensitive substring) or phone digits (any contiguous digit match)
      if (searchQuery && searchQuery.trim()) {
        const term = searchQuery.trim().toLowerCase();
        const digits = term.replace(/[^0-9]/g, '');
        mapped = mapped.filter((c: any) => {
          const nameMatch = (c.first_name || '').toLowerCase().includes(term);
          const phoneClean = (c.phone_e164 || '').replace(/[^0-9]/g, '');
          const phoneMatch = digits && phoneClean.includes(digits);
          return nameMatch || phoneMatch;
        });
      }

      return ok(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query customer list';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async updateCustomerFirstName(customerId: string, newFirstName: string, receptionistUserId: string): Promise<Result<{ success: boolean }>> {
    try {
      if (!newFirstName || !newFirstName.trim()) {
        return fail({ code: 'VALIDATION_ERROR', message: 'First name cannot be empty.' });
      }
      const client = getServiceRoleClient();
      await client
        .from('customer')
        .update({ first_name: newFirstName.trim() })
        .eq('id', customerId);

      await client.from('audit_log').insert({
        actor_id: receptionistUserId,
        actor_role: 'receptionist',
        action: 'CUSTOMER_NAME_CORRECTED',
        entity_type: 'customer',
        entity_id: customerId,
        category: 'customers',
        after: { first_name: newFirstName.trim() },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update customer name';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async logCustomerProfilePdfExport(customerId: string, receptionistUserId: string): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      await client.from('audit_log').insert({
        actor_id: receptionistUserId,
        actor_role: 'receptionist',
        action: 'CLIENT_PROFILE_EXPORTED_PDF',
        entity_type: 'customer',
        entity_id: customerId,
        category: 'customers',
        reason: 'Receptionist printed / exported customer visit history PDF',
      });
      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to log PDF export';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getClosePrepData(): Promise<Result<{
    open_visits: Array<{ id: string; ticket_code: string; customer_name: string; status: string; total_ugx: number }>;
    unpaid_visits: Array<{ id: string; ticket_code: string; customer_name: string; total_ugx: number }>;
    pending_kiosk_orders: Array<{ id: string; order_code: string; first_name: string; created_at: string }>;
    system_cash_ugx: number;
    system_momo_ugx: number;
    total_sales_ugx: number;
    completed_checkouts: number;
    prepared_cash_count?: number;
    prepared_at?: string;
  }>> {
    try {
      const client = getServiceRoleClient();
      const bdayRes = await this.getBusinessDayStatus();
      if (!bdayRes.success || !bdayRes.data.is_open || !bdayRes.data.business_day_id) {
        return fail({ code: 'CONFLICT', message: 'Business day is not open.' });
      }
      const bdayId = bdayRes.data.business_day_id;

      const { data: kioskOrders, error: kioskError } = await client.from('visit')
        .select('id, order_code, draft_first_name, created_at')
        .eq('business_day_id', bdayId).eq('created_via', 'desk_tablet').eq('status', 'draft')
        .order('created_at', { ascending: true });
      if (kioskError) return fail({ code: 'INTERNAL_ERROR', message: kioskError.message });

      // 1. Unfinished active visits in salon
      const { data: openRaw } = await client
        .from('visit')
        .select('id, ticket_code, status, total_final_ugx, customer(first_name)')
        .eq('business_day_id', bdayId)
        .in('status', ['queued', 'in_service', 'payment_pending'])
        .order('queued_at', { ascending: true });

      const open_visits = (openRaw || []).map((v: any) => ({
        id: v.id,
        ticket_code: v.ticket_code || 'TICKET',
        customer_name: (v.customer as any)?.first_name || 'Walk-in Guest',
        status: v.status,
        total_ugx: Number(v.total_final_ugx) || 0,
      }));

      // 2. Unpaid visits (ready_for_checkout)
      const { data: readyRaw } = await client
        .from('visit')
        .select('id, ticket_code, total_final_ugx, customer(first_name)')
        .eq('business_day_id', bdayId)
        .eq('status', 'ready_for_checkout')
        .order('queued_at', { ascending: true });

      const unpaid_visits = (readyRaw || []).map((v: any) => ({
        id: v.id,
        ticket_code: v.ticket_code || 'TICKET',
        customer_name: (v.customer as any)?.first_name || 'Walk-in Guest',
        total_ugx: Number(v.total_final_ugx) || 0,
      }));

      // 3. Payment totals
      const { data: payments } = await client
        .from('payment')
        .select('method, amount_ugx')
        .eq('business_day_id', bdayId)
        .eq('status', 'confirmed');

      let system_cash_ugx = 0;
      let system_momo_ugx = 0;
      let completed_checkouts = 0;

      (payments || []).forEach((p: any) => {
        completed_checkouts++;
        const amt = Number(p.amount_ugx);
        if (p.method === 'cash') system_cash_ugx += amt;
        else system_momo_ugx += amt;
      });

      // 4. Check if prep audit row already exists
      const { data: prepLog } = await client
        .from('audit_log')
        .select('after, at')
        .eq('business_day_id', bdayId)
        .eq('action', 'DAY_CLOSE_PREPARATION_SUBMITTED')
        .order('at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return ok({
        open_visits,
        unpaid_visits,
        pending_kiosk_orders: (kioskOrders || []).map((order: any) => ({ id: order.id, order_code: order.order_code, first_name: order.draft_first_name, created_at: order.created_at })),
        system_cash_ugx,
        system_momo_ugx,
        total_sales_ugx: system_cash_ugx + system_momo_ugx,
        completed_checkouts,
        prepared_cash_count: (prepLog?.after as any)?.counted_cash_ugx,
        prepared_at: prepLog?.at,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query close prep data';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async submitClosePrepCashCount(countedCashUgx: number, notes: string, receptionistUserId: string): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const bdayRes = await this.getBusinessDayStatus();
      if (!bdayRes.success || !bdayRes.data.is_open || !bdayRes.data.business_day_id) {
        return fail({ code: 'CONFLICT', message: 'Business day is not open.' });
      }
      const bdayId = bdayRes.data.business_day_id;

      await client.from('audit_log').insert({
        organization_id: 'a0000000-0000-0000-0000-000000000001',
        location_id: 'b0000000-0000-0000-0000-000000000001',
        actor_id: receptionistUserId,
        actor_role: 'receptionist',
        action: 'DAY_CLOSE_PREPARATION_SUBMITTED',
        entity_type: 'business_day',
        entity_id: bdayId,
        business_day_id: bdayId,
        category: 'money',
        reason: notes || 'Reception physical drawer count submitted for manager handover',
        after: {
          counted_cash_ugx: countedCashUgx,
          prepared_by: receptionistUserId,
          submitted_at: new Date().toISOString(),
        },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit close prep count';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }
}
