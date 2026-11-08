import { describe, it, expect } from 'vitest';
import { formatUGX, parseUGX } from './money';

describe('UGX Money Utility', () => {
  it('formats integer UGX into local currency display', () => {
    expect(formatUGX(5000)).toBe('UGX 5,000');
    expect(formatUGX(100000)).toBe('UGX 100,000');
    expect(formatUGX(0)).toBe('UGX 0');
  });

  it('parses formatted input string into clean integer UGX', () => {
    expect(parseUGX('UGX 25,000')).toBe(25000);
    expect(parseUGX(' 95000 ')).toBe(95000);
    expect(parseUGX('invalid')).toBe(0);
  });
});
