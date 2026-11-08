import { describe, expect, it } from 'vitest';
import { isStrongTemporaryPin, validateStaffUsername } from './pin-rules';

describe('staff credentials rules', () => {
  it('normalizes and validates usernames', () => {
    expect(validateStaffUsername('  Sarah_2 ')).toBe('sarah_2');
    expect(validateStaffUsername('ab')).toBeNull();
    expect(validateStaffUsername('a'.repeat(21))).toBeNull();
    expect(validateStaffUsername('staff-name')).toBeNull();
  });

  it('accepts any six-digit PIN', () => {
    expect(isStrongTemporaryPin('846291', '+256772123456')).toBe(true);
    expect(isStrongTemporaryPin('111111', '+256772000001')).toBe(true);
    expect(isStrongTemporaryPin('123456', '+256772123456')).toBe(true);
    expect(isStrongTemporaryPin('000001', '+256772000001')).toBe(true);
  });

  it('rejects malformed PINs and reuse of the temporary PIN', () => {
    expect(isStrongTemporaryPin('12345', '+256772000001')).toBe(false);
    expect(isStrongTemporaryPin('1234567', '+256772000001')).toBe(false);
    expect(isStrongTemporaryPin('12a456', '+256772000001')).toBe(false);
    expect(isStrongTemporaryPin('846291', '+256772123456', '846291')).toBe(false);
  });
});
