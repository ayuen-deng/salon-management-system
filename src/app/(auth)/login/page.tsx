import React, { Suspense } from 'react';
import { LoginFormView } from '@/modules/auth';

export const metadata = {
  title: 'Sign In | Mzuri Unisex Salon',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading sign in...</div>}>
      <LoginFormView />
    </Suspense>
  );
}
