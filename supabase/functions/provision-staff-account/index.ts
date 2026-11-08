import { admin, getActiveActor, json } from '../_shared/auth.ts';
import { generateTemporaryPin, hashTemporaryPin } from '../_shared/pin.ts';
import { isValidUgPhone, normalizeUgPhone } from '../../../src/shared/models/phone.ts';
import { isStrongTemporaryPin, validateStaffUsername } from '../../../src/shared/models/pin-rules.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: json(request, {}).headers });
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);

  let authUserId: string | null = null;
  try {
    const { profile: actor } = await getActiveActor(request);
    if (actor.role !== 'hr') return json(request, { error: 'Only HR can create staff accounts.' }, 403);

    const body = await request.json();
    const fullName = String(body.fullName || '').trim().replace(/\s+/g, ' ');
    const role = String(body.role || '');
    const username = validateStaffUsername(String(body.username || ''));
    const phone = normalizeUgPhone(String(body.phone || ''));
    const startDate = String(body.startDate || '');
    const requestedPin = String(body.pin || '').trim();

    if (fullName.length < 2 || fullName.length > 100) return json(request, { error: 'Enter the staff member’s full name.' }, 400);
    if (!['staff', 'receptionist', 'manager'].includes(role)) return json(request, { error: 'Choose Staff, Receptionist, or Manager.' }, 400);
    if (!username) return json(request, { error: 'Username must be 3–20 lowercase letters, digits, dots, or underscores.' }, 400);
    if (!phone || !isValidUgPhone(phone)) return json(request, { error: 'Enter a valid Uganda mobile number.' }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(`${startDate}T00:00:00Z`))) return json(request, { error: 'Enter a valid start date.' }, 400);
    if (requestedPin && !isStrongTemporaryPin(requestedPin, phone)) return json(request, { error: 'Temporary PIN must contain exactly six digits.' }, 400);

    const { data: activeUsers, error: phoneError } = await admin.from('app_user').select('id, phone').eq('status', 'active');
    if (phoneError) throw new Error('Could not verify phone number uniqueness.');
    if ((activeUsers || []).some((user) => normalizeUgPhone(user.phone) === phone)) return json(request, { error: 'That phone number is already assigned to an active employee.' }, 409);

    const pin = requestedPin || generateTemporaryPin(phone);
    const pinHash = await hashTemporaryPin(pin);
    const legacyAliases: Record<string, string> = {
      owner: 'owner@mzuri.salon', manager: 'manager@mzuri.salon', hr: 'hr@mzuri.salon',
      reception: 'mary@staff.mzuri.salon', mary: 'mary@staff.mzuri.salon',
      staff: 'grace@staff.mzuri.salon', grace: 'grace@staff.mzuri.salon',
      sarah: 'sarah@staff.mzuri.salon', peter: 'peter@staff.mzuri.salon', rose: 'rose@staff.mzuri.salon',
    };
    const email = legacyAliases[username] || `${username}@staff.mzuri.salon`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: { role, full_name: fullName },
    });
    if (createError || !created.user) {
      if (createError?.message.toLowerCase().includes('already')) return json(request, { error: 'That username is already in use.' }, 409);
      throw new Error('Could not create the login account.');
    }
    authUserId = created.user.id;

    const { error: rpcError } = await admin.rpc('provision_staff_account_v1', {
      p_actor_id: actor.id,
      p_user_id: created.user.id,
      p_full_name: fullName,
      p_role: role,
      p_phone: phone,
      p_username: username,
      p_start_date: startDate,
      p_pin_hash: pinHash,
    });
    if (rpcError) {
      const { error: rollbackError } = await admin.auth.admin.deleteUser(created.user.id);
      if (rollbackError) throw new Error('Profile creation failed and automatic identity cleanup needs administrator repair.');
      authUserId = null;
      if (rpcError.code === '23505') return json(request, { error: 'That phone number is already assigned to an active employee.' }, 409);
      throw new Error('Could not finish creating the staff profile. No account was kept.');
    }

    authUserId = null;
    return json(request, { id: created.user.id, pin, username, fullName, role });
  } catch (error) {
    if (authUserId) {
      const { error: rollbackError } = await admin.auth.admin.deleteUser(authUserId);
      if (rollbackError) return json(request, { error: 'Account creation failed and automatic identity cleanup needs administrator repair.' }, 500);
    }
    const message = error instanceof Error ? error.message : 'Account creation failed.';
    const status = message === 'Unauthorized' ? 401 : 400;
    return json(request, { error: status === 401 ? 'Sign in again and retry.' : message }, status);
  }
});
