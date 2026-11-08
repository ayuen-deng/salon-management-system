import { afterEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ client: null as any }));

vi.mock('@/shared/lib/supabase', () => ({
  getServiceRoleClient: () => mocked.client,
}));

import { SharedCatalogueRepository } from './catalogue.repository';

describe('SharedCatalogueRepository.getCatalogue', () => {
  afterEach(() => {
    mocked.client = null;
    vi.restoreAllMocks();
  });

  it('fetches independent catalogue inputs concurrently and preserves the assembled result', async () => {
    let activeQueries = 0;
    let maxConcurrentQueries = 0;
    const tablesStarted: string[] = [];
    const dataByTable: Record<string, unknown> = {
      service: [{
        id: 'service-1',
        name: 'Standard cut',
        category: 'barber',
        active: true,
        default_minutes: 30,
        created_at: '2026-11-01T08:00:00.000Z',
        service_variant: [{
          id: 'variant-1',
          service_id: 'service-1',
          name: 'Standard',
          list_price_ugx: 10000,
          min_price_ugx: 10000,
          max_price_ugx: 10000,
          expected_minutes: 30,
          active: true,
          created_at: '2026-11-01T08:00:00.000Z',
        }],
      }],
      staff_skill: [{ service_id: 'service-1', staff_user_id: 'staff-1' }],
      app_user: [{ id: 'staff-1', display_name: 'Aisha', full_name: 'Aisha Doe', role: 'staff' }],
      app_setting: { value: { 'service-1': { featured: true, sort_order: 1 } } },
      audit_log: [{ entity_type: 'service', entity_id: 'service-1', action: 'SERVICE_ADDED', at: '2026-11-07T08:00:00.000Z' }],
    };

    mocked.client = {
      from(table: string) {
        const query: Record<string, any> = {};
        for (const method of ['select', 'order', 'eq', 'gte']) {
          query[method] = () => query;
        }
        query.maybeSingle = () => query;
        query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
          tablesStarted.push(table);
          activeQueries += 1;
          maxConcurrentQueries = Math.max(maxConcurrentQueries, activeQueries);
          return new Promise((done) => setTimeout(() => {
            activeQueries -= 1;
            done({ data: dataByTable[table], error: null });
          }, 20)).then(resolve, reject);
        };
        return query;
      },
    };

    const result = await new SharedCatalogueRepository().getCatalogue();

    expect(tablesStarted.sort()).toEqual(['app_setting', 'app_user', 'audit_log', 'service', 'staff_skill']);
    expect(maxConcurrentQueries).toBe(5);
    expect(result).toEqual({
      success: true,
      data: {
        services: [{
          id: 'service-1',
          name: 'Standard cut',
          category: 'Haircuts',
          audience: 'men',
          subcategory: undefined,
          image_url: undefined,
          featured: true,
          sort_order: 1,
          active: true,
          default_minutes: 30,
          version: 1,
          created_at: '2026-11-01T08:00:00.000Z',
          is_owner_change: true,
          assigned_staff_ids: ['staff-1'],
          variants: [{
            id: 'variant-1',
            service_id: 'service-1',
            name: 'Standard',
            list_price_ugx: 10000,
            min_price_ugx: 10000,
            max_price_ugx: 10000,
            expected_minutes: 30,
            active: true,
            version: 1,
            created_at: '2026-11-01T08:00:00.000Z',
            is_owner_change: true,
          }],
        }],
        staff: dataByTable.app_user,
      },
    });
  });

  it('skips staff and audit reads for the kiosk catalogue', async () => {
    const requestedTables: string[] = [];
    const dataByTable: Record<string, unknown> = { service: [], app_setting: { value: {} } };
    mocked.client = {
      from(table: string) {
        const query: Record<string, any> = {};
        for (const method of ['select', 'order', 'eq', 'gte', 'maybeSingle']) query[method] = () => query;
        query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
          requestedTables.push(table);
          return Promise.resolve({ data: dataByTable[table], error: null }).then(resolve, reject);
        };
        return query;
      },
    };

    const result = await new SharedCatalogueRepository().getCatalogue({ kioskOnly: true });

    expect(requestedTables.sort()).toEqual(['app_setting', 'service']);
    expect(result).toEqual({ success: true, data: { services: [], staff: [] } });
  });
});
