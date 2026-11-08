'use server';

import {
  VisitRepository,
  VisitRecord,
  QueueDisplayBoardState,
  QueueDisplayBoardItem,
} from '../models/visit.repository';
import { Result } from '@/shared/models/result';

export type { VisitRecord, QueueDisplayBoardState, QueueDisplayBoardItem };

class VisitController {
  private repo = new VisitRepository();

  async fetchQueue(): Promise<Result<VisitRecord[]>> {
    return this.repo.getLiveQueue();
  }

  async startLine(lineId: string, reason?: string): Promise<Result<{ success: boolean }>> {
    return this.repo.startLine(lineId, reason);
  }

  async finishLine(lineId: string): Promise<Result<{ success: boolean; next_line_id?: string }>> {
    return this.repo.finishLine(lineId);
  }
}

export async function getLiveQueueAction(): Promise<Result<VisitRecord[]>> {
  const controller = new VisitController();
  return controller.fetchQueue();
}

export async function getQueueDisplayBoardAction(): Promise<Result<QueueDisplayBoardState>> {
  const repo = new VisitRepository();
  return repo.getQueueDisplayBoard();
}

export async function startServiceLineAction(lineId: string, reason?: string): Promise<Result<{ success: boolean }>> {
    const controller = new VisitController();
  return controller.startLine(lineId, reason);
}

export async function finishServiceLineAction(lineId: string): Promise<Result<{ success: boolean; next_line_id?: string }>> {
    const controller = new VisitController();
  return controller.finishLine(lineId);
}


