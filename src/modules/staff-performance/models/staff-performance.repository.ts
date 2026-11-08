import { getServiceRoleClient } from '@/shared/lib/supabase';
import { fail, ok, type Result } from '@/shared/models/result';

export type PerformanceRole = 'staff' | 'receptionist' | 'manager' | 'hr';

export interface StaffPerformanceFilter {
  fromDate: string;
  toDate: string;
  role?: PerformanceRole | 'all';
  staffId?: string;
}

export interface StaffPerformanceMetric {
  staff_id: string;
  name: string;
  role: PerformanceRole;
  is_service_staff: boolean;
  services_completed: number | null;
  customers_served: number | null;
  measured_minutes: number | null;
  avg_service_minutes: number | null;
  avg_expected_minutes: number | null;
  utilization_pct: number | null;
  on_time_rate_pct: number | null;
  days_present: number;
  hours_worked: number;
  unapproved_absences: number;
  target_current: number | null;
  target_goal: number | null;
  target_period: string | null;
  target_deadline: string | null;
  target_progress_pct: number | null;
  top_categories: Array<{ category: string; services: number }>;
}

export interface StaffPerformanceTeamSummary {
  services_completed: number;
  customers_served: number;
  avg_service_minutes: number | null;
  on_time_rate_pct: number | null;
  hours_worked: number;
}

export interface StaffPerformancePersonDetail {
  staff_id: string;
  services_by_day: Array<{ date: string; services: number }>;
  category_durations: Array<{
    category: string;
    services: number;
    avg_actual_minutes: number;
    avg_expected_minutes: number;
  }>;
  time_of_day: Array<{ hour: number; services: number }>;
  attendance: {
    days_present: number;
    hours_worked: number;
    on_time_rate_pct: number | null;
    unapproved_absences: number;
  };
  target: {
    current: number | null;
    goal: number | null;
    period: string | null;
    deadline: string | null;
    progress_pct: number | null;
  };
  team_average: {
    avg_service_minutes: number | null;
    utilization_pct: number | null;
    on_time_rate_pct: number | null;
    hours_worked: number;
  };
}

export interface StaffPerformanceReport {
  from_date: string;
  to_date: string;
  team: StaffPerformanceTeamSummary;
  people: StaffPerformanceMetric[];
  person_detail: StaffPerformancePersonDetail | null;
}

export class StaffPerformanceRepository {
  async getReport(actorId: string, filter: StaffPerformanceFilter): Promise<Result<StaffPerformanceReport>> {
    try {
      const { data, error } = await getServiceRoleClient().rpc('get_staff_performance_report', {
        p_actor_user_id: actorId,
        p_from_date: filter.fromDate,
        p_to_date: filter.toDate,
        p_role: filter.role && filter.role !== 'all' ? filter.role : null,
        p_staff_user_id: filter.staffId || null,
      });
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      if (!data || typeof data !== 'object') {
        return fail({ code: 'INTERNAL_ERROR', message: 'Performance report was not returned.' });
      }
      return ok(data as StaffPerformanceReport);
    } catch (cause: unknown) {
      return fail({
        code: 'INTERNAL_ERROR',
        message: cause instanceof Error ? cause.message : 'Could not load staff performance.',
      });
    }
  }
}
