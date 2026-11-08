import { describe, it, expect } from 'vitest';
import { normalizeCustomerName } from './normalize-name';

describe('normalizeCustomerName', () => {
  it('capitalizes simple names', () => {
    expect(normalizeCustomerName('ayuen')).toBe('Ayuen');
    expect(normalizeCustomerName('  AYUEN ')).toBe('Ayuen');
    expect(normalizeCustomerName('joan')).toBe('Joan');
  });

  it('handles apostrophe names', () => {
    expect(normalizeCustomerName("o'brien")).toBe("O'Brien");
    expect(normalizeCustomerName("d'angelo")).toBe("D'Angelo");
  });

  it('handles hyphenated names', () => {
    expect(normalizeCustomerName('mary-jane')).toBe('Mary-Jane');
    expect(normalizeCustomerName('jean-claude')).toBe('Jean-Claude');
  });

  it('handles multi-word full names', () => {
    expect(normalizeCustomerName('ayuen deng')).toBe('Ayuen Deng');
    expect(normalizeCustomerName('  alvin   smith  ')).toBe('Alvin Smith');
  });

  it('handles empty or null inputs', () => {
    expect(normalizeCustomerName('')).toBe('');
    expect(normalizeCustomerName(null)).toBe('');
    expect(normalizeCustomerName(undefined)).toBe('');
  });
});
