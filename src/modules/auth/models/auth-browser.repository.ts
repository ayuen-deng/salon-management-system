'use client';

import { createBrowserClient } from '@supabase/ssr';

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

function getClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
    );
  }
  return browserClient;
}

export class AuthBrowserRepository {
  signInWithPassword(email: string, password: string) {
    return getClient().auth.signInWithPassword({ email, password });
  }

  signOut() {
    return getClient().auth.signOut();
  }
}
