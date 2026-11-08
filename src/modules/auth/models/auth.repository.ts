import { getServiceRoleClient } from '@/shared/lib/supabase';
import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { Result, ok, fail } from '@/shared/models/result';
import { AppRole, usernameToSyntheticEmail, getRoleHome } from '@/shared/models/roles';
import { getMiddlewareUserContext } from './middleware-user-context';

export interface UserSession {
  id: string;
  email: string;
  role: AppRole;
  fullName: string;
  displayName: string;
  mustChangePin: boolean;
}

export class AuthRepository {
  async changeTemporaryPin(pin: string, confirmation: string): Promise<Result<{ redirectUrl: string }>> {
    const user = await this.getCurrentUser();
    if (!user) return fail({ code: 'FORBIDDEN', message: 'Sign in again to continue.' });
    if (!user.mustChangePin) return fail({ code: 'CONFLICT', message: 'No temporary PIN change is pending.' });
    const serverClient = await createServerSupabaseClient();
    const { data, error } = await serverClient.functions.invoke('change-temporary-pin', { body: { pin, confirmation } });
    if (error) {
      // FunctionsHttpError keeps the Edge Function response body in `context`.
      // Read its JSON so validation and account errors reach the user instead
      // of the generic “non-2xx status code” wrapper from supabase-js.
      let functionMessage: string | undefined;
      const context = (error as Error & { context?: unknown }).context;
      if (context instanceof Response) {
        try {
          const body = await context.clone().json() as { error?: unknown };
          if (typeof body.error === 'string') functionMessage = body.error;
        } catch {
          // Fall back to the SDK message when the function returned no JSON.
        }
      }
      return fail({ code: 'VALIDATION_ERROR', message: functionMessage || error.message || 'PIN change failed.' });
    }
    if (data?.error) return fail({ code: 'VALIDATION_ERROR', message: data.error });
    return ok({ redirectUrl: getRoleHome(user.role) });
  }

  async signInWithCredentials(identifier: string, secret: string, roleHint?: AppRole): Promise<Result<UserSession>> {
    try {
      let email = identifier.trim();
      if (!email.includes('@')) {
        // Staff or Reception username with 6-digit PIN
        email = usernameToSyntheticEmail(identifier);
      }

      const serverClient = await createServerSupabaseClient();
      const { data, error } = await serverClient.auth.signInWithPassword({
        email,
        password: secret,
      });

      if (error) {
        return fail({ code: 'FORBIDDEN', message: 'Invalid username or PIN.' });
      }

      if (!data.user) {
        return fail({ code: 'NOT_FOUND', message: 'User record not found.' });
      }

      // Query app_user profile to confirm status and role
      const adminClient = getServiceRoleClient();
      const { data: profile, error: pErr } = await adminClient
        .from('app_user')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (pErr || !profile) {
        return fail({ code: 'FORBIDDEN', message: 'Profile not mapped in salon directory.' });
      }

      if (profile.status === 'inactive') {
        await serverClient.auth.signOut();
        return fail({ code: 'FORBIDDEN', message: 'This account has been deactivated. Contact HR.' });
      }

      return ok({
        id: profile.id,
        email: data.user.email || email,
        role: profile.role as AppRole,
        fullName: profile.full_name,
        displayName: profile.display_name,
        mustChangePin: Boolean(profile.must_change_pin),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication system error';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async signOut(): Promise<Result<void>> {
    try {
      const serverClient = await createServerSupabaseClient();
      await serverClient.auth.signOut();
      return ok(undefined);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign out error';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getCurrentUser(): Promise<UserSession | null> {
    try {
      const middlewareUser = await getMiddlewareUserContext();
      if (middlewareUser) return middlewareUser;

      const serverClient = await createServerSupabaseClient();
      const { data } = await serverClient.auth.getUser();
      if (!data.user) return null;
      const adminClient = getServiceRoleClient();
      const { data: profile } = await adminClient
        .from('app_user')
        .select('id, role, full_name, display_name, must_change_pin')
        .eq('id', data.user.id)
        .single();
      if (!profile) return null;
      return {
        id: profile.id,
        email: data.user.email || '',
        role: profile.role as AppRole,
        fullName: profile.full_name,
        displayName: profile.display_name,
        mustChangePin: Boolean(profile.must_change_pin),
      };
    } catch {
      return null;
    }
  }
}

export async function getAuthUser(): Promise<UserSession | null> {
  const repo = new AuthRepository();
  return repo.getCurrentUser();
}

