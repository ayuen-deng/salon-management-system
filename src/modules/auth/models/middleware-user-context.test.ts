import { describe, expect, it } from 'vitest';
import { parseMiddlewareUserContext } from './middleware-user-context';

const trustedHeaders = () => new Headers({
  'x-mzuri-session-verified': '1',
  'x-mzuri-user-id': 'c0000000-0000-0000-0000-000000000004',
  'x-mzuri-user-role': 'receptionist',
  'x-mzuri-user-email': 'daisy%40mzuri.invalid',
  'x-mzuri-user-full-name': 'Daisy%20Ahumuza',
  'x-mzuri-user-display-name': 'Daisy%20Ahumuza',
  'x-mzuri-must-change-pin': '0',
});

describe('middleware user context', () => {
  it('accepts a complete context stamped after middleware verification', () => {
    expect(parseMiddlewareUserContext(trustedHeaders())).toEqual({
      id: 'c0000000-0000-0000-0000-000000000004',
      role: 'receptionist',
      email: 'daisy@mzuri.invalid',
      fullName: 'Daisy Ahumuza',
      displayName: 'Daisy Ahumuza',
      mustChangePin: false,
    });
  });

  it('rejects unverified, malformed, or non-application roles', () => {
    const headers = trustedHeaders();
    headers.delete('x-mzuri-session-verified');
    expect(parseMiddlewareUserContext(headers)).toBeNull();

    const invalidRole = trustedHeaders();
    invalidRole.set('x-mzuri-user-role', 'service_role');
    expect(parseMiddlewareUserContext(invalidRole)).toBeNull();

    const invalidId = trustedHeaders();
    invalidId.set('x-mzuri-user-id', 'not-a-uuid');
    expect(parseMiddlewareUserContext(invalidId)).toBeNull();
  });

  it('does not carry identity from a previous request when headers change', () => {
    const first = trustedHeaders();
    const second = trustedHeaders();
    second.set('x-mzuri-user-id', 'c0000000-0000-0000-0000-000000000005');
    expect(parseMiddlewareUserContext(first)?.id).not.toBe(parseMiddlewareUserContext(second)?.id);
  });
});
