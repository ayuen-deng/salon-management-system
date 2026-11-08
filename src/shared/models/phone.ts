// Normalizes Uganda mobile numbers (07xx, 2567xx, +2567xx, spaces, dashes) to +256 format

export function normalizeUgPhone(input: string): string {
  if (!input) return '';
  const clean = input.replace(/[^0-9+]/g, '');

  if (/^07\d{8}$/.test(clean)) {
    return `+256${clean.slice(1)}`;
  }
  if (/^2567\d{8}$/.test(clean)) {
    return `+${clean}`;
  }
  if (/^\+2567\d{8}$/.test(clean)) {
    return clean;
  }
  return clean;
}

export function isValidUgPhone(input: string): boolean {
  const norm = normalizeUgPhone(input);
  return /^\+2567\d{8}$/.test(norm);
}

/**
 * Formats a phone number for neat human reading, e.g. +256 760 929 490
 */
export function formatUgPhoneDisplay(phone: string): string {
  if (!phone) return '';
  const norm = normalizeUgPhone(phone);
  if (/^\+2567\d{8}$/.test(norm)) {
    // +256 7XX XXX XXX
    return `${norm.slice(0, 4)} ${norm.slice(4, 7)} ${norm.slice(7, 10)} ${norm.slice(10)}`;
  }
  return phone;
}

