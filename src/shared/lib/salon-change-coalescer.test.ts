import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSalonChangeCoalescer } from './salon-change-coalescer';

afterEach(() => vi.useRealTimers());

describe('salon change coalescer', () => {
  it('turns a burst of 50 events into one unique table batch', () => {
    vi.useFakeTimers();
    const onFlush = vi.fn();
    const coalescer = createSalonChangeCoalescer(onFlush);

    for (let index = 0; index < 50; index += 1) coalescer.push('visit');
    vi.advanceTimersByTime(80);

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith(['visit']);
    coalescer.dispose();
  });

  it('clears pending work when the shell unmounts', () => {
    vi.useFakeTimers();
    const onFlush = vi.fn();
    const coalescer = createSalonChangeCoalescer(onFlush);

    coalescer.push('visit');
    coalescer.dispose();
    vi.advanceTimersByTime(80);

    expect(onFlush).not.toHaveBeenCalled();
  });
});
