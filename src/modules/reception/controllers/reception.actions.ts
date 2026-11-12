'use server';

import {
  ReceptionOperationsRepository,
  ReceptionCustomerMatch,
  ReceptionStylistOption,
  ReceptionServiceLineDraft,
  ReceptionQueueItem,
  TabletDraftSession,
  ReceptionKioskOrder,
  ReceptionKioskOrderListItem,
} from '../models/reception.repository';
import { getAuthUser } from '@/modules/auth';

const receptionRepo = new ReceptionOperationsRepository();

export type {
  ReceptionCustomerMatch,
  ReceptionStylistOption,
  ReceptionServiceLineDraft,
  ReceptionQueueItem,
  TabletDraftSession,
  ReceptionKioskOrder,
  ReceptionKioskOrderListItem,
};

async function kioskActor() {
  const user = await getAuthUser();
  if (!user || !['receptionist', 'manager'].includes(user.role)) return null;
  return user;
}

export async function getPendingKioskOrdersAction() {
  const user = await kioskActor();
  if (!user) return { success: false as const, error: { code: 'FORBIDDEN', message: 'Only reception and management can view kiosk orders.' } };
  return receptionRepo.getPendingKioskOrders(user.id);
}

export async function getPendingKioskOrderCountAction() {
  const user = await kioskActor();
  if (!user) return { success: false as const, error: { code: 'FORBIDDEN', message: 'Not allowed.' } };
  return receptionRepo.kioskOrderCount(user.id);
}

export async function getKioskOrdersPageAction(input: { status: 'waiting' | 'handling' | 'expired' | 'cancelled'; search: string; limit: number; offset: number }) {
  const user = await kioskActor();
  if (!user) return { success: false as const, error: { code: 'FORBIDDEN', message: 'Only reception and management can view kiosk orders.' } };
  return receptionRepo.getKioskOrdersPage(user.id, input.status, input.search, input.limit, input.offset);
}

export async function getKioskDiscountApprovalAction(orderId: string, amount: number) {
  const user = await kioskActor();
  if (!user) return { success: false as const, error: { code: 'FORBIDDEN', message: 'Not allowed.' } };
  return receptionRepo.getKioskDiscountApproval(orderId, amount);
}

export async function claimKioskOrderAction(orderId: string) {
  const user = await kioskActor();
  if (!user) return { success: false as const, error: { code: 'FORBIDDEN', message: 'Only reception and management can open kiosk orders.' } };
  return receptionRepo.claimKioskOrder(orderId, user.id);
}

export async function touchKioskClaimAction(orderId: string) {
  const user = await kioskActor();
  if (!user) return { success: false as const, error: { code: 'FORBIDDEN', message: 'Not allowed.' } };
  return receptionRepo.touchKioskClaim(orderId, user.id);
}

export async function releaseKioskOrderAction(orderId: string) {
  const user = await kioskActor();
  if (!user) return { success: false as const, error: { code: 'FORBIDDEN', message: 'Not allowed.' } };
  return receptionRepo.releaseKioskOrder(orderId, user.id);
}

export async function cancelKioskOrderAction(orderId: string, reason: string) {
  const user = await kioskActor();
  if (!user) return { success: false as const, error: { code: 'FORBIDDEN', message: 'Not allowed.' } };
  return receptionRepo.cancelKioskOrder(orderId, user.id, reason);
}

export async function confirmKioskOrderAction(payload: {
  order_id: string; first_name: string; phone: string; lines: ReceptionServiceLineDraft[];
  discount_ugx: number; discount_reason?: string; method: 'cash' | 'mobile_money';
  provider_reference?: string; idempotency_key: string; number_read_back: boolean;
}) {
  const user = await kioskActor();
  if (!user) return { success: false as const, error: { code: 'FORBIDDEN', message: 'Only reception and management can take payment for kiosk orders.' } };
  return receptionRepo.confirmKioskOrder({ ...payload, actor_id: user.id });
}

export async function getBusinessDayStatusAction() {
  return receptionRepo.getBusinessDayStatus();
}

export async function lookupCustomersAction(phone: string) {
  return receptionRepo.lookupCustomers(phone);
}

export async function getStylistsTodayAction() {
  return receptionRepo.getStylistsToday();
}

export async function getLiveReceptionQueueAction() {
  return receptionRepo.getLiveQueue();
}

export async function createVisitAction(payload: {
  customer: { id?: string; phone: string; first_name: string };
  lines: ReceptionServiceLineDraft[];
  discount_ugx?: number;
  discount_reason?: string;
  payment?: {
    method: 'cash' | 'momo';
    amount_ugx: number;
    provider_reference?: string;
    idempotency_key: string;
  };
}) {
  const authUser = await getAuthUser();
  const receptionistId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.createVisitWithLines({
    ...payload,
    receptionist_user_id: receptionistId,
  });
}

export async function requestManagerApprovalAction(payload: {
  kind: 'discount' | 'remove_started_line' | 'dispute_adjustment' | 'late_appointment_conversion';
  visit_id?: string;
  reason: string;
  details: Record<string, any>;
}) {
  const authUser = await getAuthUser();
  const receptionistId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.requestManagerApproval({
    ...payload,
    receptionist_id: receptionistId,
  });
}

export async function removeFromQueueAction(visitId: string, reason: string) {
  const authUser = await getAuthUser();
  const userId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.removeFromQueue(visitId, reason, userId);
}

export async function reassignLineAction(lineId: string, newStaffUserId: string, reason: string) {
  const authUser = await getAuthUser();
  const userId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.reassignLine(lineId, newStaffUserId, reason, userId);
}

export async function startLineOnBehalfAction(lineId: string, reason: string) {
  const authUser = await getAuthUser();
  const userId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.startLineOnBehalf(lineId, reason, userId);
}

export async function finishLineOnBehalfAction(lineId: string, reason?: string) {
  const authUser = await getAuthUser();
  const userId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.finishLineOnBehalf(lineId, userId, reason);
}

export async function markStaffAttendanceOnBehalfAction(staffUserId: string, status: 'in' | 'late', reason: string) {
  const authUser = await getAuthUser();
  const userId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.markStaffAttendanceOnBehalf(staffUserId, status, reason, userId);
}

export async function getTabletDraftAction() {
  return receptionRepo.getTabletDraft();
}

export async function pushTabletCategoryAction(category: string | null) {
  return receptionRepo.pushTabletCategory(category);
}

export async function revokeTabletDeviceAction(deviceId: string) {
  const authUser = await getAuthUser();
  const userId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.revokeTabletDevice(deviceId, userId);
}

export async function getCheckoutVisitsAction() {
  return receptionRepo.getCheckoutVisits();
}

export async function recordPaymentAction(payload: {
  visit_id: string;
  method: 'cash' | 'momo';
  amount_ugx: number;
  provider_reference?: string;
  idempotency_key: string;
}) {
  const authUser = await getAuthUser();
  const userId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.recordPayment({
    ...payload,
    receptionist_user_id: userId,
  });
}

export async function flagPaymentPendingAction(visitId: string, reason: string) {
  const authUser = await getAuthUser();
  const userId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.flagPaymentPending(visitId, userId, reason);
}

export async function getAppointmentsAction() {
  return receptionRepo.getAppointments();
}

export async function createAppointmentAction(payload: {
  customerName: string;
  customerPhone: string;
  serviceId: string;
  stylistId?: string;
  startsAt: string;
  expectedMinutes?: number;
}) {
  const authUser = await getAuthUser();
  const userId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.createAppointment({
    ...payload,
    actorUserId: userId,
  });
}

export async function convertAppointmentToVisitAction(appointmentId: string) {
  const authUser = await getAuthUser();
  const userId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.convertAppointmentToVisit(appointmentId, userId);
}

export async function markAppointmentLateAction(appointmentId: string) {
  const authUser = await getAuthUser();
  const userId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.markAppointmentLate(appointmentId, userId);
}

export async function cancelAppointmentAction(appointmentId: string, reason: string) {
  const authUser = await getAuthUser();
  const userId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.cancelAppointment(appointmentId, reason, userId);
}

export async function getCustomersListAction(searchQuery?: string) {
  return receptionRepo.getCustomersList(searchQuery);
}

export async function updateCustomerFirstNameAction(customerId: string, newFirstName: string) {
  const authUser = await getAuthUser();
  const userId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.updateCustomerFirstName(customerId, newFirstName, userId);
}

export async function logCustomerProfilePdfExportAction(customerId: string) {
  const authUser = await getAuthUser();
  const userId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.logCustomerProfilePdfExport(customerId, userId);
}

export async function getVisitsTabsDataAction(search?: string, dateRange?: { start?: string; end?: string }, mode: 'current' | 'today' | 'history' = 'current') {
  return receptionRepo.getVisitsTabsData(search, dateRange, mode);
}

export async function getClosePrepDataAction() {
  return receptionRepo.getClosePrepData();
}

export async function submitClosePrepCashCountAction(countedCashUgx: number, notes: string) {
  const authUser = await getAuthUser();
  const userId = authUser?.id || 'c0000000-0000-0000-0000-000000000004';
  return receptionRepo.submitClosePrepCashCount(countedCashUgx, notes, userId);
}
