import { getServiceRoleClient } from '@/shared/lib/supabase';
import { Result, ok, fail } from '@/shared/models/result';
import { getKampalaDateString } from '@/shared/lib/format-duration';

export interface BusinessDayState {
  id: string;
  business_date: string;
  status: 'open' | 'closing' | 'closed';
  opened_at: string;
  opened_by?: string;
  closed_at?: string | null;
  closed_by?: string | null;
  cash_float: number;
  cash_counted?: number | null;
  expected_open?: string;
  expected_close?: string;
  auto_closed?: boolean;
}

export interface DayHistoryRecord {
  id: string;
  business_date: string;
  status: string;
  opened_at: string;
  closed_at?: string | null;
  auto_closed?: boolean;
  cash_float: number;
  cash_counted?: number | null;
}

export class DayRepository {
  /**
   * Returns the business day for TODAY'S date in Africa/Kampala.
   * If today's day does not exist or is closed, returns status accurately.
   */
  async getTodayDay(): Promise<Result<BusinessDayState | null>> {
    try {
      const today = getKampalaDateString();
      const client = getServiceRoleClient();
      const { data, error } = await client
        .from('business_day')
        .select('*')
        .eq('business_date', today)
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return fail({ code: 'INTERNAL_ERROR', message: error.message });
      }
      return ok(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query today day';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  /**
   * Returns the most recent business day record regardless of date.
   */
  async getActiveDay(): Promise<Result<BusinessDayState | null>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client
        .from('business_day')
        .select('*')
        .order('business_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return fail({ code: 'INTERNAL_ERROR', message: error.message });
      }
      return ok(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query day';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  /**
   * Checks if an older business day is still open (unclosed overnight).
   */
  async getOlderOpenDay(): Promise<Result<BusinessDayState | null>> {
    try {
      const today = getKampalaDateString();
      const client = getServiceRoleClient();
      const { data, error } = await client
        .from('business_day')
        .select('*')
        .eq('status', 'open')
        .lt('business_date', today)
        .order('business_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return fail({ code: 'INTERNAL_ERROR', message: error.message });
      }
      return ok(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to check older open day';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  /**
   * Open the business day with cash float, actor validation, and optional backdate time & reason.
   * Can be performed by BOTH Manager and Receptionist.
   */
  async openDay(
    locationId: string,
    cashFloat: number,
    actorId?: string,
    backdateTime?: string,
    reason?: string
  ): Promise<Result<{ business_day_id: string }>> {
    try {
      const client = getServiceRoleClient();
      const today = getKampalaDateString();

      // Check if older open day exists
      const olderRes = await this.getOlderOpenDay();
      if (olderRes.success && olderRes.data) {
        return fail({
          code: 'CONFLICT',
          message: `Cannot open today: Day for ${olderRes.data.business_date} is still open. Close it first.`,
        });
      }

      // Check if today is already open
      const { data: existingDay } = await client
        .from('business_day')
        .select('id, status')
        .eq('location_id', locationId)
        .eq('business_date', today)
        .maybeSingle();

      if (existingDay && existingDay.status === 'open') {
        return fail({ code: 'CONFLICT', message: 'Business day is already open for today.' });
      }

      // Resolve actor
      let effectiveActorId = actorId;
      if (!effectiveActorId) {
        const { data: defaultUser } = await client
          .from('app_user')
          .select('id, role')
          .in('role', ['manager', 'receptionist'])
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        effectiveActorId = defaultUser?.id;
      }

      const { data: actor } = await client
        .from('app_user')
        .select('id, role, organization_id, display_name')
        .eq('id', effectiveActorId || '')
        .maybeSingle();

      if (!actor || !['manager', 'receptionist'].includes(actor.role)) {
        return fail({
          code: 'FORBIDDEN',
          message: 'Only manager or receptionist can open the business day.',
        });
      }

      const openedAt = backdateTime || new Date().toISOString();

      let dayId = '';
      if (existingDay) {
        // If today was previously closed and is reopened/restarted via open
        await client
          .from('business_day')
          .update({
            status: 'open',
            opened_at: openedAt,
            opened_by: actor.id,
            cash_float: cashFloat,
            closed_at: null,
            closed_by: null,
          })
          .eq('id', existingDay.id);
        dayId = existingDay.id;
      } else {
        const { data: inserted, error: insErr } = await client
          .from('business_day')
          .insert({
            organization_id: actor.organization_id || 'a0000000-0000-0000-0000-000000000001',
            location_id: locationId,
            business_date: today,
            status: 'open',
            opened_at: openedAt,
            opened_by: actor.id,
            cash_float: cashFloat,
          })
          .select('id')
          .single();

        if (insErr || !inserted) {
          return fail({ code: 'INTERNAL_ERROR', message: insErr?.message || 'Failed to insert day' });
        }
        dayId = inserted.id;
      }

      // Audit log event
      await client.from('audit_log').insert({
        organization_id: actor.organization_id || 'a0000000-0000-0000-0000-000000000001',
        location_id: locationId,
        actor_id: actor.id,
        actor_role: actor.role,
        action: 'OPEN_DAY',
        entity_type: 'business_day',
        entity_id: dayId,
        category: 'workflow',
        reason: reason || (backdateTime ? 'Backdated morning opening' : 'Morning business day opening'),
        before: existingDay ? { status: existingDay.status } : null,
        after: { status: 'open', cash_float: cashFloat, opened_at: openedAt },
        business_day_id: dayId,
      });

      // Activity event
      await client.from('activity_event').insert({
        location_id: locationId,
        message: `${actor.display_name} opened the business day`,
        actor_name: actor.display_name,
      });

      return ok({ business_day_id: dayId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to open day';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  /**
   * Fetch recent business days for history audit.
   */
  async getRecentDays(limit: number = 10): Promise<Result<DayHistoryRecord[]>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client
        .from('business_day')
        .select('id, business_date, status, opened_at, closed_at, auto_closed, cash_float, cash_counted')
        .order('business_date', { ascending: false })
        .limit(limit);

      if (error) {
        return fail({ code: 'INTERNAL_ERROR', message: error.message });
      }
      return ok(data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch day history';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }
}
