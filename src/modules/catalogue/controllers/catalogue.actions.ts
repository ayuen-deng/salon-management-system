'use server';

import {
  SharedCatalogueRepository,
  CatalogueServiceItem,
  CatalogueVariantItem,
  CataloguePriceHistoryItem,
  CatalogueChangeItem,
  CatalogueStaffOption,
} from '../models/catalogue.repository';
import { getAuthUser } from '@/modules/auth';

const catalogueRepo = new SharedCatalogueRepository();

export type {
  CatalogueServiceItem,
  CatalogueVariantItem,
  CataloguePriceHistoryItem,
  CatalogueChangeItem,
  CatalogueStaffOption,
};

// Aliases for compatibility with legacy consumers (reception, desk tablet)
export type ServiceItem = CatalogueServiceItem;
export type ServiceVariant = CatalogueVariantItem;

export async function getCatalogueAction() {
  const res = await catalogueRepo.getCatalogue();
  if (!res.success) return { success: false, error: res.error.message, data: { services: [], staff: [] } };
  return { success: true, data: res.data };
}

export async function fetchCatalogueAction(): Promise<{ success: boolean; data: ServiceItem[] }> {
  const res = await catalogueRepo.getCatalogue();
  if (!res.success) return { success: false, data: [] };
  return { success: true, data: res.data.services };
}

export async function fetchKioskCatalogueAction(): Promise<{ success: boolean; data: ServiceItem[] }> {
  const res = await catalogueRepo.getCatalogue({ kioskOnly: true });
  if (!res.success) return { success: false, data: [] };
  return { success: true, data: res.data.services };
}

export async function getRecentOwnerChangesAction() {
  const res = await catalogueRepo.getRecentOwnerChanges();
  if (!res.success) return { success: false, error: res.error.message, data: [] };
  return { success: true, data: res.data };
}

export async function markOwnerChangesAsSeenAction(auditIds: number[]) {
  const authUser = await getAuthUser();
  const managerId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';
  const res = await catalogueRepo.markOwnerChangesAsSeen(auditIds, managerId);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function getPriceHistoryAction(variantId: string) {
  const res = await catalogueRepo.getPriceHistory(variantId);
  if (!res.success) return { success: false, error: res.error.message, data: [] };
  return { success: true, data: res.data };
}

export async function addServiceAction(
  name: string,
  category: string,
  defaultMinutes: number,
  initialVariant: { name: string; listPrice: number; minPrice: number; maxPrice: number; minutes: number },
  options?: { imageUrl?: string; featured?: boolean; sortOrder?: number; assignedStaffIds?: string[] }
) {
  const authUser = await getAuthUser();
  const userRole = (authUser?.role === 'owner' ? 'owner' : 'manager') as 'owner' | 'manager';
  const userId = authUser?.id || (userRole === 'owner' ? 'c0000000-0000-0000-0000-000000000001' : 'c0000000-0000-0000-0000-000000000002');

  const res = await catalogueRepo.addService(name, category, defaultMinutes, initialVariant, userId, userRole, options);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true, data: res.data };
}

export async function updateServiceMetadataAction(
  serviceId: string,
  updates: { imageUrl?: string; featured?: boolean; sortOrder?: number }
) {
  const authUser = await getAuthUser();
  const userRole = (authUser?.role === 'owner' ? 'owner' : 'manager') as 'owner' | 'manager';
  const userId = authUser?.id || (userRole === 'owner' ? 'c0000000-0000-0000-0000-000000000001' : 'c0000000-0000-0000-0000-000000000002');

  const res = await catalogueRepo.updateServiceMetadata(serviceId, updates, userId, userRole);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function getCanonicalCategoriesAction() {
  const res = await catalogueRepo.getCanonicalCategories();
  if (!res.success) return { success: false, error: res.error.message, data: [] };
  return { success: true, data: res.data };
}

export async function updateCanonicalCategoriesAction(
  categories: Array<{ name: string; icon: string; sort_order: number }>
) {
  const authUser = await getAuthUser();
  const userRole = (authUser?.role === 'owner' ? 'owner' : 'manager') as 'owner' | 'manager';
  const userId = authUser?.id || (userRole === 'owner' ? 'c0000000-0000-0000-0000-000000000001' : 'c0000000-0000-0000-0000-000000000002');

  const res = await catalogueRepo.updateCanonicalCategories(categories, userId, userRole);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function addVariantAction(
  serviceId: string,
  name: string,
  listPrice: number,
  minPrice: number,
  maxPrice: number,
  expectedMinutes: number
) {
  const authUser = await getAuthUser();
  const userRole = (authUser?.role === 'owner' ? 'owner' : 'manager') as 'owner' | 'manager';
  const userId = authUser?.id || (userRole === 'owner' ? 'c0000000-0000-0000-0000-000000000001' : 'c0000000-0000-0000-0000-000000000002');

  const res = await catalogueRepo.addVariant(serviceId, name, listPrice, minPrice, maxPrice, expectedMinutes, userId, userRole);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true, data: res.data };
}

export async function updatePriceAction(
  variantId: string,
  newListPrice: number,
  newMinPrice: number,
  newMaxPrice: number,
  reason: string
) {
  const authUser = await getAuthUser();
  const userRole = (authUser?.role === 'owner' ? 'owner' : 'manager') as 'owner' | 'manager';
  const userId = authUser?.id || (userRole === 'owner' ? 'c0000000-0000-0000-0000-000000000001' : 'c0000000-0000-0000-0000-000000000002');

  const res = await catalogueRepo.updatePrice(variantId, newListPrice, newMinPrice, newMaxPrice, reason, userId, userRole);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function toggleActiveAction(entityType: 'service' | 'service_variant', entityId: string, newActiveState: boolean) {
  const authUser = await getAuthUser();
  const userRole = (authUser?.role === 'owner' ? 'owner' : 'manager') as 'owner' | 'manager';
  const userId = authUser?.id || (userRole === 'owner' ? 'c0000000-0000-0000-0000-000000000001' : 'c0000000-0000-0000-0000-000000000002');

  const res = await catalogueRepo.toggleActive(entityType, entityId, newActiveState, userId, userRole);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function updateStaffSkillsAction(serviceId: string, staffUserIds: string[]) {
  const authUser = await getAuthUser();
  const userId = authUser?.id || 'c0000000-0000-0000-0000-000000000002';

  const res = await catalogueRepo.updateStaffSkills(serviceId, staffUserIds, userId);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true };
}

export async function importCsvAction(csvContent: string) {
  const authUser = await getAuthUser();
  const userRole = (authUser?.role === 'owner' ? 'owner' : 'manager') as 'owner' | 'manager';
  const userId = authUser?.id || (userRole === 'owner' ? 'c0000000-0000-0000-0000-000000000001' : 'c0000000-0000-0000-0000-000000000002');

  const res = await catalogueRepo.importCsv(csvContent, userId, userRole);
  if (!res.success) return { success: false, error: res.error.message };
  return { success: true, data: res.data };
}
