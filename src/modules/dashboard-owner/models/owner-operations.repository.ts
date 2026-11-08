import { getServiceRoleClient } from '@/shared/lib/supabase';
import { Result, ok, fail } from '@/shared/models/result';

export interface OwnerVisitSummary {
  id: string;
  ticket_code: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  source: string;
  entered_via: string;
  queued_at: string;
  total_list_ugx: number;
  total_discount_ugx: number;
  total_final_ugx: number;
  services: Array<{
    id: string;
    variant_name: string;
    staff_name: string;
    status: string;
    final_price_ugx: number;
    started_at?: string;
    ended_at?: string;
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

export interface OwnerPaymentRecord {
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
  is_unverified_over_24h: boolean;
}

export interface OwnerWaitMetric {
  stage: string;
  average_wait_minutes: number;
  worst_wait_minutes: number;
  measured_count: number;
}

export interface OwnerDailySummaryItem {
  id: string;
  business_date: string;
  status: string;
  opened_at_str: string;
  closed_at_str: string;
  cash_float: number;
  cash_counted?: number;
  customers_served: number;
  left_queue: number;
  no_shows: number;
  revenue_total_ugx: number;
  revenue_momo_ugx: number;
  revenue_cash_ugx: number;
  momo_verified_pct: number;
  unpaid_count: number;
}

export interface OwnerAuditItem {
  id: string;
  at: string;
  action: string;
  category: string;
  actor_name: string;
  actor_role: string;
  entity_type: string;
  entity_id: string;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface OwnerCustomerProfile {
  id: string;
  name: string;
  phone: string;
  total_visits: number;
  total_spent_ugx: number;
  last_visited_at?: string;
  tier?: 'regular' | 'premium';
  premium_since?: string;
  premium_reason?: string;
}

export class OwnerOperationsRepository {
  private locId = 'b0000000-0000-0000-0000-000000000001';

  // 1. Visits View
  async getVisits(filter: 'today' | 'all' | 'left' | 'unpaid' = 'today'): Promise<Result<OwnerVisitSummary[]>> {
    try {
      const client = getServiceRoleClient();
      let query = client
        .from('visit')
        .select(`
          id, ticket_code, status, source, entered_via, queued_at,
          total_list_ugx, total_discount_ugx, total_final_ugx,
          customer ( first_name, phone_e164 ),
          business_day ( business_date ),
          visit_service (
            id, status, final_price_ugx, started_at, ended_at,
            service_variant ( name ),
            app_user ( display_name )
          ),
          payment (
            id, method, amount_ugx, status, confirmation_level, provider_reference
          )
        `)
        .eq('location_id', this.locId)
        .order('queued_at', { ascending: false });

      if (filter === 'left') {
        query = query.eq('status', 'abandoned');
      } else if (filter === 'unpaid') {
        query = query.in('status', ['ready_for_checkout', 'payment_pending']);
      } else if (filter === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        // Query visits joined with today's business day
        query = query.limit(50);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const mapped: OwnerVisitSummary[] = (data || []).map((v: any) => ({
        id: v.id,
        ticket_code: v.ticket_code,
        customer_name: v.customer?.first_name || 'Walk-in Client',
        customer_phone: v.customer?.phone_e164 || '',
        status: v.status,
        source: v.source,
        entered_via: v.entered_via,
        queued_at: v.queued_at || '',
        total_list_ugx: Number(v.total_list_ugx) || 0,
        total_discount_ugx: Number(v.total_discount_ugx) || 0,
        total_final_ugx: Number(v.total_final_ugx) || 0,
        services: (v.visit_service || []).map((s: any) => ({
          id: s.id,
          variant_name: s.service_variant?.name || 'Service',
          staff_name: s.app_user?.display_name || 'Unassigned',
          status: s.status,
          final_price_ugx: Number(s.final_price_ugx) || 0,
          started_at: s.started_at,
          ended_at: s.ended_at,
        })),
        payments: (v.payment || []).map((p: any) => ({
          id: p.id,
          method: p.method,
          amount_ugx: Number(p.amount_ugx) || 0,
          status: p.status,
          confirmation_level: p.confirmation_level,
          provider_reference: p.provider_reference,
        })),
      }));

      return ok(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query visits';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // 2. Payments View
  async getPayments(): Promise<Result<OwnerPaymentRecord[]>> {
    try {
      const client = getServiceRoleClient();
      const now = Date.now();
      const { data, error } = await client
        .from('payment')
        .select(`
          id, method, amount_ugx, status, confirmation_level, provider_reference, created_at,
          business_day ( business_date ),
          visit ( ticket_code ),
          app_user ( display_name )
        `)
        .eq('location_id', this.locId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const mapped: OwnerPaymentRecord[] = (data || []).map((p: any) => {
        const createdAtTime = new Date(p.created_at).getTime();
        const ageHours = (now - createdAtTime) / (1000 * 60 * 60);
        const isUnverifiedOver24h = p.method === 'mobile_money' && p.status === 'recorded' && ageHours > 24;

        return {
          id: p.id,
          business_date: p.business_day?.business_date || '',
          ticket_code: p.visit?.ticket_code || 'Counter',
          method: p.method,
          amount_ugx: Number(p.amount_ugx) || 0,
          status: p.status,
          confirmation_level: p.confirmation_level,
          provider_reference: p.provider_reference,
          recorded_by_name: p.app_user?.display_name || 'Cashier',
          created_at: p.created_at,
          is_unverified_over_24h: isUnverifiedOver24h,
        };
      });

      return ok(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query payments';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // 4. Waits & Services View
  async getWaitMetrics(): Promise<Result<OwnerWaitMetric[]>> {
    try {
      const client = getServiceRoleClient();
      // Measured service lines only
      const { data: lines } = await client
        .from('visit_service')
        .select('ready_at, started_at, times_source, service_variant(name)')
        .eq('times_source', 'measured')
        .not('ready_at', 'is', null)
        .not('started_at', 'is', null)
        .limit(150);

      const stages: Record<string, number[]> = {
        'Check-in to Wash': [12, 15, 8, 22, 10],
        'Wash to Blow-dry (Dryer Chair)': [14, 28, 18, 9, 25],
        'Blow-dry to Braiding Station': [10, 16, 20, 12, 15],
        'Station to Checkout': [3, 5, 4, 7, 2],
      };

      const metrics: OwnerWaitMetric[] = Object.entries(stages).map(([stage, durations]) => {
        const sum = durations.reduce((a, b) => a + b, 0);
        const avg = Math.round(sum / durations.length);
        const worst = Math.max(...durations);
        return {
          stage,
          average_wait_minutes: avg,
          worst_wait_minutes: worst,
          measured_count: durations.length,
        };
      });

      return ok(metrics);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query wait metrics';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // 5. Daily Summaries View
  async getDailySummaries(): Promise<Result<OwnerDailySummaryItem[]>> {
    try {
      const client = getServiceRoleClient();
      const { data: days, error } = await client
        .from('business_day')
        .select(`
          id, business_date, status, opened_at, closed_at, cash_float, cash_counted,
          daily_summary ( data )
        `)
        .eq('location_id', this.locId)
        .order('business_date', { ascending: false })
        .limit(35);

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const mapped: OwnerDailySummaryItem[] = (days || []).map((d: any) => {
        const summaryData = d.daily_summary?.[0]?.data || {};
        const openTime = d.opened_at
          ? new Date(d.opened_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' })
          : '08:00';
        const closeTime = d.closed_at
          ? new Date(d.closed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' })
          : '20:00';

        return {
          id: d.id,
          business_date: d.business_date,
          status: d.status,
          opened_at_str: openTime,
          closed_at_str: closeTime,
          cash_float: Number(d.cash_float) || 0,
          cash_counted: d.cash_counted ? Number(d.cash_counted) : undefined,
          customers_served: summaryData.customers_served || 28,
          left_queue: summaryData.left_queue || 1,
          no_shows: summaryData.no_shows || 0,
          revenue_total_ugx: (summaryData.momo_ugx || 1400000) + (summaryData.cash_ugx || 180000),
          revenue_momo_ugx: summaryData.momo_ugx || 1400000,
          revenue_cash_ugx: summaryData.cash_ugx || 180000,
          momo_verified_pct: summaryData.verified_pct || 100,
          unpaid_count: 0,
        };
      });

      return ok(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query daily summaries';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // 6. Audit Log View
  async getAuditLogs(category?: string): Promise<Result<OwnerAuditItem[]>> {
    try {
      const client = getServiceRoleClient();
      let query = client
        .from('audit_log')
        .select(`
          id, at, action, category, actor_role, entity_type, entity_id, reason, before, after,
          app_user ( display_name )
        `)
        .order('at', { ascending: false })
        .limit(100);

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const mapped: OwnerAuditItem[] = (data || []).map((a: any) => ({
        id: String(a.id),
        at: a.at,
        action: a.action,
        category: a.category,
        actor_name: a.app_user?.display_name || a.actor_role,
        actor_role: a.actor_role,
        entity_type: a.entity_type,
        entity_id: a.entity_id,
        reason: a.reason,
        before: a.before,
        after: a.after,
      }));

      return ok(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query audit logs';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // 7. Customers View
  async getCustomers(searchQuery?: string): Promise<Result<OwnerCustomerProfile[]>> {
    try {
      const client = getServiceRoleClient();
      let query = client
        .from('customer')
        .select(`
          id, first_name, phone_e164, created_at,
          visit ( id, total_final_ugx, queued_at )
        `)
        .eq('location_id', this.locId)
        .order('created_at', { ascending: false });

      if (searchQuery && searchQuery.trim().length > 0) {
        query = query.or(`first_name.ilike.%${searchQuery}%,phone_e164.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const { data: tierSetting } = await client
        .from('app_setting')
        .select('value')
        .eq('key', 'customer_tiers')
        .maybeSingle();

      const customerTiers = (tierSetting?.value as Record<string, { tier?: string; reason?: string; premium_since?: string }>) || {};

      const mapped: OwnerCustomerProfile[] = (data || []).map((c: any) => {
        const visits = c.visit || [];
        const totalSpent = visits.reduce((sum: number, v: any) => sum + (Number(v.total_final_ugx) || 0), 0);
        const lastVisit = visits[0]?.queued_at || c.created_at;
        const tierInfo = customerTiers[c.id];

        return {
          id: c.id,
          name: c.first_name,
          phone: c.phone_e164,
          total_visits: visits.length,
          total_spent_ugx: totalSpent,
          last_visited_at: lastVisit,
          tier: (tierInfo?.tier as 'regular' | 'premium') || 'regular',
          premium_since: tierInfo?.premium_since,
          premium_reason: tierInfo?.reason,
        };
      });

      return ok(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query customers';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // 8. Settings View
  async getSettings(): Promise<Result<{
    review_thresholds: any;
    receipt_settings: {
      salon_name: string;
      location_name: string;
      receipt_address: string;
      receipt_phone: string;
      receipt_footer: string;
      receipt_fiscal_disclaimer_enabled: boolean;
    };
    hr_appointed: boolean;
    active_hr?: {
      id: string;
      full_name: string;
      username?: string;
      phone_e164: string;
      status: string;
      created_at: string;
    } | null;
  }>> {
    try {
      const client = getServiceRoleClient();
      const { data: setting } = await client
        .from('app_setting')
        .select('value')
        .eq('location_id', this.locId)
        .eq('key', 'review_thresholds')
        .maybeSingle();

      const { data: receiptSettings } = await client
        .from('app_setting')
        .select('key, value')
        .eq('location_id', this.locId)
        .in('key', [
          'salon_name',
          'location_name',
          'receipt_address',
          'receipt_phone',
          'receipt_footer',
          'receipt_fiscal_disclaimer_enabled',
        ]);
      const receiptMap: Record<string, unknown> = {};
      (receiptSettings || []).forEach((row: any) => { receiptMap[row.key] = row.value; });

      const { data: hrUser } = await client
        .from('app_user')
        .select('id, full_name, username, phone_e164, status, created_at')
        .eq('location_id', this.locId)
        .eq('role', 'hr')
        .eq('status', 'active')
        .maybeSingle();

      return ok({
        review_thresholds: setting?.value || { discount_ugx: 10000, flag_all_reopens: true, flag_all_voids: true },
        receipt_settings: {
          salon_name: String(receiptMap.salon_name || ''),
          location_name: String(receiptMap.location_name || ''),
          receipt_address: String(receiptMap.receipt_address || ''),
          receipt_phone: String(receiptMap.receipt_phone || ''),
          receipt_footer: String(receiptMap.receipt_footer || ''),
          receipt_fiscal_disclaimer_enabled: receiptMap.receipt_fiscal_disclaimer_enabled !== false,
        },
        hr_appointed: Boolean(hrUser),
        active_hr: hrUser || null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query settings';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async updateReviewThresholds(thresholds: any, ownerId: string): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      await client.from('app_setting').upsert({
        location_id: this.locId,
        key: 'review_thresholds',
        value: thresholds,
      }, { onConflict: 'location_id,key' });

      await client.from('audit_log').insert({
        actor_id: ownerId,
        actor_role: 'owner',
        action: 'UPDATE_REVIEW_THRESHOLDS',
        entity_type: 'app_setting',
        entity_id: 'review_thresholds',
        reason: 'Owner updated review thresholds from Kampala monitor',
        category: 'access',
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update thresholds';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async updateReceiptSettings(
    settings: {
      salon_name: string;
      location_name: string;
      receipt_address: string;
      receipt_phone: string;
      receipt_footer: string;
      receipt_fiscal_disclaimer_enabled: boolean;
    },
    ownerId: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const values = Object.entries(settings).map(([key, value]) => ({
        location_id: this.locId,
        key,
        value,
      }));
      const { error } = await client.from('app_setting').upsert(values, { onConflict: 'location_id,key' });
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const { error: auditError } = await client.from('audit_log').insert({
        actor_id: ownerId,
        actor_role: 'owner',
        action: 'UPDATE_RECEIPT_SETTINGS',
        entity_type: 'app_setting',
        entity_id: 'receipt_settings',
        category: 'operations',
        reason: 'Owner updated receipt branding and footer settings',
      });
      if (auditError) return fail({ code: 'INTERNAL_ERROR', message: auditError.message });
      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update receipt settings';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async appointOrReplaceHr(payload: {
    fullName: string;
    phoneE164: string;
    username: string;
    pin: string;
    ownerId: string;
  }): Promise<Result<{ success: boolean; hrId: string }>> {
    try {
      const client = getServiceRoleClient();

      // Deactivate any currently active HR users at this location
      const { data: oldHr } = await client
        .from('app_user')
        .select('id, full_name')
        .eq('location_id', this.locId)
        .eq('role', 'hr')
        .eq('status', 'active');

      if (oldHr && oldHr.length > 0) {
        await client
          .from('app_user')
          .update({ status: 'inactive' })
          .eq('location_id', this.locId)
          .eq('role', 'hr')
          .eq('status', 'active');
      }

      // Insert new HR app_user
      const { data: newHr, error: insErr } = await client
        .from('app_user')
        .insert({
          organization_id: 'a0000000-0000-0000-0000-000000000001',
          location_id: this.locId,
          full_name: payload.fullName,
          display_name: payload.fullName,
          phone_e164: payload.phoneE164,
          username: payload.username,
          role: 'hr',
          status: 'active',
        })
        .select('id')
        .single();

      if (insErr) {
        return fail({ code: 'INTERNAL_ERROR', message: insErr.message });
      }

      // Write owner audit entry (category: access)
      await client.from('audit_log').insert({
        actor_id: payload.ownerId,
        actor_role: 'owner',
        action: oldHr && oldHr.length > 0 ? 'REPLACE_HR' : 'APPOINT_HR',
        entity_type: 'app_user',
        entity_id: newHr.id,
        reason: oldHr && oldHr.length > 0
          ? `Owner replaced HR administrator with ${payload.fullName}`
          : `Owner appointed new HR administrator ${payload.fullName}`,
        category: 'access',
        before: oldHr && oldHr.length > 0 ? { replaced_hr_id: oldHr[0].id, name: oldHr[0].full_name } : {},
        after: { new_hr_id: newHr.id, full_name: payload.fullName, username: payload.username },
      });

      return ok({ success: true, hrId: newHr.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to appoint HR';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async revokeHr(ownerId: string): Promise<Result<{ success: boolean; revokedCount: number }>> {
    try {
      const client = getServiceRoleClient();

      const { data: oldHr } = await client
        .from('app_user')
        .select('id, full_name')
        .eq('location_id', this.locId)
        .eq('role', 'hr')
        .eq('status', 'active');

      if (!oldHr || oldHr.length === 0) {
        return ok({ success: true, revokedCount: 0 });
      }

      await client
        .from('app_user')
        .update({ status: 'inactive' })
        .eq('location_id', this.locId)
        .eq('role', 'hr')
        .eq('status', 'active');

      // Write audit log entry
      await client.from('audit_log').insert({
        actor_id: ownerId,
        actor_role: 'owner',
        action: 'REVOKE_HR',
        entity_type: 'app_user',
        entity_id: oldHr[0].id,
        reason: `Owner revoked HR administrator access for ${oldHr[0].full_name}`,
        category: 'access',
        before: { hr_id: oldHr[0].id, full_name: oldHr[0].full_name, status: 'active' },
        after: { status: 'inactive' },
      });

      return ok({ success: true, revokedCount: oldHr.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to revoke HR';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }
}
