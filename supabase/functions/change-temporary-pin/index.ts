import { admin, getActiveActor, json } from '../_shared/auth.ts';
import { hashTemporaryPin, verifyTemporaryPin } from '../_shared/pin.ts';
import { isStrongTemporaryPin } from '../../../src/shared/models/pin-rules.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: json(request, {}).headers });
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
  try {
    const { authUser, profile } = await getActiveActor(request, true);
    const body = await request.json();
    const pin = String(body.pin || '');
    const confirmation = String(body.confirmation || '');
    if (!profile.must_change_pin) return json(request, { error: 'No temporary PIN change is pending.' }, 409);
    if (pin !== confirmation) return json(request, { error: 'The PIN entries do not match.' }, 400);
    if (!isStrongTemporaryPin(pin, profile.phone)) return json(request, { error: 'Choose a PIN containing exactly six digits.' }, 400);
    if (!profile.pin_hash || await verifyTemporaryPin(pin, profile.pin_hash)) return json(request, { error: 'Choose a PIN different from your temporary PIN.' }, 400);

    const { error: authError } = await admin.auth.admin.updateUserById(authUser.id, { password: pin });
    if (authError) throw new Error('Could not change the PIN. Retry.');
    const { error: rpcError } = await admin.rpc('complete_temporary_pin_change_v1', { p_user_id: authUser.id });
    if (rpcError) throw new Error('PIN updated, but the account change could not be finalized. Sign in again and retry.');
    return json(request, { success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PIN change failed.';
    return json(request, { error: message === 'Unauthorized' ? 'Sign in again and retry.' : message }, message === 'Unauthorized' ? 401 : 400);
  }
});
