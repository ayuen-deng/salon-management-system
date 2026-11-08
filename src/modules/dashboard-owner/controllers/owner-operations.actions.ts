'use server';

import {
  OwnerOperationsRepository,
  OwnerVisitSummary,
  OwnerPaymentRecord,
  OwnerWaitMetric,
  OwnerDailySummaryItem,
  OwnerAuditItem,
  OwnerCustomerProfile
} from '../models/owner-operations.repository';
import { Result } from '@/shared/models/result';
import { getAuthUser } from '@/modules/auth';

class OwnerOperationsController {
  private repo = new OwnerOperationsRepository();

  async getVisits(filter?: 'today' | 'all' | 'left' | 'unpaid'): Promise<Result<OwnerVisitSummary[]>> {
    return this.repo.getVisits(filter);
  }

  async getPayments(): Promise<Result<OwnerPaymentRecord[]>> {
    return this.repo.getPayments();
  }

  async getWaitMetrics(): Promise<Result<OwnerWaitMetric[]>> {
    return this.repo.getWaitMetrics();
  }

  async getDailySummaries(): Promise<Result<OwnerDailySummaryItem[]>> {
    return this.repo.getDailySummaries();
  }

  async getAuditLogs(category?: string): Promise<Result<OwnerAuditItem[]>> {
    return this.repo.getAuditLogs(category);
  }

  async getCustomers(query?: string): Promise<Result<OwnerCustomerProfile[]>> {
    return this.repo.getCustomers(query);
  }

  async getSettings(): ReturnType<OwnerOperationsRepository['getSettings']> {
    return this.repo.getSettings();
  }

  async updateThresholds(thresholds: any, ownerId: string): Promise<Result<{ success: boolean }>> {
    return this.repo.updateReviewThresholds(thresholds, ownerId);
  }

  async updateReceiptSettings(settings: {
    salon_name: string;
    location_name: string;
    receipt_address: string;
    receipt_phone: string;
    receipt_footer: string;
    receipt_fiscal_disclaimer_enabled: boolean;
  }, ownerId: string): Promise<Result<{ success: boolean }>> {
    return this.repo.updateReceiptSettings(settings, ownerId);
  }
}

export async function fetchOwnerVisitsAction(filter?: 'today' | 'all' | 'left' | 'unpaid'): Promise<Result<OwnerVisitSummary[]>> {
  const c = new OwnerOperationsController();
  return c.getVisits(filter);
}

export async function fetchOwnerPaymentsAction(): Promise<Result<OwnerPaymentRecord[]>> {
  const c = new OwnerOperationsController();
  return c.getPayments();
}

export async function fetchOwnerWaitsAction(): Promise<Result<OwnerWaitMetric[]>> {
  const c = new OwnerOperationsController();
  return c.getWaitMetrics();
}

export async function fetchOwnerSummariesAction(): Promise<Result<OwnerDailySummaryItem[]>> {
  const c = new OwnerOperationsController();
  return c.getDailySummaries();
}

export async function fetchOwnerAuditAction(category?: string): Promise<Result<OwnerAuditItem[]>> {
  const c = new OwnerOperationsController();
  return c.getAuditLogs(category);
}

export async function fetchOwnerCustomersAction(query?: string): Promise<Result<OwnerCustomerProfile[]>> {
  const c = new OwnerOperationsController();
  return c.getCustomers(query);
}

export async function fetchOwnerSettingsAction(): Promise<Result<{
  review_thresholds: any;
  receipt_settings: {
    salon_name: string;
    location_name: string;
    receipt_address: string;
    receipt_phone: string;
    receipt_footer: string;
    receipt_fiscal_disclaimer_enabled: boolean;
  };
  hr_appointed: boolean;
  active_hr?: {
    id: string;
    full_name: string;
    username?: string;
    phone_e164: string;
    status: string;
    created_at: string;
  } | null;
}>> {
  const c = new OwnerOperationsController();
  return c.getSettings();
}

export async function updateOwnerThresholdsAction(thresholds: any, ownerId: string): Promise<Result<{ success: boolean }>> {
  const c = new OwnerOperationsController();
  return c.updateThresholds(thresholds, ownerId);
}

export async function updateOwnerReceiptSettingsAction(settings: {
  salon_name: string;
  location_name: string;
  receipt_address: string;
  receipt_phone: string;
  receipt_footer: string;
  receipt_fiscal_disclaimer_enabled: boolean;
}): Promise<Result<{ success: boolean }>> {
  const user = await getAuthUser();
  if (!user || user.role !== 'owner') {
    return { success: false, error: { code: 'FORBIDDEN', message: 'Only the owner can update receipt settings.' } };
  }
  const c = new OwnerOperationsController();
  return c.updateReceiptSettings(settings, user.id);
}

export async function appointOrReplaceHrAction(payload: {
  fullName: string;
  phoneE164: string;
  username: string;
  pin: string;
  ownerId: string;
}): Promise<Result<{ success: boolean; hrId: string }>> {
  const repo = new OwnerOperationsRepository();
  return repo.appointOrReplaceHr(payload);
}

export async function revokeHrAction(ownerId: string): Promise<Result<{ success: boolean; revokedCount: number }>> {
  const repo = new OwnerOperationsRepository();
  return repo.revokeHr(ownerId);
}
