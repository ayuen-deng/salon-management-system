import { getServiceRoleClient } from '@/shared/lib/supabase';
import { Result, ok, fail } from '@/shared/models/result';

export type UnifiedAttendanceStatus = 'present' | 'on_break' | 'out' | 'not_present' | 'on_leave';

export interface UnifiedStaffPresence {
  userId: string;
  displayName: string;
  fullName: string;
  role: string;
  status: UnifiedAttendanceStatus;
  statusLabel: string;
  clockInTime?: string;
  clockInTimeStr?: string;
  clockOutTime?: string;
  clockOutTimeStr?: string;
  breakStartedAt?: string;
  breakStartedAtStr?: string;
  scheduledStartTime?: string;
  leaveType?: string;
}

export interface UnifiedAttendanceSummary {
  businessDate: string;
  totalExpected: number;
  presentCount: number;
  onBreakCount: number;
  outCount: number;
  notPresentCount: number;
  onLeaveCount: number;
  staff: UnifiedStaffPresence[];
}

export function getKampalaDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
}

function formatKampalaTime(value?: string | null): string | undefined {
  if (!value) return undefined;
  return new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Kampala',
  });
}

export function getAttendanceStatusLabel(status: UnifiedAttendanceStatus, leaveType?: string): string {
  switch (status) {
    case 'present': return 'Present';
    case 'on_break': return 'On break';
    case 'out': return 'Out';
    case 'on_leave': return leaveType ? `On leave · ${leaveType.replace(/_/g, ' ')}` : 'On leave';
    default: return 'Not present';
  }
}

/** Every role's attendance snapshot reads this single, Kampala-day database view. */
export async function getUnifiedStaffAttendanceToday(
  _targetDate?: string,
): Promise<Result<UnifiedAttendanceSummary>> {
  try {
    const client = getServiceRoleClient();
    const { data, error } = await client
      .from('staff_presence_today')
      .select('user_id, display_name, full_name, role, business_date, status, clock_in, clock_out, break_started_at, leave_type, scheduled_start_time')
      .order('display_name', { ascending: true });

    if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

    const staff: UnifiedStaffPresence[] = (data || []).map((row: any) => {
      const status = row.status as UnifiedAttendanceStatus;
      const clockInTimeStr = formatKampalaTime(row.clock_in);
      const clockOutTimeStr = formatKampalaTime(row.clock_out);
      const breakStartedAtStr = formatKampalaTime(row.break_started_at);
      const leaveType = row.leave_type || undefined;
      return {
        userId: row.user_id,
        displayName: row.display_name,
        fullName: row.full_name,
        role: row.role,
        status,
        statusLabel: getAttendanceStatusLabel(status, leaveType),
        clockInTime: row.clock_in || undefined,
        clockInTimeStr,
        clockOutTime: row.clock_out || undefined,
        clockOutTimeStr,
        breakStartedAt: row.break_started_at || undefined,
        breakStartedAtStr,
        scheduledStartTime: row.scheduled_start_time?.slice(0, 5) || undefined,
        leaveType,
      };
    });

    const count = (status: UnifiedAttendanceStatus) => staff.filter((person) => person.status === status).length;
    return ok({
      businessDate: data?.[0]?.business_date || getKampalaDateString(),
      totalExpected: staff.length,
      presentCount: count('present') + count('on_break'),
      onBreakCount: count('on_break'),
      outCount: count('out'),
      notPresentCount: count('not_present'),
      onLeaveCount: count('on_leave'),
      staff,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error resolving attendance snapshot';
    return fail({ code: 'INTERNAL_ERROR', message });
  }
}
