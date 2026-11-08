'use server';

import {
  StaffRepository,
  type StaffPortalState,
  type StaffQueueItem,
  type StaffAppointmentItem,
  type StaffTargetInfo,
  type StaffLeaveRequest,
  type StaffLeavePreview,
  type StaffLeaveBalance,
} from '../models/staff.repository';
import { getAuthUser } from '@/modules/auth';

const staffRepo = new StaffRepository();

export type { StaffPortalState, StaffQueueItem, StaffAppointmentItem, StaffTargetInfo, StaffLeaveRequest, StaffLeavePreview, StaffLeaveBalance };

export async function getStaffQueueAction() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return { success: false as const, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } };
  }
  return staffRepo.getStaffPortalQueue(authUser.id);
}

export async function startStaffLineAction(lineId: string) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return { success: false as const, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } };
  }
  return staffRepo.startLine(lineId, authUser.id);
}

export async function finishStaffLineAction(lineId: string) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return { success: false as const, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } };
  }
  return staffRepo.finishLine(lineId, authUser.id);
}

export async function undoStaffLineAction(lineId: string) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return { success: false as const, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } };
  }
  return staffRepo.undoAction(lineId, authUser.id);
}

export async function getMyServiceHistoryAction() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return { success: false as const, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } };
  }
  return staffRepo.getMyServiceHistory(authUser.id);
}

export async function getMyAttendanceLogsAction() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return { success: false as const, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } };
  }
  return staffRepo.getMyAttendanceLogs(authUser.id);
}

export async function getMyLeaveDataAction() {
  const user = await getAuthUser();
  if (!user || user.role !== 'staff') return { success: false as const, error: { code: 'FORBIDDEN', message: 'Staff access required.' } };
  return staffRepo.getMyLeaveData(user.id);
}

export async function previewMyLeaveRequestAction(payload: { fromDate: string; toDate: string; leaveType: StaffLeaveRequest['leave_type'] }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'staff') return { success: false as const, error: { code: 'FORBIDDEN', message: 'Staff access required.' } };
  return staffRepo.previewMyLeaveRequest(user.id, payload.fromDate, payload.toDate, payload.leaveType);
}

export async function requestMyLeaveAction(payload: { fromDate: string; toDate: string; leaveType: StaffLeaveRequest['leave_type'] }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'staff') return { success: false as const, error: { code: 'FORBIDDEN', message: 'Staff access required.' } };
  return staffRepo.requestMyLeave(user.id, payload.fromDate, payload.toDate, payload.leaveType);
}

export async function cancelMyLeaveRequestAction(leaveId: string) {
  const user = await getAuthUser();
  if (!user || user.role !== 'staff') return { success: false as const, error: { code: 'FORBIDDEN', message: 'Staff access required.' } };
  return staffRepo.cancelMyLeaveRequest(user.id, leaveId);
}
