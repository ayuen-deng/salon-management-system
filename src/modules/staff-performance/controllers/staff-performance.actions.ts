'use server';

import { getAuthUser } from '@/modules/auth';
import { fail, type Result } from '@/shared/models/result';
import {
  StaffPerformanceRepository,
  type StaffPerformanceFilter,
  type StaffPerformanceReport,
} from '../models/staff-performance.repository';

const repository = new StaffPerformanceRepository();

export async function getStaffPerformanceReportAction(
  filter: StaffPerformanceFilter,
): Promise<Result<StaffPerformanceReport>> {
  const actor = await getAuthUser();
  if (!actor || !['hr', 'owner'].includes(actor.role)) {
    return fail({ code: 'FORBIDDEN', message: 'Only HR and the owner can view staff performance.' });
  }
  return repository.getReport(actor.id, filter);
}
