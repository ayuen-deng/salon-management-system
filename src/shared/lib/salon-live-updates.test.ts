import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchSalonDataChanged, salonChangeAffectsDependencies } from './salon-live-updates';

afterEach(() => vi.unstubAllGlobals());

describe('salon live invalidation dispatch', () => {
  it('only invalidates subscribed views for their source tables', () => {
    const dependencies = ['visit', 'visit_service'];
    expect(salonChangeAffectsDependencies({ table: '*', tables: ['customer'] }, dependencies)).toBe(false);
    expect(salonChangeAffectsDependencies({ table: '*', tables: ['visit_service', 'payment'] }, dependencies)).toBe(true);
    expect(salonChangeAffectsDependencies({ table: '*' }, dependencies)).toBe(true);
    expect(salonChangeAffectsDependencies({ table: 'customer' })).toBe(true);
  });

  it('reports when no mounted view handled a change', () => {
    vi.stubGlobal('window', new EventTarget());

    expect(dispatchSalonDataChanged({ table: 'visit' })).toBe(false);
  });

  it('reports local handling so the shell can skip a duplicate RSC refresh', () => {
    const eventTarget = new EventTarget();
    eventTarget.addEventListener('salon:data-changed', (event) => event.preventDefault());
    vi.stubGlobal('window', eventTarget);

    expect(dispatchSalonDataChanged({ table: 'visit' })).toBe(true);
  });

  it('preserves the coalesced table list for dependency-aware view handlers', () => {
    const eventTarget = new EventTarget();
    let detail: unknown;
    eventTarget.addEventListener('salon:data-changed', (event) => {
      detail = (event as CustomEvent).detail;
      event.preventDefault();
    });
    vi.stubGlobal('window', eventTarget);

    const change = { table: '*', tables: ['visit', 'visit_service'] } as const;
    expect(dispatchSalonDataChanged(change)).toBe(true);
    expect(detail).toEqual(change);
  });
});
