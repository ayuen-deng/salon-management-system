import { admin, getActiveActor, json } from '../_shared/auth.ts';
import { generateTemporaryPin, hashTemporaryPin } from '../_shared/pin.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: json(request, {}).headers });
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
  try {
    const { profile: actor } = await getActiveActor(request);
    if (!['hr', 'manager'].includes(actor.role)) return json(request, { error: 'Not authorized to reset PINs.' }, 403);
    const body = await request.json();
    const userId = String(body.userId || '');
    const { data: target, error: targetError } = await admin
      .from('app_user')
      .select('id, role, phone, full_name, status, pin_hash, must_change_pin')
      .eq('id', userId)
      .single();
    if (targetError || !target || target.status !== 'active') return json(request, { error: 'Active account not found.' }, 404);
    const allowed = actor.role === 'hr'
      ? ['staff', 'receptionist', 'manager'].includes(target.role)
      : ['staff', 'receptionist'].includes(target.role);
    if (!allowed) return json(request, { error: 'This role cannot reset that account PIN.' }, 403);

    const pin = generateTemporaryPin(target.phone);
    const pinHash = await hashTemporaryPin(pin);
    const { error: rpcError } = await admin.rpc('set_temporary_pin_v1', {
      p_actor_id: actor.id,
      p_user_id: target.id,
      p_pin_hash: pinHash,
    });
    if (rpcError) throw new Error('Could not update the temporary PIN state.');

    const { error: authError } = await admin.auth.admin.updateUserById(target.id, { password: pin });
    if (authError) {
      await admin.from('app_user').update({ pin_hash: target.pin_hash, must_change_pin: target.must_change_pin }).eq('id', target.id);
      throw new Error('Could not reset the PIN. The account password was not changed.');
    }
    return json(request, { newPin: pin, userName: target.full_name });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PIN reset failed.';
    return json(request, { error: message === 'Unauthorized' ? 'Sign in again and retry.' : message }, message === 'Unauthorized' ? 401 : 400);
  }
});
