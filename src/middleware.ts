import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

const roleForPath: Record<string, string> = {
  owner: 'owner',
  manager: 'manager',
  hr: 'hr',
  reception: 'receptionist',
  staff: 'staff',
};

const roleHome: Record<string, string> = {
  owner: '/owner', manager: '/manager', hr: '/hr', receptionist: '/reception', staff: '/staff',
};

function responseWithPerfTiming(response: NextResponse, timings: string[]) {
  const enabled = process.env.NODE_ENV !== 'production'
    || (process.env.PERF_TIMING === '1' && process.env.VERCEL_ENV !== 'production');
  if (enabled && timings.length) response.headers.set('Server-Timing', timings.join(', '));
  return response;
}

function redirectWithCookies(request: NextRequest, response: NextResponse, path: string, timings: string[]) {
  const redirected = NextResponse.redirect(new URL(path, request.url));
  response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
  return responseWithPerfTiming(redirected, timings);
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const timings: string[] = [];
  const measure = async <T,>(name: string, operation: () => PromiseLike<T>): Promise<T> => {
    const startedAt = performance.now();
    try { return await operation(); }
    finally { timings.push(`${name};dur=${Math.round(performance.now() - startedAt)}`); }
  };
  const forwardedHeaders = new Headers(request.headers);
  for (const name of [
    'x-mzuri-session-verified',
    'x-mzuri-user-id',
    'x-mzuri-user-role',
    'x-mzuri-user-email',
    'x-mzuri-user-full-name',
    'x-mzuri-user-display-name',
    'x-mzuri-must-change-pin',
  ]) {
    // Next.js only applies request-header overrides listed on the response;
    // forwarding an empty value ensures an incoming spoof is overwritten.
    forwardedHeaders.set(name, '');
  }
  const refreshedCookies = new Map<string, { name: string; value: string; options?: CookieOptions }>();
  let response = NextResponse.next({ request });
  const nextWithForwardedHeaders = () => {
    const next = NextResponse.next({ request: { headers: forwardedHeaders } });
    refreshedCookies.forEach(({ name, value, options }) => next.cookies.set(name, value, options));
    response = next;
    return next;
  };
  const section = path.split('/')[1];
  const isWorkspacePath = Boolean(roleForPath[section]);
  const isNotificationApi = path === '/api/notifications' || path.startsWith('/api/notifications/');
  const isProtectedPath = isWorkspacePath || path === '/choose-pin' || path === '/attendance-gate' || path.startsWith('/api/catalogue/') || isNotificationApi;
  const isLoginAction = path === '/login' && request.method === 'POST' && request.headers.has('next-action');
  if (!isProtectedPath && !isLoginAction) {
    return responseWithPerfTiming(NextResponse.next({ request: { headers: forwardedHeaders } }), timings);
  }
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            refreshedCookies.set(name, { name, value, options });
          });
          forwardedHeaders.set('cookie', request.cookies.toString());
          nextWithForwardedHeaders();
        },
      },
    },
  );

  const authResult = await measure('auth', () => supabase.auth.getClaims());
  const claims = authResult.data?.claims;
  const userId = typeof claims?.sub === 'string' ? claims.sub : null;
  // Notification handlers preserve their JSON 401 behavior. Let the route
  // handler decide unauthenticated responses instead of redirecting an API.
  if (!userId) return isNotificationApi
    ? responseWithPerfTiming(response, timings)
    : redirectWithCookies(request, response, '/login', timings);

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return isNotificationApi
    ? responseWithPerfTiming(response, timings)
    : redirectWithCookies(request, response, '/login', timings);
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const attendanceCheck = isLoginAction || isNotificationApi
    ? Promise.resolve({ data: true, error: null })
    : measure('attendance', () => admin.rpc('is_user_clocked_in', { p_user_id: userId }));
  const [profileResult, attendanceResult] = await Promise.all([
    measure('profile', () => admin
      .from('app_user')
      .select('role, status, must_change_pin, full_name, display_name')
      .eq('id', userId)
      .maybeSingle()),
    attendanceCheck,
  ]);
  const { data: profile, error } = profileResult;
  if (error || !profile) return isNotificationApi
    ? responseWithPerfTiming(response, timings)
    : redirectWithCookies(request, response, '/login', timings);
  if (profile.status !== 'active') {
    if (isNotificationApi) return responseWithPerfTiming(response, timings);
    await supabase.auth.signOut();
    return redirectWithCookies(request, response, '/login?status=inactive', timings);
  }

  // These headers are generated only after JWT verification and active-profile
  // validation. Copies arriving from the browser were removed above.
  forwardedHeaders.set('x-mzuri-session-verified', '1');
  forwardedHeaders.set('x-mzuri-user-id', userId);
  forwardedHeaders.set('x-mzuri-user-role', String(profile.role));
  const userEmail = typeof claims?.email === 'string' ? claims.email : '';
  forwardedHeaders.set('x-mzuri-user-email', encodeURIComponent(userEmail));
  forwardedHeaders.set('x-mzuri-user-full-name', encodeURIComponent(profile.full_name || ''));
  forwardedHeaders.set('x-mzuri-user-display-name', encodeURIComponent(profile.display_name || ''));
  forwardedHeaders.set('x-mzuri-must-change-pin', profile.must_change_pin ? '1' : '0');
  nextWithForwardedHeaders();

  // Notification routes already authorize by the authenticated user's ID.
  // Reuse this validated request context, without imposing the workspace
  // attendance gate that these APIs did not have before.
  if (isNotificationApi) return responseWithPerfTiming(response, timings);

  if (profile.must_change_pin && path !== '/choose-pin' && !isLoginAction) return redirectWithCookies(request, response, '/choose-pin', timings);
  if (!profile.must_change_pin && path === '/choose-pin') return redirectWithCookies(request, response, `/${Object.keys(roleForPath).find((key) => roleForPath[key] === profile.role) || 'login'}`, timings);

  const expectedRole = roleForPath[section];
  if (expectedRole && profile.role !== expectedRole) {
    const ownSection = Object.keys(roleForPath).find((key) => roleForPath[key] === profile.role);
    return redirectWithCookies(request, response, ownSection ? `/${ownSection}` : '/login', timings);
  }

  // Attendance is the workspace gate. Owner and the explicit gate route are
  // exempt; paired device routes do not match this middleware. POSTed Server
  // Actions are rejected before they can reach service-role repositories.
  if (profile.role !== 'owner' && !isLoginAction) {
    const { data: isClockedIn, error: attendanceError } = attendanceResult;
    const isGatePage = path === '/attendance-gate';

    if ((attendanceError || !isClockedIn) && !isGatePage && request.method === 'POST' && request.headers.has('next-action')) {
      return responseWithPerfTiming(NextResponse.json({ code: 'not_clocked_in', message: 'Clock in to use the workspace.' }, { status: 403 }), timings);
    }
    if ((attendanceError || !isClockedIn) && !isGatePage) {
      const next = `${path}${request.nextUrl.search}`;
      const gate = new URL('/attendance-gate', request.url);
      if (next.startsWith(`/${Object.keys(roleForPath).find((key) => roleForPath[key] === profile.role)}/`)
        || next === roleHome[profile.role]) gate.searchParams.set('next', next);
      return redirectWithCookies(request, response, gate.toString(), timings);
    }
    if (!attendanceError && isClockedIn && isGatePage) {
      const requested = request.nextUrl.searchParams.get('next') || roleHome[profile.role];
      const section = requested.split('/')[1];
      const safeNext = roleForPath[section] === profile.role ? requested : roleHome[profile.role];
      return redirectWithCookies(request, response, safeNext, timings);
    }
  }
  return responseWithPerfTiming(response, timings);
}

export const config = {
  matcher: ['/login', '/choose-pin', '/attendance-gate', '/owner/:path*', '/manager/:path*', '/hr/:path*', '/reception/:path*', '/staff/:path*', '/api/:path*'],
};
