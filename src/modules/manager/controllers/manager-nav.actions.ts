'use server';

import {
  ManagerOperationsRepository,
  type ManagerTodayStats,
  type ManagerQueueItem,
  type ManagerAttendanceSummary,
  type ManagerRecentActivity,
  type ManagerAppointmentItem,
  type ManagerCatalogueItem,
  type ManagerCatalogueVariant,
  type ManagerDiscountReason,
  type ManagerReconciliationData,
  type ManagerReconciliationEntry,
  type ManagerStaffMember,
  type StaffTargetSetting,
  type ManagerDeviceItem,
  type ManagerCustomerItem,
  type ManagerReportsData,
} from '../models/manager-operations.repository';
export type {
  ManagerTodayStats,
  ManagerQueueItem,
  ManagerAttendanceSummary,
  ManagerRecentActivity,
  ManagerAppointmentItem,
  ManagerCatalogueItem,
  ManagerCatalogueVariant,
  ManagerDiscountReason,
  ManagerReconciliationData,
  ManagerReconciliationEntry,
  ManagerStaffMember,
  StaffTargetSetting,
  ManagerDeviceItem,
  ManagerCustomerItem,
  ManagerReportsData,
};
import { DayRepository, BusinessDayState } from '@/modules/day';
import { getAuthUser } from '@/modules/auth';
import { HrRepository } from '@/modules/people-hr';

const managerRepo = new ManagerOperationsRepository();
const dayRepo = new DayRepository();
const hrRepo = new HrRepository();

export async function resetManagerStaffPinAction(userId: string) {
  const actor = await getAuthUser();
  if (!actor || actor.role !== 'manager') {
    return { success: false as const, error: { code: 'FORBIDDEN' as const, message: 'Only the salon manager may reset staff or receptionist PINs.' } };
  }
  return hrRepo.resetPin({ userId, hrActorId: actor.id });
}

export async function getPendingApprovalsCountAction(): Promise<{ success: boolean; count: number }> {
  const res = await managerRepo.getPendingApprovalsCount();
  if (!res.success) {
    return { success: false, count: 0 };
  }
  return { success: true, count: res.data };
}

export async function getManagerTodayOverviewAction(): Promise<{
  success: boolean;
  dayState: BusinessDayState | null;
  olderOpenDay: BusinessDayState | null;
  stats: ManagerTodayStats;
  queue: { items: ManagerQueueItem[]; washHoldWarning: boolean };
  attendance: ManagerAttendanceSummary;
  recentActivity: ManagerRecentActivity[];
  error?: string;
}> {
  try {
    const [dayRes, olderRes, statsRes, queueRes, attRes, actRes] = await Promise.all([
      dayRepo.getTodayDay(),
      dayRepo.getOlderOpenDay(),
      managerRepo.getTodayStats(),
      managerRepo.getLiveQueue(),
      managerRepo.getAttendanceSnapshot(),
      managerRepo.getRecentActivity(),
    ]);

    const stats: ManagerTodayStats = statsRes.success
      ? statsRes.data
      : { waiting: 0, in_service: 0, completed: 0, left_queue: 0, unpaid: 0, orders_awaiting_payment: 0, pending_approvals: 0 };

    const queue = queueRes.success ? queueRes.data : { items: [], washHoldWarning: false };
    const attendance: ManagerAttendanceSummary = attRes.success
      ? attRes.data
      : { present: 0, on_break: 0, out: 0, not_present: 0, on_leave: 0, total_expected: 0, records: [] };
    const recentActivity = actRes.success ? actRes.data : [];

    return {
      success: true,
      dayState: dayRes.success ? dayRes.data : null,
      olderOpenDay: olderRes.success ? olderRes.data : null,
      stats,
      queue,
      attendance,
      recentActivity,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Failed to load manager today overview';
    return {
      success: false,
      dayState: null,
      olderOpenDay: null,
      stats: { waiting: 0, in_service: 0, completed: 0, left_queue: 0, unpaid: 0, orders_awaiting_payment: 0, pending_approvals: 0 },
      queue: { items: [], washHoldWarning: false },
      attendance: { present: 0, on_break: 0, out: 0, not_present: 0, on_leave: 0, total_expected: 0, records: [] },
      recentActivity: [],
      error,
    };
  }
}

export async function getApprovalRequestsAction(status: 'pending' | 'decided' = 'pending') {
  const res = await managerRepo.getApprovalRequests(status);
  if (!res.success) {
    return { success: false, data: [], error: res.error.message };
  }
  return { success: true, data: res.data };
}

export async function decideApprovalRequestAction(
  requestId: string,
  decision: 'approved' | 'rejected',
  approvedAmountUgx?: number,
  declineReason?: string
) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002'; // fallback to Joan
  const res = await managerRepo.decideApprovalRequest(
    requestId,
    managerId,
    decision,
    approvedAmountUgx,
    declineReason
  );
  if (!res.success) {
    return { success: false, error: res.error.message };
  }
  return { success: true };
}

export async function getQueueBoardAction() {
  const res = await managerRepo.getQueueBoard();
  if (!res.success) {
    return { success: false, data: { pool_lines: [], stylists: [] }, error: res.error.message };
  }
  return { success: true, data: res.data };
}

export async function reassignLineAction(lineId: string, targetStaffId: string | null, reasonCode: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.reassignLine(lineId, managerId, targetStaffId, reasonCode);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function startOutOfOrderAction(lineId: string, staffId: string, reasonCode: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.startOutOfOrder(lineId, managerId, staffId, reasonCode);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function removeStartedLineAction(lineId: string, reasonCode: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.removeStartedLine(lineId, managerId, reasonCode);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function markStylistUnavailableAction(stylistId: string, reasonCode: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.markStylistUnavailable(stylistId, managerId, reasonCode);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true, data: res.data };
}

export async function getManagerVisitsAction(tab: 'today' | 'all' | 'unpaid' | 'abandoned' | 'awaiting' = 'today') {
  const res = await managerRepo.getVisits(tab);
  if (!res.success) return { success: false, data: [], error: res.error.message };
  return { success: true, data: res.data };
}

export async function addComplimentaryLineAction(visitId: string, serviceVariantId: string, reasonCode: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.addComplimentaryLine(visitId, managerId, serviceVariantId, reasonCode);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function adjustVisitTotalAction(visitId: string, newTotalUgx: number, reasonCode: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.adjustVisitTotal(visitId, managerId, newTotalUgx, reasonCode);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function correctTimestampsAction(lineId: string, startedAt: string, endedAt: string, reasonCode: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.correctTimestamps(lineId, managerId, startedAt, endedAt, reasonCode);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function getManagerPaymentsAction() {
  const res = await managerRepo.getPayments();
  if (!res.success) return { success: false, data: [], error: res.error.message };
  return { success: true, data: res.data };
}

export async function recordPaymentAction(
  visitId: string,
  method: 'cash' | 'mobile_money',
  amountUgx: number,
  providerReference: string | undefined,
  idempotencyKey: string
) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.recordPayment(visitId, managerId, method, amountUgx, providerReference, idempotencyKey);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function attachPaymentReferenceAction(paymentId: string, reference: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.attachPaymentReference(paymentId, managerId, reference);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function voidPaymentAction(paymentId: string, reasonCode: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.voidPayment(paymentId, managerId, reasonCode);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function refundPaymentAction(paymentId: string, amountUgx: number, reasonCode: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.refundPayment(paymentId, managerId, amountUgx, reasonCode);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

// ------------------------------------
// Phase 2 Server Actions
// ------------------------------------


export async function createAppointmentAction(payload: {
  customerName: string;
  customerPhone: string;
  serviceId: string;
  stylistId?: string;
  startsAt: string;
  expectedMinutes?: number;
}) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.createAppointment({
    ...payload,
    managerUserId: managerId,
  });
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true, data: res.data };
}
export async function getAppointmentsAction() {
  const res = await managerRepo.getAppointments();
  if (!res.success) return { success: false, error: res.error.message, data: [] };
  return { success: true, data: res.data };
}

export async function checkInAppointmentAction(appointmentId: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.checkInAppointment(appointmentId, managerId);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true, data: res.data };
}

export async function getCatalogueAction() {
  const res = await managerRepo.getCatalogue();
  if (!res.success) return { success: false, error: res.error.message, data: [] };
  return { success: true, data: res.data };
}

export async function updateVariantPriceAction(
  variantId: string,
  newListPrice: number,
  newMinPrice: number,
  newMaxPrice: number,
  reason: string
) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.updateVariantPrice(variantId, managerId, newListPrice, newMinPrice, newMaxPrice, reason);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function getDiscountRulesAction() {
  const res = await managerRepo.getDiscountRules();
  if (!res.success) return { success: false, error: res.error.message, data: [] };
  return { success: true, data: res.data };
}

export async function toggleDiscountReasonAction(reasonId: string, active: boolean) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.toggleDiscountReason(reasonId, active, managerId);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function getReconciliationDataAction() {
  const res = await managerRepo.getReconciliationData();
  if (!res.success) return { success: false, error: res.error.message, data: null };
  return { success: true, data: res.data };
}

export async function writeOffReconciliationAction(entryId: string, reason: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.writeOffReconciliationDiscrepancy(entryId, managerId, reason);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function beginCloseDayAction(businessDayId: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.beginCloseDay(businessDayId, managerId);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true, data: res.data };
}

export async function cancelClosingAction(businessDayId: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.cancelClosing(businessDayId, managerId);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function undoCloseAction(businessDayId: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.undoClose(businessDayId, managerId);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function closeBusinessDayAction(businessDayId: string, cashCountedUgx: number, notes?: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.closeBusinessDay(businessDayId, managerId, cashCountedUgx, notes);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function reopenBusinessDayAction(businessDayId: string, reason: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.reopenBusinessDay(businessDayId, managerId, reason);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

// ------------------------------------
// Phase 3 Server Actions
// ------------------------------------
export async function getStaffListAction() {
  const res = await managerRepo.getStaffList();
  if (!res.success) return { success: false, error: res.error.message, data: [] };
  return { success: true, data: res.data };
}

export async function toggleStaffStatusAction(userId: string, newStatus: 'active' | 'inactive') {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.toggleStaffStatus(userId, newStatus, managerId);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function getDevicesAction() {
  const res = await managerRepo.getDevices();
  if (!res.success) return { success: false, error: res.error.message, data: [] };
  return { success: true, data: res.data };
}

export async function pairDeviceAction(name: string, kind: 'reception_tablet' | 'queue_screen') {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.pairDevice(name, kind, managerId);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true, data: res.data };
}

export async function revokeDeviceAction(deviceId: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.revokeDevice(deviceId, managerId);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function getCustomersAction() {
  const res = await managerRepo.getCustomers();
  if (!res.success) return { success: false, error: res.error.message, data: [] };
  return { success: true, data: res.data };
}

export async function mergeCustomersAction(sourceCustomerId: string, targetCustomerId: string, reason: string) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.mergeCustomers(sourceCustomerId, targetCustomerId, managerId, reason);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function setCustomerTierAction(
  customerId: string,
  tier: 'regular' | 'premium',
  reason: string
) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.setCustomerTier(customerId, tier, reason, managerId);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function enterPaperVisitAction(
  customerPhone: string,
  customerName: string,
  variantId: string,
  staffUserId: string | undefined,
  amountUgx: number,
  paperRef: string
) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.enterPaperVisit(customerPhone, customerName, variantId, staffUserId, amountUgx, paperRef, managerId);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true, data: res.data };
}

export async function getManagerReportsAction() {
  const res = await managerRepo.getManagerReportsData();
  if (!res.success) return { success: false, error: res.error.message, data: null };
  return { success: true, data: res.data };
}






export async function setStaffTargetAction(payload: {
  staffId: string;
  targetCustomers: number;
  period: 'weekly' | 'monthly' | '3-month';
  deadline: string;
  commissionBasePercent: number;
}) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await managerRepo.setStaffTarget(
    payload.staffId,
    payload.targetCustomers,
    payload.period,
    payload.deadline,
    payload.commissionBasePercent,
    managerId
  );
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}
