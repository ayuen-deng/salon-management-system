import { cache } from 'react';
import { headers } from 'next/headers';
import type { AppRole } from '@/shared/models/roles';
import type { UserSession } from './auth.repository';

const ROLE_VALUES = new Set<AppRole>(['owner', 'manager', 'hr', 'receptionist', 'staff']);

function decodeHeader(value: string | null): string {
  if (!value) return '';
  try { return decodeURIComponent(value); }
  catch { return ''; }
}

export function parseMiddlewareUserContext(requestHeaders: Headers): UserSession | null {
  if (requestHeaders.get('x-mzuri-session-verified') !== '1') return null;

  const id = requestHeaders.get('x-mzuri-user-id') || '';
  const role = requestHeaders.get('x-mzuri-user-role') as AppRole | null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !role || !ROLE_VALUES.has(role)) return null;

  return {
    id,
    role,
    email: decodeHeader(requestHeaders.get('x-mzuri-user-email')),
    fullName: decodeHeader(requestHeaders.get('x-mzuri-user-full-name')),
    displayName: decodeHeader(requestHeaders.get('x-mzuri-user-display-name')),
    mustChangePin: requestHeaders.get('x-mzuri-must-change-pin') === '1',
  };
}

/**
 * Reads only the identity stamped by middleware after verified JWT, active
 * profile, role, and attendance checks. React cache is request-scoped; it does
 * not persist user data between requests.
 */
export const getMiddlewareUserContext = cache(async (): Promise<UserSession | null> => {
  try {
    return parseMiddlewareUserContext(await headers());
  } catch {
    return null;
  }
});
