'use server';

import { AttendanceRepository, AttendanceStatus } from '../models/attendance.repository';
import { getAuthUser } from '@/modules/auth';

const attendanceRepo = new AttendanceRepository();

export async function getMyAttendanceAction() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return { success: false, error: 'Unauthorized' };
  }
  const res = await attendanceRepo.getMyTodayAttendance(authUser.id);
  if (!res.success) {
    return { success: false, error: res.error.message };
  }
  return { success: true, data: res.data };
}

export async function setMyAttendanceAction(targetStatus: AttendanceStatus) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return { success: false, error: 'Unauthorized' };
  }
  const res = await attendanceRepo.setMyAttendance(authUser.id, targetStatus);
  if (!res.success) {
    return { success: false, error: res.error.message };
  }
  return { success: true, data: res.data };
}

export async function getAttendanceGateDetailsAction() {
  const user = await getAuthUser();
  if (!user) return null;
  const [attendance, scheduledStartTime] = await Promise.all([
    attendanceRepo.getMyTodayAttendance(user.id),
    attendanceRepo.getScheduledStart(user.id),
  ]);
  if (!attendance.success) return null;
  return {
    displayName: user.displayName || user.fullName,
    role: user.role,
    status: attendance.data.status,
    clockInTime: attendance.data.clockInTime,
    scheduledStartTime,
    businessDate: attendance.data.businessDate,
    now: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' }),
  };
}
