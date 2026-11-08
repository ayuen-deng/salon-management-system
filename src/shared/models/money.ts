// Uganda Shilling (UGX) is stored strictly as integer numbers. No floating point.

export type MoneyUGX = number;

export function formatUGX(amount: MoneyUGX): string {
  const formatted = Math.round(amount).toLocaleString('en-UG');
  return `UGX ${formatted}`;
}

export const formatUgx = formatUGX;

export function parseUGX(val: string | number): MoneyUGX {
  if (typeof val === 'number') return Math.max(0, Math.round(val));
  const clean = val.replace(/[^0-9]/g, '');
  return clean ? parseInt(clean, 10) : 0;
}
