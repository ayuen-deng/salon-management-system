import { getServiceRoleClient } from '@/shared/lib/supabase';
import { Result, ok, fail } from '@/shared/models/result';

export interface CataloguePriceHistoryItem {
  id: string;
  changed_at: string;
  changed_by_name: string;
  changed_by_role: string;
  old_price_ugx: number;
  new_price_ugx: number;
  old_min_price_ugx?: number;
  new_min_price_ugx?: number;
  old_max_price_ugx?: number;
  new_max_price_ugx?: number;
  reason?: string;
}

export interface CatalogueVariantItem {
  id: string;
  service_id: string;
  name: string;
  list_price_ugx: number;
  min_price_ugx: number;
  max_price_ugx: number;
  expected_minutes: number;
  active: boolean;
  version: number;
  created_at: string;
  created_by_role?: string;
  is_owner_change?: boolean;
}

export interface CatalogueServiceItem {
  id: string;
  name: string;
  category: string;
  audience: 'men' | 'women' | 'both';
  subcategory?: string;
  image_url?: string;
  featured?: boolean;
  sort_order?: number;
  active: boolean;
  default_minutes: number;
  version: number;
  created_at: string;
  created_by_role?: string;
  is_owner_change?: boolean;
  assigned_staff_ids: string[];
  variants: CatalogueVariantItem[];
}

export interface CatalogueChangeItem {
  id: string;
  entity_type: 'service' | 'service_variant';
  entity_id: string;
  action: 'added' | 'edited' | 'price_changed' | 'disabled' | 'enabled';
  changed_by_name: string;
  changed_by_role: string;
  at: string;
  summary: string;
  old_data?: any;
  new_data?: any;
  seen_by_manager: boolean;
}

export interface CatalogueStaffOption {
  id: string;
  display_name: string;
  full_name: string;
  role?: string;
}

export class SharedCatalogueRepository {
  async getCatalogue(options: { kioskOnly?: boolean } = {}): Promise<Result<{ services: CatalogueServiceItem[]; staff: CatalogueStaffOption[] }>> {
    try {
      const client = getServiceRoleClient();

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const supportingQueries: any[] = options.kioskOnly
        ? [
            Promise.resolve({ data: [] }),
            Promise.resolve({ data: [] }),
            Promise.resolve({ data: [] }),
          ]
        : [
            client.from('staff_skill').select('service_id, staff_user_id'),
            client
              .from('app_user')
              .select('id, display_name, full_name, role')
              .eq('role', 'staff')
              .eq('status', 'active')
              .order('display_name', { ascending: true }),
            client
              .from('audit_log')
              .select('entity_type, entity_id, action, at')
              .eq('actor_role', 'owner')
              .eq('category', 'catalogue')
              .gte('at', sevenDaysAgo),
          ];

      // The kiosk does not use staff assignments or owner audit badges, so skip
      // those reads. Other catalogue screens need them; fetch them concurrently.
      const [servicesResult, skillsResult, staffResult, metadataResult, ownerAuditsResult] = await Promise.all([
        client
          .from('service')
          .select(`
          id, name, category, active, default_minutes, created_at,
          service_variant (
            id, service_id, name, list_price_ugx, min_price_ugx, max_price_ugx, expected_minutes, active, created_at
          )
          `)
          .order('category', { ascending: true })
          .order('name', { ascending: true }),
        supportingQueries[0],
        supportingQueries[1],
        client.from('app_setting').select('value').eq('key', 'service_metadata').maybeSingle(),
        supportingQueries[2],
      ]);

      const { data: servicesRaw, error: sErr } = servicesResult;
      const { data: skillsRaw } = skillsResult;
      const { data: staffRaw } = staffResult;
      const { data: metaSetting } = metadataResult;
      const { data: ownerAudits } = ownerAuditsResult;

      if (sErr) return fail({ code: 'INTERNAL_ERROR', message: sErr.message });

      const skillMap = new Map<string, string[]>();
      (skillsRaw || []).forEach((row: any) => {
        const arr = skillMap.get(row.service_id) || [];
        arr.push(row.staff_user_id);
        skillMap.set(row.service_id, arr);
      });

      const serviceMetaMap = (metaSetting?.value as Record<string, { image_url?: string; featured?: boolean; sort_order?: number }>) || {};

      const ownerChangesSet = new Set((ownerAudits || []).map((a: any) => `${a.entity_type}:${a.entity_id}`));

      // 6. Build structured services array
      const services: CatalogueServiceItem[] = (servicesRaw || []).map((s: any) => {
        const isServiceOwnerChange = ownerChangesSet.has(`service:${s.id}`);
        const meta = serviceMetaMap[s.id] || {};

        const variants: CatalogueVariantItem[] = (s.service_variant || [])
          .sort((a: any, b: any) => a.list_price_ugx - b.list_price_ugx)
          .map((v: any) => ({
            id: v.id,
            service_id: v.service_id,
            name: v.name,
            list_price_ugx: Number(v.list_price_ugx),
            min_price_ugx: Number(v.min_price_ugx),
            max_price_ugx: Number(v.max_price_ugx),
            expected_minutes: v.expected_minutes,
            active: v.active,
            version: 1,
            created_at: v.created_at,
            is_owner_change: ownerChangesSet.has(`service_variant:${v.id}`) || isServiceOwnerChange,
          }));

        let audience: 'men' | 'women' | 'both' = 'both';
        let rawCategory = s.category || 'General';
        let subcategory: string | undefined = undefined;

        if (rawCategory.includes('|')) {
          const parts = rawCategory.split('|');
          if (parts[0] === 'men' || parts[0] === 'women' || parts[0] === 'both') {
            audience = parts[0];
          }
          rawCategory = parts[1] || rawCategory;
          subcategory = parts[2] || undefined;
        }

        // Canonical 9 Categories mapping:
        // Haircuts, Hair care and treatments, Colour, Braids and styling, Massage, Makeup, Nails, Skin and facials, Brows and lashes
        let displayCategory = rawCategory;
        const lowerCat = rawCategory.toLowerCase();

        if (lowerCat.includes('barber') || lowerCat.includes('haircut')) {
          displayCategory = 'Haircuts';
          if (audience === 'both') audience = 'men';
        } else if (lowerCat.includes('braid') || lowerCat.includes('weave') || lowerCat.includes('styling')) {
          displayCategory = 'Braids and styling';
        } else if (lowerCat.includes('colour') || lowerCat.includes('color')) {
          displayCategory = 'Colour';
        } else if (lowerCat.includes('care') || lowerCat.includes('treatment') || lowerCat.includes('chemical') || lowerCat.includes('wash')) {
          displayCategory = 'Hair care and treatments';
        } else if (lowerCat.includes('massage')) {
          displayCategory = 'Massage';
        } else if (lowerCat.includes('lash') || lowerCat.includes('brow')) {
          displayCategory = 'Brows and lashes';
        } else if (lowerCat.includes('makeup')) {
          displayCategory = 'Makeup';
        } else if (lowerCat.includes('nail') || lowerCat.includes('manicure') || lowerCat.includes('pedicure')) {
          displayCategory = 'Nails';
        } else if (lowerCat.includes('skin') || lowerCat.includes('facial')) {
          displayCategory = 'Skin and facials';
        }

        return {
          id: s.id,
          name: s.name,
          category: displayCategory,
          audience,
          subcategory,
          image_url: meta.image_url || s.image_url || undefined,
          featured: meta.featured || false,
          sort_order: meta.sort_order ?? 10,
          active: s.active,
          default_minutes: s.default_minutes,
          version: 1,
          created_at: s.created_at,
          is_owner_change: isServiceOwnerChange,
          assigned_staff_ids: skillMap.get(s.id) || [],
          variants,
        };
      });

      // Sort services by sort_order ascending, then name
      services.sort((a, b) => {
        if ((a.sort_order ?? 10) !== (b.sort_order ?? 10)) {
          return (a.sort_order ?? 10) - (b.sort_order ?? 10);
        }
        return a.name.localeCompare(b.name);
      });

      return ok({
        services,
        staff: staffRaw || [],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch catalogue';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getRecentOwnerChanges(): Promise<Result<CatalogueChangeItem[]>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client
        .from('audit_log')
        .select(`
          id, entity_type, entity_id, action, actor_role, at, reason, before, after,
          actor:app_user(display_name)
        `)
        .eq('actor_role', 'owner')
        .eq('category', 'catalogue')
        .order('at', { ascending: false })
        .limit(10);

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      // Check review_ack for seen status
      const { data: acks } = await client.from('review_ack').select('audit_id');
      const seenIds = new Set((acks || []).map((a: any) => a.audit_id));

      const changes: CatalogueChangeItem[] = (data || []).map((row: any) => {
        let summary = `Owner performed ${row.action} on ${row.entity_type}`;
        if (row.action === 'PRICE_CHANGE') {
          summary = `Price adjusted: UGX ${row.before?.list_price_ugx?.toLocaleString() || '–'} → UGX ${row.after?.list_price_ugx?.toLocaleString() || '–'}`;
        } else if (row.action === 'SERVICE_ADDED') {
          summary = `New Service added: "${row.after?.name || 'Service'}"`;
        } else if (row.action === 'VARIANT_ADDED') {
          summary = `New Variant added: "${row.after?.name || 'Variant'}"`;
        }

        return {
          id: row.id.toString(),
          entity_type: row.entity_type as any,
          entity_id: row.entity_id,
          action: row.action as any,
          changed_by_name: (row.actor as any)?.display_name || 'Salon Owner',
          changed_by_role: row.actor_role,
          at: row.at,
          summary,
          old_data: row.before,
          new_data: row.after,
          seen_by_manager: seenIds.has(row.id),
        };
      });

      return ok(changes);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch owner changes';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async markOwnerChangesAsSeen(auditIds: number[], managerUserId: string): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      for (const id of auditIds) {
        await client.from('review_ack').upsert(
          { audit_id: id, owner_user_id: managerUserId, seen_at: new Date().toISOString() },
          { onConflict: 'audit_id' }
        );
      }
      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark changes as seen';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getPriceHistory(variantId: string): Promise<Result<CataloguePriceHistoryItem[]>> {
    try {
      const client = getServiceRoleClient();
      // Join price_history and app_user
      const { data, error } = await client
        .from('price_history')
        .select(`
          id, changed_at, old_price_ugx, new_price_ugx,
          changed_by_user:app_user(display_name, role)
        `)
        .eq('service_variant_id', variantId)
        .order('changed_at', { ascending: false });

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      // Also get matching audit_log entries to extract reason and price ranges
      const { data: auditRows } = await client
        .from('audit_log')
        .select('entity_id, before, after, reason, at, actor_role')
        .eq('entity_id', variantId)
        .eq('category', 'catalogue');

      const mapped: CataloguePriceHistoryItem[] = (data || []).map((row: any) => {
        const auditMatch = (auditRows || []).find((a: any) => Math.abs(new Date(a.at).getTime() - new Date(row.changed_at).getTime()) < 5000);

        return {
          id: row.id,
          changed_at: row.changed_at,
          changed_by_name: (row.changed_by_user as any)?.display_name || 'Authorized Staff',
          changed_by_role: (row.changed_by_user as any)?.role || 'manager',
          old_price_ugx: Number(row.old_price_ugx),
          new_price_ugx: Number(row.new_price_ugx),
          old_min_price_ugx: auditMatch?.before?.min_price_ugx ? Number(auditMatch.before.min_price_ugx) : undefined,
          new_min_price_ugx: auditMatch?.after?.min_price_ugx ? Number(auditMatch.after.min_price_ugx) : undefined,
          old_max_price_ugx: auditMatch?.before?.max_price_ugx ? Number(auditMatch.before.max_price_ugx) : undefined,
          new_max_price_ugx: auditMatch?.after?.max_price_ugx ? Number(auditMatch.after.max_price_ugx) : undefined,
          reason: auditMatch?.reason || 'Standard operational update',
        };
      });

      return ok(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch price history';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async addService(
    name: string,
    category: string,
    defaultMinutes: number,
    initialVariant: { name: string; listPrice: number; minPrice: number; maxPrice: number; minutes: number },
    userId: string,
    userRole: 'owner' | 'manager',
    options?: { imageUrl?: string; featured?: boolean; sortOrder?: number; assignedStaffIds?: string[] }
  ): Promise<Result<{ service_id: string; variant_id: string }>> {
    try {
      if (initialVariant.minPrice > initialVariant.listPrice || initialVariant.listPrice > initialVariant.maxPrice) {
        return fail({ code: 'VALIDATION_ERROR', message: 'Price violation: min_price <= list_price <= max_price required.' });
      }

      const client = getServiceRoleClient();
      const { data: bday } = await client.from('business_day').select('organization_id, location_id, id').limit(1).single();

      // Check duplicate service name
      const { data: existing } = await client.from('service').select('id').eq('name', name).maybeSingle();
      if (existing) {
        return fail({ code: 'CONFLICT', message: `Service with name "${name}" already exists.` });
      }

      // 1. Insert Service
      const { data: newService, error: sErr } = await client.from('service').insert({
        organization_id: bday?.organization_id,
        location_id: bday?.location_id,
        name,
        category,
        default_minutes: defaultMinutes,
        active: true,
      }).select().single();

      if (sErr || !newService) return fail({ code: 'INTERNAL_ERROR', message: sErr?.message || 'Could not insert service' });

      // If specific staff members were assigned, insert into staff_skill
      if (options?.assignedStaffIds && options.assignedStaffIds.length > 0) {
        const skillRows = options.assignedStaffIds.map((sid) => ({
          service_id: newService.id,
          staff_user_id: sid,
        }));
        await client.from('staff_skill').insert(skillRows);
      }

      // Save metadata if provided
      if (options?.imageUrl || options?.featured !== undefined || options?.sortOrder !== undefined) {
        const { data: metaSetting } = await client
          .from('app_setting')
          .select('value')
          .eq('key', 'service_metadata')
          .maybeSingle();

        const metaMap = (metaSetting?.value as Record<string, any>) || {};
        metaMap[newService.id] = {
          image_url: options.imageUrl,
          featured: options.featured || false,
          sort_order: options.sortOrder ?? 10,
        };

        if (metaSetting) {
          await client.from('app_setting').update({ value: metaMap }).eq('key', 'service_metadata');
        } else {
          await client.from('app_setting').insert({ key: 'service_metadata', value: metaMap });
        }
      }

      // 2. Insert Variant
      const { data: newVariant, error: vErr } = await client.from('service_variant').insert({
        service_id: newService.id,
        name: initialVariant.name,
        list_price_ugx: initialVariant.listPrice,
        min_price_ugx: initialVariant.minPrice,
        max_price_ugx: initialVariant.maxPrice,
        expected_minutes: initialVariant.minutes,
        active: true,
      }).select().single();

      if (vErr || !newVariant) return fail({ code: 'INTERNAL_ERROR', message: vErr?.message || 'Could not insert variant' });

      // 3. Write Initial Price History
      await client.from('price_history').insert({
        service_variant_id: newVariant.id,
        old_price_ugx: initialVariant.listPrice,
        new_price_ugx: initialVariant.listPrice,
        changed_by: userId,
      });

      // 4. Audit Log
      await client.from('audit_log').insert({
        actor_id: userId,
        actor_role: userRole,
        action: 'SERVICE_ADDED',
        entity_type: 'service',
        entity_id: newService.id,
        category: 'catalogue',
        business_day_id: bday?.id,
        after: {
          name,
          category,
          default_minutes: defaultMinutes,
          variant: initialVariant,
        },
      });

      return ok({ service_id: newService.id, variant_id: newVariant.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add service';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async updateServiceMetadata(
    serviceId: string,
    updates: { imageUrl?: string; featured?: boolean; sortOrder?: number },
    userId: string,
    userRole: 'owner' | 'manager'
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: bday } = await client.from('business_day').select('id').limit(1).single();

      const { data: metaSetting } = await client
        .from('app_setting')
        .select('value')
        .eq('key', 'service_metadata')
        .maybeSingle();

      const metaMap = (metaSetting?.value as Record<string, any>) || {};
      const prev = metaMap[serviceId] || {};
      metaMap[serviceId] = {
        ...prev,
        ...(updates.imageUrl !== undefined ? { image_url: updates.imageUrl } : {}),
        ...(updates.featured !== undefined ? { featured: updates.featured } : {}),
        ...(updates.sortOrder !== undefined ? { sort_order: updates.sortOrder } : {}),
      };

      if (metaSetting) {
        await client.from('app_setting').update({ value: metaMap }).eq('key', 'service_metadata');
      } else {
        await client.from('app_setting').insert({ key: 'service_metadata', value: metaMap });
      }

      await client.from('audit_log').insert({
        actor_id: userId,
        actor_role: userRole,
        action: 'SERVICE_METADATA_UPDATED',
        entity_type: 'service',
        entity_id: serviceId,
        category: 'catalogue',
        business_day_id: bday?.id,
        before: prev,
        after: metaMap[serviceId],
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update service metadata';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getCanonicalCategories(): Promise<Result<Array<{ name: string; icon: string; sort_order: number }>>> {
    try {
      const client = getServiceRoleClient();
      const { data: setting } = await client
        .from('app_setting')
        .select('value')
        .eq('key', 'canonical_categories')
        .maybeSingle();

      const defaults = [
        { name: 'Haircuts', icon: 'Scissors', sort_order: 1 },
        { name: 'Hair care and treatments', icon: 'Sparkles', sort_order: 2 },
        { name: 'Colour', icon: 'Palette', sort_order: 3 },
        { name: 'Braids and styling', icon: 'Crown', sort_order: 4 },
        { name: 'Massage', icon: 'Heart', sort_order: 5 },
        { name: 'Makeup', icon: 'Smile', sort_order: 6 },
        { name: 'Nails', icon: 'Hand', sort_order: 7 },
        { name: 'Skin and facials', icon: 'Sun', sort_order: 8 },
        { name: 'Brows and lashes', icon: 'Eye', sort_order: 9 },
      ];

      return ok((setting?.value as any[]) || defaults);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get categories';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async updateCanonicalCategories(
    categories: Array<{ name: string; icon: string; sort_order: number }>,
    userId: string,
    userRole: 'owner' | 'manager'
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data: bday } = await client.from('business_day').select('id').limit(1).single();

      const { data: setting } = await client
        .from('app_setting')
        .select('value')
        .eq('key', 'canonical_categories')
        .maybeSingle();

      if (setting) {
        await client.from('app_setting').update({ value: categories }).eq('key', 'canonical_categories');
      } else {
        await client.from('app_setting').insert({ key: 'canonical_categories', value: categories });
      }

      await client.from('audit_log').insert({
        actor_id: userId,
        actor_role: userRole,
        action: 'CATEGORIES_UPDATED',
        entity_type: 'service_category',
        entity_id: 'canonical',
        category: 'catalogue',
        business_day_id: bday?.id,
        before: setting?.value || null,
        after: categories,
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update categories';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async addVariant(
    serviceId: string,
    name: string,
    listPrice: number,
    minPrice: number,
    maxPrice: number,
    expectedMinutes: number,
    userId: string,
    userRole: 'owner' | 'manager'
  ): Promise<Result<{ variant_id: string }>> {
    try {
      if (minPrice > listPrice || listPrice > maxPrice) {
        return fail({ code: 'VALIDATION_ERROR', message: 'Price violation: min_price <= list_price <= max_price required.' });
      }

      const client = getServiceRoleClient();
      const { data: bday } = await client.from('business_day').select('id').limit(1).single();

      // Check duplicate variant name within service
      const { data: existing } = await client
        .from('service_variant')
        .select('id')
        .eq('service_id', serviceId)
        .eq('name', name)
        .maybeSingle();

      if (existing) {
        return fail({ code: 'CONFLICT', message: `Variant with name "${name}" already exists for this service.` });
      }

      const { data: newVariant, error } = await client.from('service_variant').insert({
        service_id: serviceId,
        name,
        list_price_ugx: listPrice,
        min_price_ugx: minPrice,
        max_price_ugx: maxPrice,
        expected_minutes: expectedMinutes,
        active: true,
      }).select().single();

      if (error || !newVariant) return fail({ code: 'INTERNAL_ERROR', message: error?.message || 'Could not insert variant' });

      // Initial Price History
      await client.from('price_history').insert({
        service_variant_id: newVariant.id,
        old_price_ugx: listPrice,
        new_price_ugx: listPrice,
        changed_by: userId,
      });

      // Audit Log
      await client.from('audit_log').insert({
        actor_id: userId,
        actor_role: userRole,
        action: 'VARIANT_ADDED',
        entity_type: 'service_variant',
        entity_id: newVariant.id,
        category: 'catalogue',
        business_day_id: bday?.id,
        after: { service_id: serviceId, name, list_price_ugx: listPrice, min_price_ugx: minPrice, max_price_ugx: maxPrice },
      });

      return ok({ variant_id: newVariant.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add variant';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async updatePrice(
    variantId: string,
    newListPrice: number,
    newMinPrice: number,
    newMaxPrice: number,
    reason: string,
    userId: string,
    userRole: 'owner' | 'manager'
  ): Promise<Result<{ success: boolean }>> {
    try {
      if (!reason || reason.trim().length === 0) {
        return fail({ code: 'VALIDATION_ERROR', message: 'A valid reason is required for price adjustments.' });
      }

      if (newMinPrice > newListPrice || newListPrice > newMaxPrice) {
        return fail({ code: 'VALIDATION_ERROR', message: 'Price violation: min_price <= list_price <= max_price required.' });
      }

      const client = getServiceRoleClient();
      const { data: v } = await client.from('service_variant').select('*').eq('id', variantId).single();
      if (!v) return fail({ code: 'NOT_FOUND', message: 'Variant not found' });

      const { data: bday } = await client.from('business_day').select('id').limit(1).single();

      // Record price history
      await client.from('price_history').insert({
        service_variant_id: variantId,
        old_price_ugx: v.list_price_ugx,
        new_price_ugx: newListPrice,
        changed_by: userId,
      });

      // Update variant
      await client.from('service_variant').update({
        list_price_ugx: newListPrice,
        min_price_ugx: newMinPrice,
        max_price_ugx: newMaxPrice,
      }).eq('id', variantId);

      // Audit row
      await client.from('audit_log').insert({
        actor_id: userId,
        actor_role: userRole,
        action: 'PRICE_CHANGE',
        entity_type: 'service_variant',
        entity_id: variantId,
        category: 'catalogue',
        reason,
        business_day_id: bday?.id,
        before: { list_price_ugx: v.list_price_ugx, min_price_ugx: v.min_price_ugx, max_price_ugx: v.max_price_ugx },
        after: { list_price_ugx: newListPrice, min_price_ugx: newMinPrice, max_price_ugx: newMaxPrice },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update price';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async toggleActive(
    entityType: 'service' | 'service_variant',
    entityId: string,
    newActiveState: boolean,
    userId: string,
    userRole: 'owner' | 'manager'
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const table = entityType === 'service' ? 'service' : 'service_variant';
      const { data: prev } = await client.from(table).select('*').eq('id', entityId).single();
      if (!prev) return fail({ code: 'NOT_FOUND', message: `${entityType} not found` });

      const { data: bday } = await client.from('business_day').select('id').limit(1).single();

      await client.from(table).update({ active: newActiveState }).eq('id', entityId);

      await client.from('audit_log').insert({
        actor_id: userId,
        actor_role: userRole,
        action: newActiveState ? 'ENABLED' : 'DISABLED',
        entity_type: entityType,
        entity_id: entityId,
        category: 'catalogue',
        business_day_id: bday?.id,
        before: { active: prev.active },
        after: { active: newActiveState },
      });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to toggle active state';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async updateStaffSkills(
    serviceId: string,
    staffUserIds: string[],
    userId: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { error } = await client.rpc('set_service_staff_skills', {
        p_actor_user_id: userId,
        p_service_id: serviceId,
        p_staff_user_ids: Array.from(new Set(staffUserIds)),
      });
      if (error) return fail({ code: 'VALIDATION_ERROR', message: error.message });

      return ok({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update staff skills';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async importCsv(
    csvContent: string,
    userId: string,
    userRole: 'owner' | 'manager'
  ): Promise<Result<{ importedCount: number; errors: string[] }>> {
    try {
      const client = getServiceRoleClient();
      const { data: bday } = await client.from('business_day').select('organization_id, location_id, id').limit(1).single();

      const lines = csvContent.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        return fail({ code: 'VALIDATION_ERROR', message: 'CSV file is empty or missing headers.' });
      }

      const records = lines.slice(1);
      let importedCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < records.length; i++) {
        const line = records[i];
        const parts = line.split(',').map(s => s.trim());
        if (parts.length < 7) {
          errors.push(`Row ${i + 2}: Insufficient columns`);
          continue;
        }

        const [category, serviceName, variantName, priceStr, minPriceStr, maxPriceStr, minutesStr] = parts;
        const price = parseInt(priceStr, 10);
        const minPrice = parseInt(minPriceStr, 10);
        const maxPrice = parseInt(maxPriceStr, 10);
        const minutes = parseInt(minutesStr, 10);

        if (isNaN(price) || isNaN(minPrice) || isNaN(maxPrice) || isNaN(minutes)) {
          errors.push(`Row ${i + 2}: Numeric price or duration values required`);
          continue;
        }

        if (minPrice > price || price > maxPrice) {
          errors.push(`Row ${i + 2} (${variantName}): Min price <= List price <= Max price constraint violated`);
          continue;
        }

        // Get or create Service
        let { data: service } = await client
          .from('service')
          .select('id')
          .eq('name', serviceName)
          .maybeSingle();

        if (!service) {
          const { data: newS, error: sErr } = await client
            .from('service')
            .insert({
              organization_id: bday?.organization_id,
              location_id: bday?.location_id,
              name: serviceName,
              category,
              default_minutes: minutes,
              active: true,
            })
            .select('id')
            .single();

          if (sErr) {
            errors.push(`Row ${i + 2}: Failed to create service ${serviceName}`);
            continue;
          }
          service = newS;
        }

        // Get or create Variant
        let { data: variant } = await client
          .from('service_variant')
          .select('id, list_price_ugx, min_price_ugx, max_price_ugx')
          .eq('service_id', service?.id)
          .eq('name', variantName)
          .maybeSingle();

        if (variant) {
          // If price changed, update and write history
          if (variant.list_price_ugx !== price || variant.min_price_ugx !== minPrice || variant.max_price_ugx !== maxPrice) {
            await client.from('price_history').insert({
              service_variant_id: variant.id,
              old_price_ugx: variant.list_price_ugx,
              new_price_ugx: price,
              changed_by: userId,
            });

            await client.from('service_variant').update({
              list_price_ugx: price,
              min_price_ugx: minPrice,
              max_price_ugx: maxPrice,
              expected_minutes: minutes,
            }).eq('id', variant.id);

            await client.from('audit_log').insert({
              actor_id: userId,
              actor_role: userRole,
              action: 'PRICE_CHANGE',
              entity_type: 'service_variant',
              entity_id: variant.id,
              category: 'catalogue',
              reason: 'Bulk CSV price catalog update',
              business_day_id: bday?.id,
              before: { list_price_ugx: variant.list_price_ugx, min_price_ugx: variant.min_price_ugx, max_price_ugx: variant.max_price_ugx },
              after: { list_price_ugx: price, min_price_ugx: minPrice, max_price_ugx: maxPrice },
            });
          }
        } else {
          // Create new variant
          const { data: newV } = await client.from('service_variant').insert({
            service_id: service?.id,
            name: variantName,
            list_price_ugx: price,
            min_price_ugx: minPrice,
            max_price_ugx: maxPrice,
            expected_minutes: minutes,
            active: true,
          }).select('id').single();

          if (newV) {
            await client.from('price_history').insert({
              service_variant_id: newV.id,
              old_price_ugx: price,
              new_price_ugx: price,
              changed_by: userId,
            });
          }
        }

        importedCount++;
      }

      return ok({ importedCount, errors });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to import CSV';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }
}
