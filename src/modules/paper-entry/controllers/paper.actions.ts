'use server';

import { paperRepo } from '../models/paper.repository';
import { getAuthUser } from '@/modules/auth';

export async function getPaperCatalogueAction() {
  return paperRepo.getPaperCatalogue();
}

export async function getPaperStaffAction() {
  return paperRepo.getPaperStaff();
}

export async function enterPaperVisitAction(payload: {
  customerPhone: string;
  customerName: string;
  variantId: string;
  staffUserId?: string;
  amountUgx: number;
  paperSerial: string;
  role: 'receptionist' | 'manager';
}) {
  const authUser = await getAuthUser();
  const userId =
    authUser?.id ||
    (payload.role === 'manager'
      ? 'c0000000-0000-0000-0000-000000000002'
      : 'c0000000-0000-0000-0000-000000000004');

  return paperRepo.enterPaperVisit({
    customerPhone: payload.customerPhone,
    customerName: payload.customerName,
    variantId: payload.variantId,
    staffUserId: payload.staffUserId,
    amountUgx: payload.amountUgx,
    paperSerial: payload.paperSerial,
    actorUserId: userId,
    actorRole: payload.role,
  });
}
