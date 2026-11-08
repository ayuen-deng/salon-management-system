import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchSalonDataChanged } from './salon-live-updates';

afterEach(() => vi.unstubAllGlobals());

describe('salon live invalidation dispatch', () => {
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
});
