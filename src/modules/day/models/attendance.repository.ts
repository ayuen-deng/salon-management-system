import { supabase, getServiceRoleClient } from '@/shared/lib/supabase';
import { Result, ok, fail } from '@/shared/models/result';
import { getKampalaDateString } from '@/shared/lib/attendance-presence';

export type AttendanceStatus = 'out' | 'in' | 'break';

export interface MyAttendanceState {
  status: AttendanceStatus;
  clockInTime: string | null;
  breakStartedAt: string | null;
  businessDate: string;
}

export class AttendanceRepository {
  async getScheduledStart(userId: string): Promise<string | null> {
    const { data } = await getServiceRoleClient().from('staff_presence_today')
      .select('scheduled_start_time')
      .eq('user_id', userId).maybeSingle();
    return data?.scheduled_start_time?.slice(0, 5) || null;
  }

  async getMyTodayAttendance(userId: string): Promise<Result<MyAttendanceState>> {
    try {
      const today = getKampalaDateString();
      const client = getServiceRoleClient();
      
      const { data, error } = await client
        .from('attendance')
        .select('*')
        .eq('staff_user_id', userId)
        .eq('business_date', today)
        .maybeSingle();

      if (error) {
        return fail({ code: 'INTERNAL_ERROR', message: error.message });
      }

      if (!data) {
        return ok({
          status: 'out',
          clockInTime: null,
          breakStartedAt: null,
          businessDate: today,
        });
      }

      let currentStatus: AttendanceStatus = 'out';
      if (data.clock_out) {
        currentStatus = 'out';
      } else if (data.on_break) {
        currentStatus = 'break';
      } else if (data.clock_in) {
        currentStatus = 'in';
      }

      return ok({
        status: currentStatus,
        clockInTime: data.clock_in,
        breakStartedAt: data.break_started_at,
        businessDate: today,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get attendance';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async setMyAttendance(
    userId: string,
    targetStatus: AttendanceStatus
  ): Promise<Result<MyAttendanceState>> {
    try {
      const today = getKampalaDateString();
      const client = getServiceRoleClient();

      if (targetStatus === 'break' || targetStatus === 'out') {
        const { data: profile } = await client.from('app_user').select('role').eq('id', userId).maybeSingle();
        if (profile?.role === 'staff') {
          const { count, error } = await client.from('visit_service')
            .select('id', { count: 'exact', head: true })
            .eq('staff_user_id', userId).eq('status', 'in_progress');
          if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
          if (count && count > 0) return fail({ code: 'CONFLICT', message: 'Finish your current service before taking a break or clocking out.' });
        }
      }

      // Get user organization and location
      const { data: userRecord } = await client
        .from('app_user')
        .select('organization_id, location_id')
        .eq('id', userId)
        .single();

      const orgId = userRecord?.organization_id || 'a0000000-0000-0000-0000-000000000001';
      const locId = userRecord?.location_id || 'b0000000-0000-0000-0000-000000000001';

      const { data: existing } = await client
        .from('attendance')
        .select('*')
        .eq('staff_user_id', userId)
        .eq('business_date', today)
        .maybeSingle();

      const now = new Date().toISOString();

      if (!existing) {
        if (targetStatus === 'in') {
          await client.from('attendance').insert({
            organization_id: orgId,
            location_id: locId,
            staff_user_id: userId,
            business_date: today,
            clock_in: now,
            on_break: false,
            absence_type: 'none',
          });
        }
      } else {
        if (targetStatus === 'in') {
          await client
            .from('attendance')
            .update({
              clock_in: existing.clock_in || now,
              on_break: false,
              break_started_at: null,
              clock_out: null,
              updated_at: now,
            })
            .eq('id', existing.id);
        } else if (targetStatus === 'break') {
          await client
            .from('attendance')
            .update({
              on_break: true,
              break_started_at: now,
              updated_at: now,
            })
            .eq('id', existing.id);
        } else if (targetStatus === 'out') {
          await client
            .from('attendance')
            .update({
              on_break: false,
              clock_out: now,
              updated_at: now,
            })
            .eq('id', existing.id);
        }
      }

      return this.getMyTodayAttendance(userId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update attendance';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }
}
