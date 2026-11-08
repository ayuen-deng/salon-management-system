'use server';

import { KioskOrderRepository, type KioskOrderLineInput } from '../models/kiosk-order.repository';

const kioskOrders = new KioskOrderRepository();

export async function pairKioskDeviceAction(pairingCode: string) {
  if (!/^\d{6}$/.test(pairingCode)) {
    return { success: false as const, error: { code: 'VALIDATION_ERROR', message: 'Enter the six-digit pairing code.' } };
  }
  return kioskOrders.pairDevice(pairingCode);
}

export async function createKioskOrderAction(input: {
  sessionToken: string;
  idempotencyKey: string;
  firstName: string;
  phone: string;
  lines: KioskOrderLineInput[];
}) {
  return kioskOrders.createOrder(input);
}

export async function getKioskBusinessDayStatusAction(sessionToken: string) {
  return kioskOrders.getBusinessDayStatus(sessionToken);
}
