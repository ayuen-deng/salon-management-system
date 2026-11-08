import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function getActiveActor(request: Request, allowPendingPinChange = false) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Unauthorized');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error('Unauthorized');
  const { data: profile, error: profileError } = await admin
    .from('app_user')
    .select('id, role, status, location_id, phone, full_name, must_change_pin, pin_hash')
    .eq('id', data.user.id)
    .single();
  if (profileError || !profile || profile.status !== 'active') throw new Error('Unauthorized');
  if (profile.must_change_pin && !allowPendingPinChange) throw new Error('Change your temporary PIN before continuing.');
  return { authUser: data.user, profile };
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin');
  const allowed = Deno.env.get('APP_URL') || Deno.env.get('NEXT_PUBLIC_APP_URL');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (origin && (!allowed || origin === allowed)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  });
}
