import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { claims, profile, attendanceResult, profileRow, client } = vi.hoisted(() => {
  const state = {
    claims: vi.fn(),
    profile: vi.fn(),
    attendanceResult: vi.fn(),
    profileRow: { role: 'manager', status: 'active', must_change_pin: false, full_name: 'Moya Derrick', display_name: 'Moya' },
    client: {
      from: vi.fn(),
      rpc: vi.fn(),
    },
  };
  return state;
});

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getClaims: claims, signOut: vi.fn() } }),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: () => client }));

import { middleware } from './middleware';

function nextRequest(path: string, method = 'GET', headers?: Record<string, string>) {
  return new NextRequest(`https://salon.test${path}`, { method, headers });
}

function forwardedHeader(response: Response, name: string) {
  return response.headers.get(`x-middleware-request-${name}`);
}

describe('identity middleware context', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://salon.test';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
    claims.mockResolvedValue({ data: { claims: { sub: 'c0000000-0000-0000-0000-000000000004', email: 'moya@example.invalid' } }, error: null });
    profile.mockResolvedValue({ data: profileRow, error: null });
    attendanceResult.mockResolvedValue({ data: true, error: null });
    profileRow.must_change_pin = false;
    const query = { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: profile })) })) };
    client.from.mockReturnValue(query);
    client.rpc.mockImplementation(attendanceResult);
    claims.mockClear();
    client.from.mockClear();
    client.rpc.mockClear();
  });

  it('stamps only validated claims and profile values for protected pages', async () => {
    const response = await middleware(nextRequest('/manager', 'GET', {
      'x-mzuri-session-verified': '1',
      'x-mzuri-user-id': 'attacker-controlled',
    }));

    expect(response.status).toBe(200);
    expect(claims).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(forwardedHeader(response, 'x-mzuri-session-verified')).toBe('1');
    expect(forwardedHeader(response, 'x-mzuri-user-id')).toBe('c0000000-0000-0000-0000-000000000004');
    expect(forwardedHeader(response, 'x-mzuri-user-role')).toBe('manager');
    expect(forwardedHeader(response, 'x-mzuri-user-display-name')).toBe('Moya');
  });

  it('strips forged identity headers on API requests outside the protected workspace', async () => {
    const response = await middleware(nextRequest('/api/other', 'GET', {
      'x-mzuri-session-verified': '1',
      'x-mzuri-user-id': 'attacker-controlled',
      'x-mzuri-user-role': 'owner',
    }));

    expect(response.status).toBe(200);
    expect(forwardedHeader(response, 'x-mzuri-session-verified')).toBe('');
    expect(forwardedHeader(response, 'x-mzuri-user-id')).toBe('');
    expect(claims).not.toHaveBeenCalled();
  });

  it('stamps validated identity for notification APIs without applying the attendance gate', async () => {
    const response = await middleware(nextRequest('/api/notifications', 'GET'));

    expect(response.status).toBe(200);
    expect(claims).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(client.rpc).not.toHaveBeenCalled();
    expect(forwardedHeader(response, 'x-mzuri-session-verified')).toBe('1');
    expect(forwardedHeader(response, 'x-mzuri-user-id')).toBe('c0000000-0000-0000-0000-000000000004');
  });

  it('still blocks server actions when attendance is absent', async () => {
    attendanceResult.mockResolvedValue({ data: false, error: null });
    const response = await middleware(nextRequest('/manager', 'POST', { 'next-action': 'action-id' }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'not_clocked_in' });
  });

  it('returns verified identity to the login flow without applying the workspace attendance gate', async () => {
    profileRow.must_change_pin = true;
    const response = await middleware(nextRequest('/login', 'POST', { 'next-action': 'current-user-action' }));
    expect(response.status).toBe(200);
    expect(forwardedHeader(response, 'x-mzuri-session-verified')).toBe('1');
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
