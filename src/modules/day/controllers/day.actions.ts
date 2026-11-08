'use server';

import { DayRepository, BusinessDayState, DayHistoryRecord } from '../models/day.repository';
import { Result } from '@/shared/models/result';
import { getAuthUser } from '@/modules/auth';

class DayController {
  private repo = new DayRepository();

  async getDayStatus(): Promise<Result<BusinessDayState | null>> {
    return this.repo.getActiveDay();
  }

  async getTodayStatus(): Promise<Result<BusinessDayState | null>> {
    return this.repo.getTodayDay();
  }

  async getOlderOpenDay(): Promise<Result<BusinessDayState | null>> {
    return this.repo.getOlderOpenDay();
  }

  async openSalonDay(
    locationId: string,
    cashFloat: number,
    backdateTime?: string,
    reason?: string
  ): Promise<Result<{ business_day_id: string }>> {
    const authUser = await getAuthUser();
    return this.repo.openDay(locationId, cashFloat, authUser?.id, backdateTime, reason);
  }

  async getDayHistory(limit: number = 10): Promise<Result<DayHistoryRecord[]>> {
    return this.repo.getRecentDays(limit);
  }
}

export async function getActiveDayAction(): Promise<Result<BusinessDayState | null>> {
  const controller = new DayController();
  return controller.getDayStatus();
}

export async function getTodayDayAction(): Promise<Result<BusinessDayState | null>> {
  const controller = new DayController();
  return controller.getTodayStatus();
}

export async function getOlderOpenDayAction(): Promise<Result<BusinessDayState | null>> {
  const controller = new DayController();
  return controller.getOlderOpenDay();
}

export async function openDayAction(
  locationId: string,
  cashFloat: number,
  backdateTime?: string,
  reason?: string
): Promise<Result<{ business_day_id: string }>> {
  const controller = new DayController();
  return controller.openSalonDay(locationId, cashFloat, backdateTime, reason);
}

export async function getDayHistoryAction(limit: number = 10): Promise<Result<DayHistoryRecord[]>> {
  const controller = new DayController();
  return controller.getDayHistory(limit);
}
