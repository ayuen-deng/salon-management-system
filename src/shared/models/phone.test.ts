import { describe, it, expect } from 'vitest';
import { normalizeUgPhone, isValidUgPhone } from './phone';

describe('Uganda Phone Normalization', () => {
  it('normalizes local 07xx numbers to +256 format', () => {
    expect(normalizeUgPhone('0772123456')).toBe('+256772123456');
    expect(normalizeUgPhone('0701-456-789')).toBe('+256701456789');
    expect(normalizeUgPhone('0782 555 123')).toBe('+256782555123');
  });

  it('handles international format numbers correctly', () => {
    expect(normalizeUgPhone('+256772123456')).toBe('+256772123456');
    expect(normalizeUgPhone('256772123456')).toBe('+256772123456');
  });

  it('validates Ugandan phone numbers', () => {
    expect(isValidUgPhone('0772123456')).toBe(true);
    expect(isValidUgPhone('+256772123456')).toBe(true);
    expect(isValidUgPhone('12345')).toBe(false);
  });
});
