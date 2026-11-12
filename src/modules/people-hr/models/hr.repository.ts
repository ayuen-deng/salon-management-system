import { getServiceRoleClient } from '@/shared/lib/supabase';
import { Result, ok, fail } from '@/shared/models/result';
import { AppRole } from '@/shared/models/roles';
import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { normalizeUgPhone, isValidUgPhone } from '@/shared/models/phone';
import { getUnifiedStaffAttendanceToday, type UnifiedStaffPresence } from '@/shared/lib/attendance-presence';

function getHrPolicyWriteError(message: string): string {
  if (/column "(?:organization_id|location_id)" of relation "audit_log" does not exist/i.test(message)) {
    return 'Database upgrade required. Apply migration 20261106000004_audit_log_scope_columns.sql, then try again.';
  }
  return message;
}

export interface HrOverviewStats {
  activeByRole: {
    staff: number;
    receptionist: number;
    manager: number;
    hr: number;
    owner: number;
  };
  totalActive: number;
  presentToday: number;
  onLeaveToday: number;
  lateToday: number;
  notInYet: number;
  pendingRevocationsCount: number;
  pendingLeaveCount: number;
  attendanceCorrectionsThisWeek: number;
  recentChanges: HrAuditChangeItem[];
  presence: UnifiedStaffPresence[];
}

export interface HrAuditChangeItem {
  id: string;
  at: string;
  actor_name: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  category: 'people' | 'access';
}

export interface HrStaffMember {
  id: string;
  full_name: string;
  display_name: string;
  role: AppRole;
  phone: string;
  username: string;
  status: 'active' | 'inactive';
  start_date: string;
  skills: string[];
  onboarding_checklist?: string[];
  offboarding_checklist?: string[];
}

export interface HrPendingRevocationItem {
  audit_id: string;
  at: string;
  revoked_user_id: string;
  revoked_user_name: string;
  revoked_by_name: string;
  revoked_by_role: string;
  reason: string;
  confirmed?: boolean;
}

export interface HrPairedDeviceItem {
  id: string;
  name: string;
  kind: string;
  created_at: string;
  revoked_at?: string | null;
  paired_by_name?: string;
}

export interface HrAttendanceRecord {
  id: string;
  staff_user_id: string;
  staff_name: string;
  role: AppRole;
  business_date: string;
  clock_in: string | null;
  clock_out: string | null;
  breaks: number; // count
  total_hours: number | null;
  standard_start?: string;
  standard_end?: string;
  arrival_offset_minutes?: number | null;
  departure_offset_minutes?: number | null;
  early_departure_minutes?: number;
  overtime_minutes?: number;
  break_minutes?: number;
  status?: string;
  is_rota_workday?: boolean;
  is_late: boolean;
  late_minutes: number;
  absence_type: 'none' | 'approved_leave' | 'unapproved_absence' | 'off_duty';
  corrected_by_name?: string;
  corrected_reason?: string;
  updated_at: string;
}

export interface HrLeaveBalance {
  staff_user_id: string; staff_name: string; role: AppRole; leave_year_start: string;
  entitlement_days: number | null; days_taken: number; days_approved_upcoming: number; days_pending: number; days_remaining: number | null;
}

export interface HrWorkHoursPolicy {
  standard_start: string; standard_end: string; late_grace_minutes: number; early_departure_grace_minutes: number;
  working_days: number[]; role_overrides: Record<string, Record<string, string | number>>;
}

export interface HrAnnualLeavePolicy {
  entitlement_by_role: Record<string, number | null>; leave_year_start_month: number; leave_year_start_day: number; public_holidays: string[];
}

export interface HrPunctualitySummary {
  staff_user_id: string;
  staff_name: string;
  role: AppRole;
  days_recorded: number;
  late_count: number;
  total_late_minutes: number;
  average_arrival: string; // e.g. "08:14 AM"
  absences_count: number;
}

export interface HrLeaveRecord {
  id: string;
  staff_user_id: string;
  staff_name: string;
  role: AppRole;
  from_date: string;
  to_date: string;
  leave_type: 'annual_leave' | 'unpaid_leave' | 'other_approved_leave';
  status: 'requested' | 'approved' | 'rejected' | 'cancelled';
  requested_by_name: string;
  decided_by_name?: string;
  decided_at?: string;
  created_at: string;
}

export interface HrRotaCell {
  weekday: number; // 0=Sun, 1=Mon... 6=Sat
  is_off: boolean;
  start_time: string; // "08:00"
  end_time: string; // "17:00"
}

export interface HrWeeklyRota {
  staff_user_id: string;
  staff_name: string;
  role: AppRole;
  effective_from: string;
  days: Record<number, HrRotaCell>;
}

export interface HrAuditEntry {
  id: string;
  at: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  category: 'people' | 'access';
  target_name?: string;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export class HrRepository {
  private locId = 'b0000000-0000-0000-0000-000000000001';
  private orgId = 'a0000000-0000-0000-0000-000000000001';

  // ==========================================
  // BADGES & OVERVIEW
  // ==========================================
  async getHrBadges(): Promise<Result<{ pendingRevocations: number; pendingLeave: number }>> {
    try {
      const client = getServiceRoleClient();
      // Fetch the independent badge sources together instead of serializing
      // the leave count behind the first access-audit query.
      const [revocationResult, leaveResult] = await Promise.all([
        client.from('audit_log')
          .select('entity_id')
          .eq('category', 'access')
          .eq('action', 'MANAGER_REVOKE_STAFF'),
        client.from('leave_request')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'requested'),
      ]);
      if (revocationResult.error) return fail({ code: 'INTERNAL_ERROR', message: revocationResult.error.message });
      if (leaveResult.error) return fail({ code: 'INTERNAL_ERROR', message: leaveResult.error.message });

      // Check every affected staff entity in one batched audit read. The
      // badge counts unresolved entities, not duplicate append-only events.
      const entityIds = [...new Set((revocationResult.data || []).map((row) => row.entity_id).filter(Boolean))];
      const resolutionResult = entityIds.length
        ? await client.from('audit_log')
            .select('entity_id')
            .in('action', ['HR_CONFIRM_REVOCATION', 'HR_REVERSE_REVOCATION'])
            .in('entity_id', entityIds)
        : { data: [], error: null };
      if (resolutionResult.error) return fail({ code: 'INTERNAL_ERROR', message: resolutionResult.error.message });
      const resolvedEntities = new Set((resolutionResult.data || []).map((row) => row.entity_id));
      const pendingRevocations = entityIds.filter((entityId) => !resolvedEntities.has(entityId)).length;

      return ok({
        pendingRevocations,
        pendingLeave: leaveResult.count || 0,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching HR badges';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getOverviewStats(): Promise<Result<HrOverviewStats>> {
    try {
      const client = getServiceRoleClient();
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });

      // 1. Active people by role
      const { data: users, error: uErr } = await client
        .from('app_user')
        .select('id, role, status')
        .eq('location_id', this.locId);

      if (uErr) return fail({ code: 'INTERNAL_ERROR', message: uErr.message });

      const activeByRole = {
        staff: 0,
        receptionist: 0,
        manager: 0,
        hr: 0,
        owner: 0,
      };

      let totalActive = 0;

      (users || []).forEach((u) => {
        if (u.status === 'active') {
          totalActive++;
          if (u.role in activeByRole) {
            activeByRole[u.role as keyof typeof activeByRole]++;
          }
        }
      });

      // All roles use the same database-backed Kampala-day presence snapshot.
      const snapshot = await getUnifiedStaffAttendanceToday();
      if (!snapshot.success) return fail(snapshot.error);
      const presence = snapshot.data.staff;
      const presentToday = snapshot.data.presentCount;
      const onLeaveToday = snapshot.data.onLeaveCount;
      const notInYet = snapshot.data.notPresentCount;
      const lateToday = presence.filter((person) => {
        if (!person.clockInTime || !person.scheduledStartTime) return false;
        const actual = new Date(person.clockInTime).toLocaleTimeString('en-GB', {
          hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Kampala',
        });
        const [ah, am] = actual.split(':').map(Number);
        const [sh, sm] = person.scheduledStartTime.split(':').map(Number);
        return ah * 60 + am > sh * 60 + sm + 15;
      }).length;

      // 5. Badges
      const badgesRes = await this.getHrBadges();
      const badges = badgesRes.success ? badgesRes.data : { pendingRevocations: 0, pendingLeave: 0 };

      // 6. Attendance corrections this week (past 7 days)
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { count: corrCount } = await client
        .from('audit_log')
        .select('*', { count: 'exact', head: true })
        .eq('category', 'people')
        .eq('action', 'ATTENDANCE_CORRECTED')
        .gte('at', weekAgo);

      // 7. Recent changes in people and access
      const { data: recentLogs } = await client
        .from('hr_people_access_audit')
        .select('id, at, actor_role, action, entity_type, entity_id, reason, before, after, category, actor_id')
        .in('category', ['people', 'access'])
        .order('at', { ascending: false })
        .limit(10);

      const actorIds = Array.from(new Set((recentLogs || []).map((l) => l.actor_id).filter(Boolean)));
      const { data: actors } = await client
        .from('app_user')
        .select('id, display_name')
        .in('id', actorIds);
      const actorMap = new Map((actors || []).map((a) => [a.id, a.display_name]));

      const recentChanges: HrAuditChangeItem[] = (recentLogs || []).map((l) => ({
        id: l.id.toString(),
        at: l.at,
        actor_name: actorMap.get(l.actor_id) || l.actor_role,
        actor_role: l.actor_role,
        action: l.action,
        entity_type: l.entity_type,
        entity_id: l.entity_id,
        reason: l.reason || undefined,
        before: (l.before as Record<string, unknown>) || undefined,
        after: (l.after as Record<string, unknown>) || undefined,
        category: l.category as 'people' | 'access',
      }));

      return ok({
        activeByRole,
        totalActive,
        presentToday,
        onLeaveToday,
        lateToday,
        notInYet,
        presence,
        pendingRevocationsCount: badges.pendingRevocations,
        pendingLeaveCount: badges.pendingLeave,
        attendanceCorrectionsThisWeek: corrCount || 0,
        recentChanges,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error calculating HR overview stats';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // ==========================================
  // STAFF DIRECTORY & CHECKLISTS
  // ==========================================
  async getStaffDirectory(): Promise<Result<HrStaffMember[]>> {
    try {
      const client = getServiceRoleClient();

      const { data: users, error: uErr } = await client
        .from('app_user')
        .select('id, full_name, display_name, role, phone, status, start_date')
        .eq('location_id', this.locId)
        .order('role', { ascending: true })
        .order('full_name', { ascending: true });

      if (uErr) return fail({ code: 'INTERNAL_ERROR', message: uErr.message });

      // Fetch auth emails to extract clean username
      const { data: authData } = await client.auth.admin.listUsers();
      const authEmailMap = new Map((authData?.users || []).map((u) => [u.id, u.email || '']));

      // Fetch skills
      const { data: skills } = await client
        .from('staff_skill')
        .select('staff_user_id, service(name)');

      const skillsMap = new Map<string, string[]>();
      (skills || []).forEach((s: any) => {
        if (!skillsMap.has(s.staff_user_id)) skillsMap.set(s.staff_user_id, []);
        if (s.service?.name) skillsMap.get(s.staff_user_id)!.push(s.service.name);
      });

      // Fetch checklist settings
      const { data: checklistSetting } = await client
        .from('app_setting')
        .select('value')
        .eq('location_id', this.locId)
        .eq('key', 'hr_user_checklists')
        .maybeSingle();

      const userChecklists = (checklistSetting?.value as Record<string, { onboarding?: string[]; offboarding?: string[] }>) || {};

      const result: HrStaffMember[] = (users || []).map((u) => {
        const email = authEmailMap.get(u.id) || '';
        const username = email.includes('@') ? email.split('@')[0] : u.display_name.toLowerCase();
        const userChecks = userChecklists[u.id] || {};

        return {
          id: u.id,
          full_name: u.full_name,
          display_name: u.display_name,
          role: u.role as AppRole,
          phone: u.phone,
          username,
          status: u.status as 'active' | 'inactive',
          start_date: u.start_date,
          skills: skillsMap.get(u.id) || [],
          onboarding_checklist: userChecks.onboarding || [],
          offboarding_checklist: userChecks.offboarding || [],
        };
      });

      return ok(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching staff directory';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async createAccount(payload: {
    fullName: string;
    role: 'staff' | 'receptionist' | 'manager';
    phone: string;
    username: string;
    startDate: string;
    hrActorId: string;
    pin?: string;
  }): Promise<Result<{ id: string; pin: string; username: string }>> {
    try {
      const username = payload.username.trim().toLowerCase();
      const phone = normalizeUgPhone(payload.phone);
      if (!/^[a-z0-9._]{3,20}$/.test(username)) {
        return fail({ code: 'VALIDATION_ERROR', message: 'Username must be 3–20 lowercase letters, digits, dots, or underscores.' });
      }
      if (!phone || !isValidUgPhone(phone)) {
        return fail({ code: 'VALIDATION_ERROR', message: 'Enter a valid Uganda mobile number.' });
      }
      const serverClient = await createServerSupabaseClient();
      const { data, error } = await serverClient.functions.invoke('provision-staff-account', {
        body: { ...payload, username, phone, pin: payload.pin || undefined },
      });
      if (error || data?.error) {
        const message = data?.error || error?.message || 'Account creation failed.';
        const code = /already in use|already assigned/i.test(message) ? 'CONFLICT' : /not authorized|only hr/i.test(message) ? 'FORBIDDEN' : 'VALIDATION_ERROR';
        return fail({ code, message });
      }
      return ok({ id: data.id, pin: data.pin, username: data.username });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error creating account';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async editStaffProfile(payload: {
    userId: string;
    fullName: string;
    phone: string;
    startDate: string;
    hrActorId: string;
  }): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();

      const { data: user } = await client.from('app_user').select('*').eq('id', payload.userId).single();
      if (!user) return fail({ code: 'NOT_FOUND', message: 'User not found.' });

      // Guard: HR cannot touch owner
      if (user.role === 'owner') {
        return fail({ code: 'FORBIDDEN', message: 'HR cannot modify the Salon Owner profile.' });
      }

      await client
        .from('app_user')
        .update({
          full_name: payload.fullName,
          phone: payload.phone,
          start_date: payload.startDate,
        })
        .eq('id', payload.userId);

      await client.from('audit_log').insert({
        organization_id: this.orgId,
        location_id: this.locId,
        actor_id: payload.hrActorId,
        actor_role: 'hr',
        action: 'EDIT_STAFF_PROFILE',
        entity_type: 'app_user',
        entity_id: payload.userId,
        category: 'people',
        reason: 'HR updated profile fields',
        before: { full_name: user.full_name, phone: user.phone, start_date: user.start_date },
        after: { full_name: payload.fullName, phone: payload.phone, start_date: payload.startDate },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error updating profile';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async changeRole(payload: {
    userId: string;
    newRole: 'staff' | 'receptionist' | 'manager';
    reason: string;
    hrActorId: string;
  }): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();

      if (!payload.reason || !payload.reason.trim()) {
        return fail({ code: 'VALIDATION_ERROR', message: 'A reason code/explanation is required for role changes.' });
      }

      const { data: user } = await client.from('app_user').select('*').eq('id', payload.userId).single();
      if (!user) return fail({ code: 'NOT_FOUND', message: 'User not found.' });

      // Self-protection: HR cannot change their own role or touch owner
      if (user.id === payload.hrActorId) {
        return fail({ code: 'FORBIDDEN', message: 'HR cannot change their own role.' });
      }
      if (user.role === 'owner') {
        return fail({ code: 'FORBIDDEN', message: 'HR cannot change the Owner role.' });
      }
      if ((payload.newRole as string) === 'hr' || (payload.newRole as string) === 'owner') {
        return fail({ code: 'FORBIDDEN', message: 'HR cannot promote anyone to HR or Owner.' });
      }

      await client.from('app_user').update({ role: payload.newRole }).eq('id', payload.userId);

      // Update auth user metadata
      await client.auth.admin.updateUserById(payload.userId, {
        user_metadata: { role: payload.newRole, full_name: user.full_name },
      });

      await client.from('audit_log').insert({
        organization_id: this.orgId,
        location_id: this.locId,
        actor_id: payload.hrActorId,
        actor_role: 'hr',
        action: 'CHANGE_USER_ROLE',
        entity_type: 'app_user',
        entity_id: payload.userId,
        category: 'people',
        reason: payload.reason,
        before: { role: user.role },
        after: { role: payload.newRole },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error changing role';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async toggleAccountStatus(payload: {
    userId: string;
    status: 'active' | 'inactive';
    reason: string;
    hrActorId: string;
  }): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();

      if (payload.status === 'inactive' && (!payload.reason || !payload.reason.trim())) {
        return fail({ code: 'VALIDATION_ERROR', message: 'A reason is required when deactivating an account.' });
      }

      const { data: user } = await client.from('app_user').select('*').eq('id', payload.userId).single();
      if (!user) return fail({ code: 'NOT_FOUND', message: 'User not found.' });

      // Self-protection
      if (user.id === payload.hrActorId) {
        return fail({ code: 'FORBIDDEN', message: 'HR cannot deactivate their own account.' });
      }
      if (user.role === 'owner') {
        return fail({ code: 'FORBIDDEN', message: 'HR cannot deactivate the Salon Owner.' });
      }

      await client.from('app_user').update({ status: payload.status }).eq('id', payload.userId);

      // If deactivating, end all sessions immediately by updating auth password / signing out
      if (payload.status === 'inactive') {
        // Change auth password / invalidate sessions
        const randomTemp = Math.random().toString(36) + Math.random().toString(36);
        await client.auth.admin.updateUserById(payload.userId, {
          password: randomTemp,
          ban_duration: '87600h', // 10 years ban
        });
      } else {
        // Reactivating: unban
        await client.auth.admin.updateUserById(payload.userId, {
          ban_duration: 'none',
        });
      }

      await client.from('audit_log').insert({
        organization_id: this.orgId,
        location_id: this.locId,
        actor_id: payload.hrActorId,
        actor_role: 'hr',
        action: payload.status === 'inactive' ? 'DEACTIVATE_USER' : 'REACTIVATE_USER',
        entity_type: 'app_user',
        entity_id: payload.userId,
        category: 'access',
        reason: payload.reason || (payload.status === 'active' ? 'Reactivated by HR' : 'Deactivated by HR'),
        before: { status: user.status },
        after: { status: payload.status },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error updating account status';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async saveChecklist(userId: string, type: 'onboarding' | 'offboarding', items: string[]): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();

      const { data: setting } = await client
        .from('app_setting')
        .select('value')
        .eq('location_id', this.locId)
        .eq('key', 'hr_user_checklists')
        .maybeSingle();

      const current = (setting?.value as Record<string, { onboarding?: string[]; offboarding?: string[] }>) || {};
      if (!current[userId]) current[userId] = {};
      current[userId][type] = items;

      await client.from('app_setting').upsert({
        location_id: this.locId,
        key: 'hr_user_checklists',
        value: current,
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error saving checklist';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // ==========================================
  // ACCESS: PIN RESETS, IMMEDIATE REVOCATION, DEVICES
  // ==========================================
  async resetPin(payload: {
    userId: string;
    hrActorId: string;
  }): Promise<Result<{ newPin: string; userName: string }>> {
    try {
      const serverClient = await createServerSupabaseClient();
      const { data, error } = await serverClient.functions.invoke('reset-staff-pin', { body: { userId: payload.userId } });
      if (error || data?.error) {
        const message = data?.error || error?.message || 'PIN reset failed.';
        return fail({ code: /not authorized|cannot reset/i.test(message) ? 'FORBIDDEN' : 'INTERNAL_ERROR', message });
      }
      return ok({ newPin: data.newPin, userName: data.userName });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error resetting PIN';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async revokeAccessImmediately(payload: {
    userId: string;
    reason: string;
    hrActorId: string;
  }): Promise<Result<{ success: boolean }>> {
    return this.toggleAccountStatus({
      userId: payload.userId,
      status: 'inactive',
      reason: payload.reason,
      hrActorId: payload.hrActorId,
    });
  }

  async getPendingManagerRevocations(): Promise<Result<HrPendingRevocationItem[]>> {
    try {
      const client = getServiceRoleClient();

      // Find all MANAGER_REVOKE_STAFF entries
      const { data: revAudit } = await client
        .from('audit_log')
        .select('id, at, actor_id, actor_role, entity_id, reason, after')
        .eq('category', 'access')
        .eq('action', 'MANAGER_REVOKE_STAFF')
        .order('at', { ascending: false });

      const items: HrPendingRevocationItem[] = [];

      for (const rev of revAudit || []) {
        // Check if HR has confirmed or reversed this
        const { data: hrAction } = await client
          .from('audit_log')
          .select('id, action')
          .in('action', ['HR_CONFIRM_REVOCATION', 'HR_REVERSE_REVOCATION'])
          .eq('entity_id', rev.entity_id)
          .maybeSingle();

        if (!hrAction) {
          // Look up user names
          const { data: u } = await client.from('app_user').select('full_name').eq('id', rev.entity_id).maybeSingle();
          const { data: mgr } = await client.from('app_user').select('display_name').eq('id', rev.actor_id).maybeSingle();

          items.push({
            audit_id: rev.id.toString(),
            at: rev.at,
            revoked_user_id: rev.entity_id,
            revoked_user_name: u?.full_name || 'Staff Member',
            revoked_by_name: mgr?.display_name || 'Manager',
            revoked_by_role: rev.actor_role,
            reason: rev.reason || 'Manager emergency revocation',
          });
        }
      }

      return ok(items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching manager revocations';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async decideManagerRevocation(payload: {
    userId: string;
    decision: 'confirm' | 'reverse';
    reason: string;
    hrActorId: string;
  }): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();

      if (!payload.reason || !payload.reason.trim()) {
        return fail({ code: 'VALIDATION_ERROR', message: 'A reason code is mandatory when deciding on a manager revocation.' });
      }

      const { data: user } = await client.from('app_user').select('*').eq('id', payload.userId).single();
      if (!user) return fail({ code: 'NOT_FOUND', message: 'User record not found.' });

      if (payload.decision === 'confirm') {
        // Keep inactive, mark confirmed
        await client.from('audit_log').insert({
          organization_id: this.orgId,
          location_id: this.locId,
          actor_id: payload.hrActorId,
          actor_role: 'hr',
          action: 'HR_CONFIRM_REVOCATION',
          entity_type: 'app_user',
          entity_id: payload.userId,
          category: 'access',
          reason: payload.reason,
          after: { decision: 'confirmed_inactive' },
        });
      } else {
        // Reverse revocation: restore user active status & unban auth
        await client.from('app_user').update({ status: 'active' }).eq('id', payload.userId);
        await client.auth.admin.updateUserById(payload.userId, {
          ban_duration: 'none',
        });

        await client.from('audit_log').insert({
          organization_id: this.orgId,
          location_id: this.locId,
          actor_id: payload.hrActorId,
          actor_role: 'hr',
          action: 'HR_REVERSE_REVOCATION',
          entity_type: 'app_user',
          entity_id: payload.userId,
          category: 'access',
          reason: payload.reason,
          after: { decision: 'reversed_to_active' },
        });
      }

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error deciding manager revocation';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getPairedDevices(): Promise<Result<HrPairedDeviceItem[]>> {
    try {
      const client = getServiceRoleClient();

      const { data: devices, error: dErr } = await client
        .from('device')
        .select('id, name, kind, created_at, revoked_at, paired_by')
        .eq('location_id', this.locId)
        .order('created_at', { ascending: false });

      if (dErr) return fail({ code: 'INTERNAL_ERROR', message: dErr.message });

      const pairedByIds = Array.from(new Set((devices || []).map((d) => d.paired_by).filter(Boolean)));
      const { data: pairs } = await client.from('app_user').select('id, display_name').in('id', pairedByIds);
      const pairMap = new Map((pairs || []).map((p) => [p.id, p.display_name]));

      const items: HrPairedDeviceItem[] = (devices || []).map((d) => ({
        id: d.id,
        name: d.name,
        kind: d.kind,
        created_at: d.created_at,
        revoked_at: d.revoked_at,
        paired_by_name: d.paired_by ? pairMap.get(d.paired_by) : undefined,
      }));

      return ok(items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching paired devices';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async revokeDevice(payload: {
    deviceId: string;
    reason: string;
    hrActorId: string;
  }): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();

      const { data: device } = await client.from('device').select('*').eq('id', payload.deviceId).single();
      if (!device) return fail({ code: 'NOT_FOUND', message: 'Device not found.' });

      const now = new Date().toISOString();
      await client.from('device').update({ revoked_at: now }).eq('id', payload.deviceId);

      await client.from('audit_log').insert({
        organization_id: this.orgId,
        location_id: this.locId,
        actor_id: payload.hrActorId,
        actor_role: 'hr',
        action: 'REVOKE_DEVICE',
        entity_type: 'device',
        entity_id: payload.deviceId,
        category: 'access',
        reason: payload.reason || 'HR revoked device access for lost/stolen hardware',
        before: { revoked_at: device.revoked_at },
        after: { revoked_at: now },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error revoking device';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }
  async getAttendancePolicy(): Promise<Result<HrWorkHoursPolicy>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client.from('work_hours_policy').select('standard_start,standard_end,late_grace_minutes,early_departure_grace_minutes,working_days,role_overrides').eq('location_id', this.locId).order('effective_from', { ascending: false }).limit(1).single();
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      return ok({ ...data, standard_start: data.standard_start.slice(0,5), standard_end: data.standard_end.slice(0,5), working_days: data.working_days || [], role_overrides: data.role_overrides || {} });
    } catch (err: unknown) { return fail({ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Could not load working hours policy.' }); }
  }

  async getAnnualLeavePolicy(): Promise<Result<HrAnnualLeavePolicy>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client.from('annual_leave_policy').select('entitlement_by_role,leave_year_start_month,leave_year_start_day,public_holidays').eq('location_id', this.locId).order('effective_from', { ascending: false }).limit(1).single();
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      return ok({ entitlement_by_role: data.entitlement_by_role || {}, leave_year_start_month: data.leave_year_start_month, leave_year_start_day: data.leave_year_start_day, public_holidays: data.public_holidays || [] });
    } catch (err: unknown) { return fail({ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Could not load leave policy.' }); }
  }

  async getLeaveBalances(): Promise<Result<HrLeaveBalance[]>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client.from('hr_leave_balance').select('*').eq('location_id', this.locId).order('staff_name');
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      return ok((data || []).map((row) => ({ ...row, entitlement_days: row.entitlement_days === null ? null : Number(row.entitlement_days), days_taken: Number(row.days_taken), days_approved_upcoming: Number(row.days_approved_upcoming), days_pending: Number(row.days_pending), days_remaining: row.days_remaining === null ? null : Number(row.days_remaining) })) as HrLeaveBalance[]);
    } catch (err: unknown) { return fail({ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Could not load leave balances.' }); }
  }

  async getAttendanceDailyRecords(filters?: { startDate?: string; endDate?: string; staffUserId?: string; role?: string }): Promise<Result<{ records: HrAttendanceRecord[]; punctuality: HrPunctualitySummary[] }>> {
    try {
      const client = getServiceRoleClient();
      let query = client.from('hr_attendance_daily').select('*').eq('location_id', this.locId).order('business_date', { ascending: false });
      if (filters?.startDate) query = query.gte('business_date', filters.startDate);
      if (filters?.endDate) query = query.lte('business_date', filters.endDate);
      if (filters?.staffUserId && filters.staffUserId !== 'all') query = query.eq('staff_user_id', filters.staffUserId);
      if (filters?.role && filters.role !== 'all') query = query.eq('role', filters.role);
      const { data, error } = await query;
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      const actorIds = Array.from(new Set((data || []).map((row) => row.corrected_by).filter(Boolean)));
      const { data: actors } = actorIds.length ? await client.from('app_user').select('id,display_name').in('id', actorIds) : { data: [] as { id: string; display_name: string }[] };
      const actorMap = new Map((actors || []).map((actor) => [actor.id, actor.display_name]));
      const records: HrAttendanceRecord[] = (data || []).map((row) => ({
        id: row.attendance_id || '', staff_user_id: row.staff_user_id, staff_name: row.staff_name, role: row.role,
        business_date: row.business_date, clock_in: row.clock_in, clock_out: row.clock_out, breaks: row.break_minutes > 0 ? 1 : 0,
        total_hours: row.hours_worked === null ? null : Math.round(Number(row.hours_worked) * 100) / 100,
        is_late: Number(row.late_minutes || 0) > 0, late_minutes: Number(row.late_minutes || 0), absence_type: row.absence_type || 'none',
        corrected_by_name: actorMap.get(row.corrected_by) || undefined, corrected_reason: row.corrected_reason || undefined,
        updated_at: row.updated_at || '', standard_start: String(row.standard_start).slice(0,5), standard_end: String(row.standard_end).slice(0,5),
        arrival_offset_minutes: row.arrival_offset_minutes === null ? null : Number(row.arrival_offset_minutes),
        departure_offset_minutes: row.departure_offset_minutes === null ? null : Number(row.departure_offset_minutes),
        early_departure_minutes: Number(row.early_departure_minutes || 0), overtime_minutes: Number(row.overtime_minutes || 0),
        break_minutes: Number(row.break_minutes || 0), status: row.status, is_rota_workday: row.is_rota_workday,
      }));
      const byStaff = new Map<string, HrAttendanceRecord[]>();
      records.forEach((record) => byStaff.set(record.staff_user_id, [...(byStaff.get(record.staff_user_id) || []), record]));
      const punctuality = Array.from(byStaff, ([staffId, rows]) => {
        const arrivals = rows.filter((row) => row.clock_in).map((row) => { const d = new Date(row.clock_in!); return (d.getUTCHours() * 60 + d.getUTCMinutes() + 180) % 1440; });
        const avg = arrivals.length ? Math.round(arrivals.reduce((sum, value) => sum + value, 0) / arrivals.length) : null;
        return { staff_user_id: staffId, staff_name: rows[0].staff_name, role: rows[0].role,
          days_recorded: rows.filter((row) => row.is_rota_workday).length, late_count: rows.filter((row) => row.is_late).length,
          total_late_minutes: rows.reduce((sum, row) => sum + row.late_minutes, 0),
          average_arrival: avg === null ? '—' : `${String(Math.floor((avg % 1440) / 60) % 12 || 12).padStart(2,'0')}:${String(avg % 60).padStart(2,'0')} ${Math.floor((avg % 1440) / 60) >= 12 ? 'PM' : 'AM'}`,
          absences_count: rows.filter((row) => row.absence_type === 'unapproved_absence' || row.status === 'not_present').length };
      });
      return ok({ records, punctuality });
    } catch (err: unknown) { return fail({ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Could not load attendance daily records.' }); }
  }

  async saveWorkHoursPolicy(actorId: string, policy: HrWorkHoursPolicy): Promise<Result<{ success: boolean }>> {
    try { const { error } = await getServiceRoleClient().rpc('save_work_hours_policy', { p_actor_user_id: actorId, p_standard_start: policy.standard_start, p_standard_end: policy.standard_end, p_late_grace_minutes: policy.late_grace_minutes, p_early_departure_grace_minutes: policy.early_departure_grace_minutes, p_working_days: policy.working_days, p_role_overrides: policy.role_overrides });
      return error ? fail({ code: 'INTERNAL_ERROR', message: getHrPolicyWriteError(error.message) }) : ok({ success: true });
    } catch (err: unknown) { return fail({ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Could not save work hours.' }); }
  }

  async saveAnnualLeavePolicy(actorId: string, policy: HrAnnualLeavePolicy): Promise<Result<{ success: boolean }>> {
    try { const { error } = await getServiceRoleClient().rpc('save_annual_leave_policy', { p_actor_user_id: actorId, p_entitlement_by_role: policy.entitlement_by_role, p_leave_year_start_month: policy.leave_year_start_month, p_leave_year_start_day: policy.leave_year_start_day, p_public_holidays: policy.public_holidays });
      return error ? fail({ code: 'INTERNAL_ERROR', message: getHrPolicyWriteError(error.message) }) : ok({ success: true });
    } catch (err: unknown) { return fail({ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Could not save annual leave policy.' }); }
  }

  async savePersonLeaveEntitlement(actorId: string, staffUserId: string, days: number | null): Promise<Result<{ success: boolean }>> {
    try { const { error } = await getServiceRoleClient().rpc('save_person_leave_entitlement', { p_actor_user_id: actorId, p_staff_user_id: staffUserId, p_entitlement_days: days });
      return error ? fail({ code: 'INTERNAL_ERROR', message: getHrPolicyWriteError(error.message) }) : ok({ success: true });
    } catch (err: unknown) { return fail({ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Could not save staff entitlement.' }); }
  }

  async getAttendanceRecords(filters?: {
    startDate?: string;
    endDate?: string;
    staffUserId?: string;
    role?: string;
  }): Promise<Result<{ records: HrAttendanceRecord[]; punctuality: HrPunctualitySummary[] }>> {
    try {
      const client = getServiceRoleClient();

      // Fetch users
      const { data: users } = await client
        .from('app_user')
        .select('id, full_name, display_name, role')
        .eq('location_id', this.locId);

      const userMap = new Map((users || []).map((u) => [u.id, u]));

      // Fetch rotas
      const { data: rotas } = await client.from('rota_entry').select('*');
      const rotaMap = new Map<string, { start_time: string; end_time: string }>();
      (rotas || []).forEach((r) => {
        rotaMap.set(`${r.staff_user_id}_${r.weekday}`, {
          start_time: r.start_time,
          end_time: r.end_time,
        });
      });

      // Query attendance
      let query = client
        .from('attendance')
        .select('*, corrected_by_user:corrected_by(display_name)')
        .eq('location_id', this.locId)
        .order('business_date', { ascending: false });

      if (filters?.startDate) query = query.gte('business_date', filters.startDate);
      if (filters?.endDate) query = query.lte('business_date', filters.endDate);
      if (filters?.staffUserId && filters.staffUserId !== 'all') query = query.eq('staff_user_id', filters.staffUserId);

      const { data: attendances, error: aErr } = await query;
      if (aErr) return fail({ code: 'INTERNAL_ERROR', message: aErr.message });

      // Transform records
      const records: HrAttendanceRecord[] = [];
      const userPunctualityMap = new Map<
        string,
        {
          days: number;
          late_count: number;
          late_minutes: number;
          arrivalMinutes: number[];
          absences: number;
        }
      >();

      (attendances || []).forEach((a: any) => {
        const u = userMap.get(a.staff_user_id);
        if (!u) return;
        if (filters?.role && filters.role !== 'all' && u.role !== filters.role) return;

        // Calculate hours
        let totalHours = 0;
        if (a.clock_in && a.clock_out) {
          const diffMs = new Date(a.clock_out).getTime() - new Date(a.clock_in).getTime();
          if (diffMs > 0) totalHours = Math.round((diffMs / 3600000) * 10) / 10;
        } else if (a.clock_in) {
          totalHours = 8;
        }

        // Lateness against rota
        const dow = new Date(a.business_date).getDay();
        const sched = rotaMap.get(`${a.staff_user_id}_${dow}`);
        let isLate = false;
        let lateMins = 0;

        if (a.clock_in && sched) {
          const [sH, sM] = sched.start_time.split(':').map(Number);
          const inDate = new Date(a.clock_in);
          const actualMins = inDate.getUTCHours() * 60 + inDate.getUTCMinutes();
          const schedMins = sH * 60 + sM;
          if (actualMins > schedMins + 15) {
            isLate = true;
            lateMins = actualMins - schedMins;
          }
        }

        // Aggregate punctuality
        if (!userPunctualityMap.has(a.staff_user_id)) {
          userPunctualityMap.set(a.staff_user_id, {
            days: 0,
            late_count: 0,
            late_minutes: 0,
            arrivalMinutes: [],
            absences: 0,
          });
        }
        const p = userPunctualityMap.get(a.staff_user_id)!;
        p.days++;
        if (isLate) {
          p.late_count++;
          p.late_minutes += lateMins;
        }
        if (a.clock_in) {
          const inDate = new Date(a.clock_in);
          p.arrivalMinutes.push(inDate.getUTCHours() * 60 + inDate.getUTCMinutes());
        }
        if (a.absence_type === 'unapproved_absence') {
          p.absences++;
        }

        records.push({
          id: a.id,
          staff_user_id: a.staff_user_id,
          staff_name: u.full_name,
          role: u.role,
          business_date: a.business_date,
          clock_in: a.clock_in,
          clock_out: a.clock_out,
          breaks: a.on_break ? 1 : 0,
          total_hours: totalHours,
          is_late: isLate,
          late_minutes: lateMins,
          absence_type: a.absence_type || 'none',
          corrected_by_name: a.corrected_by_user?.display_name || undefined,
          corrected_reason: a.corrected_reason || undefined,
          updated_at: a.updated_at,
        });
      });

      // Compile punctuality list
      const punctuality: HrPunctualitySummary[] = [];
      userMap.forEach((u, uid) => {
        if (filters?.role && filters.role !== 'all' && u.role !== filters.role) return;
        const p = userPunctualityMap.get(uid) || {
          days: 0,
          late_count: 0,
          late_minutes: 0,
          arrivalMinutes: [],
          absences: 0,
        };

        let avgArrival = '—';
        if (p.arrivalMinutes.length > 0) {
          const avg = Math.round(p.arrivalMinutes.reduce((a, b) => a + b, 0) / p.arrivalMinutes.length);
          const h = Math.floor(avg / 60);
          const m = avg % 60;
          const ampm = h >= 12 ? 'PM' : 'AM';
          const dispH = h % 12 || 12;
          avgArrival = `${String(dispH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
        }

        punctuality.push({
          staff_user_id: uid,
          staff_name: u.full_name,
          role: u.role,
          days_recorded: p.days,
          late_count: p.late_count,
          total_late_minutes: p.late_minutes,
          average_arrival: avgArrival,
          absences_count: p.absences,
        });
      });

      return ok({ records, punctuality });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching attendance';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async correctAttendance(payload: {
    attendanceId?: string;
    staffUserId: string;
    businessDate: string;
    clockIn?: string | null;
    clockOut?: string | null;
    absenceType: 'none' | 'approved_leave' | 'unapproved_absence' | 'off_duty';
    reason: string;
    hrActorId: string;
  }): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();

      if (!payload.reason || !payload.reason.trim()) {
        return fail({ code: 'VALIDATION_ERROR', message: 'A reason code is mandatory for attendance corrections.' });
      }

      // Self-protection: HR cannot correct HR's own attendance
      if (payload.staffUserId === payload.hrActorId) {
        return fail({
          code: 'FORBIDDEN',
          message: "HR cannot correct HR's own attendance. Those corrections must be performed by the Manager.",
        });
      }

      let beforeData: any = {};
      let targetId = payload.attendanceId;

      if (targetId) {
        const { data: existing } = await client.from('attendance').select('*').eq('id', targetId).single();
        if (existing) beforeData = existing;
      } else {
        const { data: existing } = await client
          .from('attendance')
          .select('*')
          .eq('staff_user_id', payload.staffUserId)
          .eq('business_date', payload.businessDate)
          .maybeSingle();

        if (existing) {
          targetId = existing.id;
          beforeData = existing;
        }
      }

      const afterData = {
        clock_in: payload.clockIn !== undefined ? payload.clockIn : beforeData.clock_in,
        clock_out: payload.clockOut !== undefined ? payload.clockOut : beforeData.clock_out,
        absence_type: payload.absenceType,
        corrected_by: payload.hrActorId,
        corrected_reason: payload.reason,
        updated_at: new Date().toISOString(),
      };

      if (targetId) {
        await client.from('attendance').update(afterData).eq('id', targetId);
      } else {
        const { data: inserted } = await client
          .from('attendance')
          .insert({
            organization_id: this.orgId,
            location_id: this.locId,
            staff_user_id: payload.staffUserId,
            business_date: payload.businessDate,
            ...afterData,
          })
          .select('id')
          .single();
        targetId = inserted?.id;
      }

      // Write to audit_log with tag 'HR' in reason and category 'people'
      // This will appear in the Owner's "For your review" feed
      await client.from('audit_log').insert({
        organization_id: this.orgId,
        location_id: this.locId,
        actor_id: payload.hrActorId,
        actor_role: 'hr',
        action: 'ATTENDANCE_CORRECTED',
        entity_type: 'attendance',
        entity_id: targetId || payload.staffUserId,
        category: 'people',
        reason: `[HR Review] ${payload.reason}`,
        before: beforeData,
        after: afterData,
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error correcting attendance';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // ==========================================
  // PHASE 2: LEAVE MANAGEMENT
  // ==========================================
  async getLeaveRecords(): Promise<Result<HrLeaveRecord[]>> {
    try {
      const client = getServiceRoleClient();

      const { data: users } = await client.from('app_user').select('id, full_name, display_name, role');
      const userMap = new Map((users || []).map((u) => [u.id, u]));

      const { data: leaves, error: lErr } = await client
        .from('leave_request')
        .select('*')
        .eq('location_id', this.locId)
        .order('from_date', { ascending: false });

      if (lErr) return fail({ code: 'INTERNAL_ERROR', message: lErr.message });

      const records: HrLeaveRecord[] = (leaves || []).map((l: any) => {
        const staff = userMap.get(l.staff_user_id);
        const req = userMap.get(l.requested_by);
        const dec = userMap.get(l.decided_by);

        return {
          id: l.id,
          staff_user_id: l.staff_user_id,
          staff_name: staff?.full_name || 'Staff Member',
          role: staff?.role || 'staff',
          from_date: l.from_date,
          to_date: l.to_date,
          leave_type: l.leave_type,
          status: l.status,
          requested_by_name: req?.display_name || 'HR',
          decided_by_name: dec?.display_name || undefined,
          decided_at: l.decided_at || undefined,
          created_at: l.created_at,
        };
      });

      return ok(records);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching leave records';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async recordLeave(payload: {
    staffUserId: string;
    fromDate: string;
    toDate: string;
    leaveType: 'annual_leave' | 'unpaid_leave' | 'other_approved_leave';
    status: 'requested' | 'approved';
    reason: string;
    hrActorId: string;
  }): Promise<Result<{ id: string }>> {
    try {
      const client = getServiceRoleClient();

      const { data: user } = await client.from('app_user').select('full_name').eq('id', payload.staffUserId).single();
      if (!user) return fail({ code: 'NOT_FOUND', message: 'Staff member not found.' });

      const { data: inserted, error: iErr } = await client
        .from('leave_request')
        .insert({
          organization_id: this.orgId,
          location_id: this.locId,
          staff_user_id: payload.staffUserId,
          from_date: payload.fromDate,
          to_date: payload.toDate,
          leave_type: payload.leaveType,
          status: payload.status,
          requested_by: payload.hrActorId,
          decided_by: payload.status === 'approved' ? payload.hrActorId : null,
          decided_at: payload.status === 'approved' ? new Date().toISOString() : null,
        })
        .select('id')
        .single();

      if (iErr) return fail({ code: 'INTERNAL_ERROR', message: iErr.message });

      // Audit row
      await client.from('audit_log').insert({
        organization_id: this.orgId,
        location_id: this.locId,
        actor_id: payload.hrActorId,
        actor_role: 'hr',
        action: payload.status === 'approved' ? 'LEAVE_APPROVED' : 'LEAVE_RECORDED',
        entity_type: 'leave_request',
        entity_id: inserted.id,
        category: 'people',
        reason: payload.reason || `HR recorded ${payload.leaveType} for ${user.full_name}`,
        after: {
          staff_user_id: payload.staffUserId,
          from_date: payload.fromDate,
          to_date: payload.toDate,
          leave_type: payload.leaveType,
          status: payload.status,
        },
      });

      return ok({ id: inserted.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error recording leave';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async decideLeaveRequest(payload: {
    leaveId: string;
    decision: 'approved' | 'rejected';
    hrActorId: string;
  }): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();

      const { data: leave } = await client.from('leave_request').select('*').eq('id', payload.leaveId).single();
      if (!leave) return fail({ code: 'NOT_FOUND', message: 'Leave request not found.' });
      if (leave.status !== 'requested') return fail({ code: 'CONFLICT', message: 'This leave request has already been decided.' });

      const { data: updated, error: updateError } = await client
        .from('leave_request')
        .update({
          status: payload.decision,
          decided_by: payload.hrActorId,
          decided_at: new Date().toISOString(),
        })
        .eq('id', payload.leaveId)
        .eq('status', 'requested')
        .select('id')
        .maybeSingle();
      if (updateError) return fail({ code: 'INTERNAL_ERROR', message: updateError.message });
      if (!updated) return fail({ code: 'CONFLICT', message: 'This leave request has already been decided.' });

      await client.from('audit_log').insert({
        organization_id: this.orgId,
        location_id: this.locId,
        actor_id: payload.hrActorId,
        actor_role: 'hr',
        action: payload.decision === 'approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
        entity_type: 'leave_request',
        entity_id: payload.leaveId,
        category: 'people',
        reason: payload.decision === 'approved' ? 'HR approved leave request' : 'HR rejected leave request; staff directed to contact HR',
        before: { status: leave.status },
        after: { status: payload.decision },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error deciding leave';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // ==========================================
  // PHASE 2: WEEKLY ROTA GRID
  // ==========================================
  async getWeeklyRota(): Promise<Result<{ rotas: HrWeeklyRota[]; expectedToday: number }>> {
    try {
      const client = getServiceRoleClient();

      const { data: users } = await client
        .from('app_user')
        .select('id, full_name, display_name, role, status')
        .eq('location_id', this.locId)
        .eq('status', 'active')
        .order('role', { ascending: true })
        .order('full_name', { ascending: true });

      const todayKampala = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
      const [{ data: entries }, policyRes] = await Promise.all([client
        .from('rota_entry')
        .select('*')
        .eq('location_id', this.locId).lte('effective_from', todayKampala).order('effective_from', { ascending: true }), client.from('work_hours_policy').select('working_days').eq('location_id', this.locId).lte('effective_from', todayKampala).order('effective_from', { ascending: false }).limit(1).maybeSingle()]);
      const workingDays = policyRes.data?.working_days || [1,2,3,4,5,6];

      const entryMap = new Map<string, { start_time: string; end_time: string; effective_from: string; is_off: boolean }>();
      (entries || []).forEach((e) => {
        entryMap.set(`${e.staff_user_id}_${e.weekday}`, {
          start_time: e.start_time.slice(0, 5),
          end_time: e.end_time.slice(0, 5),
          effective_from: e.effective_from,
          is_off: Boolean(e.is_off),
        });
      });

      const todayDow = new Date().getDay();
      let expectedToday = 0;

      const rotas: HrWeeklyRota[] = (users || []).map((u) => {
        const days: Record<number, HrRotaCell> = {};
        let effective = new Date().toISOString().split('T')[0];

        for (let dow = 0; dow <= 6; dow++) {
          const key = `${u.id}_${dow}`;
          const existing = entryMap.get(key);
          if (existing) {
            effective = existing.effective_from;
            days[dow] = {
              weekday: dow,
              is_off: existing.is_off,
              start_time: existing.start_time,
              end_time: existing.end_time,
            };
            if (dow === todayDow && !existing.is_off) expectedToday++;
          } else {
            const isDefaultOff = !workingDays.includes(dow);
            days[dow] = {
              weekday: dow,
              is_off: isDefaultOff,
              start_time: '08:00',
              end_time: '18:00',
            };
            if (dow === todayDow && !isDefaultOff) expectedToday++;
          }
        }

        return {
          staff_user_id: u.id,
          staff_name: u.full_name,
          role: u.role,
          effective_from: effective,
          days,
        };
      });

      return ok({ rotas, expectedToday });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching rota';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async saveRotaEntry(payload: {
    staffUserId: string;
    weekday: number;
    isOff: boolean;
    startTime: string;
    endTime: string;
    effectiveFrom: string;
    hrActorId: string;
  }): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();

      {
        const { data: existing } = await client
          .from('rota_entry')
          .select('id')
          .eq('staff_user_id', payload.staffUserId)
          .eq('weekday', payload.weekday)
          .eq('effective_from', payload.effectiveFrom)
          .maybeSingle();

        if (existing) {
          await client
            .from('rota_entry')
            .update({
              start_time: payload.startTime,
              end_time: payload.endTime,
              effective_from: payload.effectiveFrom,
              is_off: payload.isOff,
            })
            .eq('id', existing.id);
        } else {
          await client.from('rota_entry').insert({
            organization_id: this.orgId,
            location_id: this.locId,
            staff_user_id: payload.staffUserId,
            weekday: payload.weekday,
            start_time: payload.startTime,
            end_time: payload.endTime,
            effective_from: payload.effectiveFrom,
            is_off: payload.isOff,
          });
        }
      }

      await client.from('audit_log').insert({
        organization_id: this.orgId,
        location_id: this.locId,
        actor_id: payload.hrActorId,
        actor_role: 'hr',
        action: 'ROTA_UPDATED',
        entity_type: 'rota_entry',
        entity_id: `${payload.staffUserId}_${payload.weekday}`,
        category: 'people',
        reason: `HR updated weekday ${payload.weekday} shift schedule`,
        after: {
          staff_user_id: payload.staffUserId,
          weekday: payload.weekday,
          is_off: payload.isOff,
          start: payload.startTime,
          end: payload.endTime,
        },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error saving rota';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async copyLastWeekRota(payload: {
    effectiveFrom: string;
    hrActorId: string;
  }): Promise<Result<{ success: boolean; copiedCount: number }>> {
    try {
      const client = getServiceRoleClient();

      const { data: allEntries } = await client.from('rota_entry').select('*').eq('location_id', this.locId).lte('effective_from', payload.effectiveFrom).order('effective_from', { ascending: false });
      const latestKeys = new Set<string>();
      const current = (allEntries || []).filter((entry) => { const key = `${entry.staff_user_id}_${entry.weekday}`; if (latestKeys.has(key)) return false; latestKeys.add(key); return true; });

      // Re-apply current entries with the new effectiveFrom date
      if (current && current.length > 0) {
        for (const e of current) {
          const { data: existing } = await client.from('rota_entry').select('id').eq('staff_user_id', e.staff_user_id).eq('weekday', e.weekday).eq('effective_from', payload.effectiveFrom).maybeSingle();
          if (existing) await client.from('rota_entry').update({ start_time: e.start_time, end_time: e.end_time, is_off: e.is_off }).eq('id', existing.id);
          else await client.from('rota_entry').insert({ organization_id: e.organization_id, location_id: e.location_id, staff_user_id: e.staff_user_id, weekday: e.weekday, start_time: e.start_time, end_time: e.end_time, is_off: e.is_off, effective_from: payload.effectiveFrom });
        }
      }

      await client.from('audit_log').insert({
        organization_id: this.orgId,
        location_id: this.locId,
        actor_id: payload.hrActorId,
        actor_role: 'hr',
        action: 'ROTA_COPIED',
        entity_type: 'rota_entry',
        entity_id: this.locId,
        category: 'people',
        reason: `HR copied rota with effective date ${payload.effectiveFrom}`,
        after: { count: current?.length || 0, effectiveFrom: payload.effectiveFrom },
      });

      return ok({ success: true, copiedCount: current?.length || 0 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error copying rota';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  // ==========================================
  // PHASE 2: AUDIT LOG (PEOPLE & ACCESS CATEGORIES ONLY)
  // ==========================================
  async recordReportExport(input: { actorId: string; title: string; format: 'CSV' | 'PDF'; filters: string; recordCount: number }): Promise<Result<{ actorName: string }>> {
    try {
      const client = getServiceRoleClient();
      const [{ data: actor, error: actorError }, { data: day }] = await Promise.all([
        client.from('app_user').select('display_name, role').eq('id', input.actorId).eq('status', 'active').eq('role', 'hr').maybeSingle(),
        client.from('business_day').select('id').limit(1).maybeSingle(),
      ]);
      if (actorError) return fail({ code: 'INTERNAL_ERROR', message: actorError.message });
      if (!actor) return fail({ code: 'VALIDATION_ERROR', message: 'Only active HR users can export these reports.' });
      const { error } = await client.from('audit_log').insert({
        actor_id: input.actorId, actor_role: 'hr', action: 'HR_REPORT_EXPORTED', entity_type: 'hr_export',
        entity_id: input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), category: 'people', reason: `Exported ${input.title}`,
        business_day_id: day?.id, after: { format: input.format, filters: input.filters, record_count: input.recordCount },
      });
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      return ok({ actorName: actor.display_name });
    } catch (err: unknown) {
      return fail({ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Could not record HR report export.' });
    }
  }

  async getPeopleAuditLogs(filters?: {
    category?: 'all' | 'people' | 'access';
    actorId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Result<HrAuditEntry[]>> {
    try {
      const client = getServiceRoleClient();

      let query = client
        .from('hr_people_access_audit')
        .select('id, at, actor_id, actor_role, action, entity_type, entity_id, reason, before, after, category')
        .order('at', { ascending: false })
        .limit(100);

      if (filters?.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }
      if (filters?.actorId && filters.actorId !== 'all') {
        query = query.eq('actor_id', filters.actorId);
      }
      if (filters?.startDate) {
        query = query.gte('at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('at', filters.endDate + 'T23:59:59Z');
      }

      const { data: logs, error: lErr } = await query;
      if (lErr) return fail({ code: 'INTERNAL_ERROR', message: lErr.message });

      // Actor display names
      const actorIds = Array.from(new Set((logs || []).map((l) => l.actor_id).filter(Boolean)));
      const { data: actors } = await client.from('app_user').select('id, display_name').in('id', actorIds);
      const actorMap = new Map((actors || []).map((a) => [a.id, a.display_name]));
      const targetIds = Array.from(new Set((logs || []).map((l) => l.entity_id).filter((id) => /^[0-9a-f-]{36}$/i.test(id || ''))));
      const { data: targets } = targetIds.length
        ? await client.from('app_user').select('id, display_name').in('id', targetIds)
        : { data: [] as { id: string; display_name: string }[] };
      const targetMap = new Map((targets || []).map((u) => [u.id, u.display_name]));

      const entries: HrAuditEntry[] = (logs || []).map((l) => ({
        id: l.id.toString(),
        at: l.at,
        actor_id: l.actor_id,
        actor_name: actorMap.get(l.actor_id) || l.actor_role,
        actor_role: l.actor_role,
        action: l.action,
        entity_type: l.entity_type,
        entity_id: l.entity_id,
        category: l.category as 'people' | 'access',
        target_name: targetMap.get(l.entity_id) || undefined,
        reason: l.reason || undefined,
        before: (l.before as Record<string, unknown>) || undefined,
        after: (l.after as Record<string, unknown>) || undefined,
      }));

      return ok(entries);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching audit logs';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }
}

