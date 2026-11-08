'use server';

import { HrRepository } from '../models/hr.repository';
import type {
  HrStaffMember,
  HrOverviewStats,
  HrPendingRevocationItem,
  HrPairedDeviceItem,
  HrAuditChangeItem,
  HrAttendanceRecord,
  HrPunctualitySummary,
  HrLeaveRecord,
  HrRotaCell,
  HrWeeklyRota,
  HrAuditEntry,
  HrWorkHoursPolicy,
  HrAnnualLeavePolicy,
  HrLeaveBalance,
} from '../models/hr.repository';
import { getCurrentUserAction } from '@/modules/auth';

export type {
  HrStaffMember,
  HrOverviewStats,
  HrPendingRevocationItem,
  HrPairedDeviceItem,
  HrAuditChangeItem,
  HrAttendanceRecord,
  HrPunctualitySummary,
  HrLeaveRecord,
  HrRotaCell,
  HrWeeklyRota,
  HrAuditEntry,
  HrWorkHoursPolicy,
  HrAnnualLeavePolicy,
  HrLeaveBalance,
};

const hrRepo = new HrRepository();

async function getHrActorId(): Promise<string> {
  const user = await getCurrentUserAction();
  if (!user || user.role !== 'hr') {
    throw new Error('Unauthorized: Only HR administrator can perform this action.');
  }
  return user.id;
}

export async function getHrBadgesAction() {
  return hrRepo.getHrBadges();
}

export async function getHrOverviewStatsAction() {
  await getHrActorId();
  return hrRepo.getOverviewStats();
}

export async function getStaffDirectoryAction() {
  await getHrActorId();
  return hrRepo.getStaffDirectory();
}

export async function createAccountAction(payload: {
  fullName: string;
  role: 'staff' | 'receptionist' | 'manager';
  phone: string;
  username: string;
  startDate: string;
  pin?: string;
}) {
  const hrActorId = await getHrActorId();
  return hrRepo.createAccount({ ...payload, hrActorId });
}

export async function editStaffProfileAction(payload: {
  userId: string;
  fullName: string;
  phone: string;
  startDate: string;
}) {
  const hrActorId = await getHrActorId();
  return hrRepo.editStaffProfile({ ...payload, hrActorId });
}

export async function changeRoleAction(payload: {
  userId: string;
  newRole: 'staff' | 'receptionist' | 'manager';
  reason: string;
}) {
  const hrActorId = await getHrActorId();
  return hrRepo.changeRole({ ...payload, hrActorId });
}

export async function toggleAccountStatusAction(payload: {
  userId: string;
  status: 'active' | 'inactive';
  reason: string;
}) {
  const hrActorId = await getHrActorId();
  return hrRepo.toggleAccountStatus({ ...payload, hrActorId });
}

export async function saveChecklistAction(payload: {
  userId: string;
  type: 'onboarding' | 'offboarding';
  items: string[];
}) {
  await getHrActorId();
  return hrRepo.saveChecklist(payload.userId, payload.type, payload.items);
}

export async function resetPinAction(payload: { userId: string }) {
  const user = await getCurrentUserAction();
  if (!user || !['hr', 'manager'].includes(user.role)) {
    throw new Error('Unauthorized: Only HR or the salon manager may reset staff PINs.');
  }
  const hrActorId = user.id;
  return hrRepo.resetPin({ userId: payload.userId, hrActorId });
}

export async function getPendingManagerRevocationsAction() {
  await getHrActorId();
  return hrRepo.getPendingManagerRevocations();
}

export async function decideManagerRevocationAction(payload: {
  userId: string;
  decision: 'confirm' | 'reverse';
  reason: string;
}) {
  const hrActorId = await getHrActorId();
  return hrRepo.decideManagerRevocation({ ...payload, hrActorId });
}

export async function getPairedDevicesAction() {
  await getHrActorId();
  return hrRepo.getPairedDevices();
}

export async function revokeDeviceAction(payload: { deviceId: string; reason: string }) {
  const hrActorId = await getHrActorId();
  return hrRepo.revokeDevice({ ...payload, hrActorId });
}

// ==========================================
// PHASE 2 ACTIONS
// ==========================================
export async function getAttendanceRecordsAction(filters?: {
  startDate?: string;
  endDate?: string;
  staffUserId?: string;
  role?: string;
}) {
  await getHrActorId();
  return hrRepo.getAttendanceDailyRecords(filters);
}

export async function getWorkHoursPolicyAction() { await getHrActorId(); return hrRepo.getAttendancePolicy(); }
export async function saveWorkHoursPolicyAction(policy: HrWorkHoursPolicy) { return hrRepo.saveWorkHoursPolicy(await getHrActorId(), policy); }
export async function getAnnualLeavePolicyAction() { await getHrActorId(); return hrRepo.getAnnualLeavePolicy(); }
export async function saveAnnualLeavePolicyAction(policy: HrAnnualLeavePolicy) { return hrRepo.saveAnnualLeavePolicy(await getHrActorId(), policy); }
export async function getLeaveBalancesAction() { await getHrActorId(); return hrRepo.getLeaveBalances(); }
export async function savePersonLeaveEntitlementAction(staffUserId: string, days: number | null) { return hrRepo.savePersonLeaveEntitlement(await getHrActorId(), staffUserId, days); }

export async function correctAttendanceAction(payload: {
  attendanceId?: string;
  staffUserId: string;
  businessDate: string;
  clockIn?: string | null;
  clockOut?: string | null;
  absenceType: 'none' | 'approved_leave' | 'unapproved_absence' | 'off_duty';
  reason: string;
}) {
  const hrActorId = await getHrActorId();
  return hrRepo.correctAttendance({ ...payload, hrActorId });
}

export async function getLeaveRecordsAction() {
  await getHrActorId();
  return hrRepo.getLeaveRecords();
}

export async function recordLeaveAction(payload: {
  staffUserId: string;
  fromDate: string;
  toDate: string;
  leaveType: 'annual_leave' | 'unpaid_leave' | 'other_approved_leave';
  status: 'requested' | 'approved';
  reason: string;
}) {
  const hrActorId = await getHrActorId();
  return hrRepo.recordLeave({ ...payload, hrActorId });
}

export async function decideLeaveRequestAction(payload: {
  leaveId: string;
  decision: 'approved' | 'rejected';
}) {
  const hrActorId = await getHrActorId();
  return hrRepo.decideLeaveRequest({ ...payload, hrActorId });
}

export async function getWeeklyRotaAction() {
  await getHrActorId();
  return hrRepo.getWeeklyRota();
}

export async function saveRotaEntryAction(payload: {
  staffUserId: string;
  weekday: number;
  isOff: boolean;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
}) {
  const hrActorId = await getHrActorId();
  return hrRepo.saveRotaEntry({ ...payload, hrActorId });
}

export async function copyLastWeekRotaAction(payload: { effectiveFrom: string }) {
  const hrActorId = await getHrActorId();
  return hrRepo.copyLastWeekRota({ ...payload, hrActorId });
}

export async function getPeopleAuditLogsAction(filters?: {
  category?: 'all' | 'people' | 'access';
  actorId?: string;
  startDate?: string;
  endDate?: string;
}) {
  await getHrActorId();
  return hrRepo.getPeopleAuditLogs(filters);
}

export async function recordHrReportExportAction(input: { title: string; format: 'CSV' | 'PDF'; filters: string; recordCount: number }) {
  const actorId = await getHrActorId();
  return hrRepo.recordReportExport({ ...input, actorId });
}

