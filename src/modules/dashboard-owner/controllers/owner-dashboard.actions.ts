'use server';

import { OwnerDashboardRepository, OwnerDashboardData } from '../models/owner-dashboard.repository';
import { Result } from '@/shared/models/result';

class OwnerDashboardController {
  private repo = new OwnerDashboardRepository();

  async getDashboardSummary(): Promise<Result<OwnerDashboardData>> {
    return this.repo.getDashboardSummary();
  }

  async markSeen(itemId: string, ownerId: string): Promise<Result<{ success: boolean }>> {
    return this.repo.markReviewItemSeen(itemId, ownerId);
  }

  async markAllSeen(itemIds: string[], ownerId: string): Promise<Result<{ count: number }>> {
    return this.repo.markAllReviewItemsSeen(itemIds, ownerId);
  }
}

export async function fetchOwnerDashboardAction(): Promise<Result<OwnerDashboardData>> {
  const controller = new OwnerDashboardController();
  return controller.getDashboardSummary();
}

export async function markReviewItemSeenAction(itemId: string, ownerId: string): Promise<Result<{ success: boolean }>> {
  const controller = new OwnerDashboardController();
  return controller.markSeen(itemId, ownerId);
}

export async function markAllReviewItemsSeenAction(itemIds: string[], ownerId: string): Promise<Result<{ count: number }>> {
  const controller = new OwnerDashboardController();
  return controller.markAllSeen(itemIds, ownerId);
}
