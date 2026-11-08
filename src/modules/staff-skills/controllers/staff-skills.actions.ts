'use server';

import { getCurrentUserAction } from '@/modules/auth';
import { StaffSkillsRepository } from '../models/staff-skills.repository';

const repo = new StaffSkillsRepository();

async function requireSkillManager() {
  const user = await getCurrentUserAction();
  if (!user || !['manager', 'hr'].includes(user.role)) throw new Error('Only managers and HR can assign staff skills.');
  return user;
}

export async function getStaffSkillsEditorAction(staffUserId: string) {
  const user = await requireSkillManager();
  const result = await repo.getEditorData(staffUserId);
  if (!result.success) return { success: false as const, error: result.error };
  return { success: true as const, data: result.data, actorRole: user.role };
}

export async function saveStaffSkillsAction(staffUserId: string, serviceIds: string[]) {
  const user = await requireSkillManager();
  return repo.saveStaffSkills(user.id, staffUserId, serviceIds);
}

export async function saveServiceStaffSkillsAction(serviceId: string, staffUserIds: string[]) {
  const user = await requireSkillManager();
  return repo.saveServiceStaffSkills(user.id, serviceId, staffUserIds);
}
