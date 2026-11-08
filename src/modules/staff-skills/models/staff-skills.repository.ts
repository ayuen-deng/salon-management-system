import { getServiceRoleClient } from '@/shared/lib/supabase';
import { Result, ok, fail } from '@/shared/models/result';

export interface StaffSkillService {
  id: string;
  name: string;
  category: string;
}

const SKILL_CATEGORIES = [
  'Haircuts', 'Hair care and treatments', 'Colour', 'Braids and styling',
  'Massage', 'Makeup', 'Nails', 'Skin and facials', 'Brows and lashes',
];

function skillCategory(value: string): string {
  const category = value.toLowerCase();
  if (category.includes('barber') || category.includes('haircut')) return 'Haircuts';
  if (category.includes('braid') || category.includes('weave') || category.includes('styling')) return 'Braids and styling';
  if (category.includes('colour') || category.includes('color')) return 'Colour';
  if (category.includes('care') || category.includes('treatment') || category.includes('chemical') || category.includes('wash')) return 'Hair care and treatments';
  if (category.includes('massage')) return 'Massage';
  if (category.includes('lash') || category.includes('brow')) return 'Brows and lashes';
  if (category.includes('makeup')) return 'Makeup';
  if (category.includes('nail') || category.includes('manicure') || category.includes('pedicure')) return 'Nails';
  if (category.includes('skin') || category.includes('facial')) return 'Skin and facials';
  return SKILL_CATEGORIES.includes(value) ? value : 'Hair care and treatments';
}

export class StaffSkillsRepository {
  private locationId = 'b0000000-0000-0000-0000-000000000001';

  async getEditorData(staffUserId: string): Promise<Result<{ services: StaffSkillService[]; selectedServiceIds: string[] }>> {
    try {
      const client = getServiceRoleClient();
      const [staffRes, servicesRes, skillsRes] = await Promise.all([
        client.from('app_user').select('id').eq('id', staffUserId).eq('role', 'staff').eq('status', 'active').eq('location_id', this.locationId).maybeSingle(),
        client.from('service').select('id, name, category').eq('location_id', this.locationId).eq('active', true).order('name'),
        client.from('staff_skill').select('service_id').eq('staff_user_id', staffUserId),
      ]);
      if (staffRes.error) return fail({ code: 'INTERNAL_ERROR', message: staffRes.error.message });
      if (!staffRes.data) return fail({ code: 'NOT_FOUND', message: 'Active staff member not found.' });
      if (servicesRes.error) return fail({ code: 'INTERNAL_ERROR', message: servicesRes.error.message });
      if (skillsRes.error) return fail({ code: 'INTERNAL_ERROR', message: skillsRes.error.message });

      return ok({
        services: (servicesRes.data || []).map((service) => ({
          id: service.id,
          name: service.name,
          category: skillCategory(service.category),
        })),
        selectedServiceIds: (skillsRes.data || []).map((skill) => skill.service_id).filter((id) => (servicesRes.data || []).some((service) => service.id === id)),
      });
    } catch (err: unknown) {
      return fail({ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Could not load staff skills.' });
    }
  }

  async saveStaffSkills(actorId: string, staffUserId: string, serviceIds: string[]): Promise<Result<{ skillCount: number }>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client.rpc('set_staff_skills', {
        p_actor_user_id: actorId,
        p_staff_user_id: staffUserId,
        p_service_ids: Array.from(new Set(serviceIds)),
      });
      if (error) return fail({ code: 'VALIDATION_ERROR', message: error.message });
      return ok({ skillCount: Number(data?.skill_count ?? serviceIds.length) });
    } catch (err: unknown) {
      return fail({ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Could not save staff skills.' });
    }
  }

  async saveServiceStaffSkills(actorId: string, serviceId: string, staffUserIds: string[]): Promise<Result<void>> {
    try {
      const client = getServiceRoleClient();
      const { error } = await client.rpc('set_service_staff_skills', {
        p_actor_user_id: actorId,
        p_service_id: serviceId,
        p_staff_user_ids: Array.from(new Set(staffUserIds)),
      });
      if (error) return fail({ code: 'VALIDATION_ERROR', message: error.message });
      return ok(undefined);
    } catch (err: unknown) {
      return fail({ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Could not update service staff.' });
    }
  }
}
