'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppRole, isStaffRole, usernameToSyntheticEmail } from '@/shared/models/roles';
import { getCurrentUserAction } from '../controllers/auth.actions';
import { AuthBrowserRepository } from '../models/auth-browser.repository';
import { Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';

export function LoginFormView() {
  const authRepository = new AuthBrowserRepository();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = (searchParams?.get('role') as AppRole) || 'owner';

  const isSimpleLogin = process.env.NEXT_PUBLIC_DEMO_SIMPLE_LOGIN === 'true';

  const [role, setRole] = useState<AppRole>(initialRole);
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isUsernamePinMode = isSimpleLogin || isStaffRole(role) || role === 'manager';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const email = identifier.trim().includes('@')
        ? identifier.trim()
        : usernameToSyntheticEmail(identifier);
      const { error } = await authRepository.signInWithPassword(email, secret);
      if (error) {
        setErrorMsg('Invalid username and PIN, or email and password.');
        setLoading(false);
        return;
      }

      const user = await getCurrentUserAction();
      if (!user) {
        await authRepository.signOut();
        setErrorMsg('Your account profile could not be verified. Contact HR.');
        setLoading(false);
        return;
      }
      if (user.role !== role) {
        await authRepository.signOut();
        setErrorMsg(`Select the ${user.role === 'receptionist' ? 'Reception' : user.role.toUpperCase()} role to sign in.`);
        setLoading(false);
        return;
      }
      router.push(user.mustChangePin ? '/choose-pin' : `/${user.role === 'receptionist' ? 'reception' : user.role}`);
    } catch {
      setErrorMsg('Sign-in could not be completed. Check your connection and try again.');
      setLoading(false);
    }
  }

  function getTabLabel(r: AppRole): string {
    if (r === 'hr') return 'HR';
    if (r === 'receptionist') return 'Reception';
    if (r === 'owner') return 'Owner';
    if (r === 'manager') return 'Manager';
    if (r === 'staff') return 'Staff';
    return r;
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F6F8FB] text-[#0A0E14] font-sans">
      {/* Left Brand Panel: Dark-to-Blue Overlay */}
      <div className="relative w-full lg:w-1/2 min-h-[240px] lg:min-h-screen bg-[#0A0E14] flex flex-col justify-between p-6 md:p-12 overflow-hidden">
        {/* Background photo with clean black-to-blue gradient overlay */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Image
            src="/images/salon_hero.jpg"
            alt="Mzuri Unisex Salon Interior"
            fill
            priority
            className="object-cover object-center opacity-30 scale-105 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E14] via-[#0A0E14]/80 to-[#1F4FD8]/40 pointer-events-none" />
        </div>

        {/* Brand Header */}
        <div className="relative z-10">
          <div className="text-sm font-medium text-[#7B9BF0] mb-1">
            Mbarara
          </div>
          <h1 className="text-2xl md:text-4xl tracking-tight text-white font-semibold">
            <span>Mzuri </span>
            <span className="font-normal text-slate-200">Unisex Salon</span>
          </h1>
        </div>

        {/* Welcome Copy */}
        <div className="relative z-10 hidden lg:block space-y-2 max-w-md">
          <p className="text-slate-200 text-sm leading-relaxed font-normal">
            Sign in to your workspace.
          </p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md bg-white border border-[#E2E7EF] rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-[#0A0E14]">
              Sign in
            </h2>
            <p className="text-xs text-[#566174]">
              Select your role and enter your credentials to access your workspace.
            </p>
          </div>

          {/* Role Selector Segmented Control */}
          <div className="grid grid-cols-5 gap-1 p-1 bg-[#F6F8FB] border border-[#E2E7EF] rounded-xl text-xs font-medium text-[#566174]">
            {(['owner', 'manager', 'hr', 'receptionist', 'staff'] as AppRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRole(r);
                  setErrorMsg('');
                }}
                className={`py-2 rounded-lg transition-all text-xs font-medium ${
                  role === r
                    ? 'bg-white shadow-xs text-[#1F4FD8] font-semibold border border-[#E2E7EF]'
                    : 'hover:text-[#0A0E14]'
                }`}
              >
                {getTabLabel(r)}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-[#B42318] rounded-xl font-medium text-center">
                {errorMsg}
              </div>
            )}

            <div className="space-y-1.5">
                <label htmlFor="login-identifier" className="text-xs font-semibold text-[#0A0E14] block">
                {isUsernamePinMode ? 'Username' : 'Email address'}
              </label>
              <div className="relative">
                <input
                  id="login-identifier"
                  type={isUsernamePinMode ? 'text' : 'email'}
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    isUsernamePinMode
                      ? role === 'owner'
                        ? 'owner'
                        : role === 'manager'
                        ? 'manager'
                        : role === 'hr'
                        ? 'hr'
                        : role === 'receptionist'
                        ? 'reception'
                        : 'staff'
                      : 'e.g. godfrey@mzuri.salon'
                  }
                  className="w-full text-xs px-3.5 py-2.5 bg-white border border-[#E2E7EF] rounded-xl text-[#0A0E14] outline-none focus:ring-2 focus:ring-[#7B9BF0] focus:border-[#1F4FD8] transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-secret" className="text-xs font-semibold text-[#0A0E14]">
                  {isUsernamePinMode ? '6-digit PIN' : 'Password'}
                </label>
                {isUsernamePinMode && (
                  <span className="text-[11px] text-[#566174]">6 digits</span>
                )}
              </div>
              <div className="relative">
                <input
                  id="login-secret"
                  type={showSecret ? 'text' : 'password'}
                  aria-label={isUsernamePinMode ? 'PIN' : 'Password'}
                  required
                  inputMode={isUsernamePinMode ? 'numeric' : 'text'}
                  pattern={isUsernamePinMode ? '[0-9]*' : undefined}
                  maxLength={isUsernamePinMode ? 6 : undefined}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={isUsernamePinMode ? '••••••' : '••••••••'}
                  className="w-full text-xs px-3.5 py-2.5 bg-white border border-[#E2E7EF] rounded-xl text-[#0A0E14] outline-none focus:ring-2 focus:ring-[#7B9BF0] focus:border-[#1F4FD8] transition-all tracking-normal pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 mt-2 rounded-xl bg-[#1F4FD8] hover:bg-[#1A43B8] active:scale-[0.99] text-white font-medium text-xs transition-all shadow-xs flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <span>Sign in as {getTabLabel(role)}</span>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-[#E2E7EF] text-center text-[11px] text-[#566174]">
            Customer tablet and queue screen are paired salon devices and do not require user login.
          </div>
        </div>
      </div>
    </div>
  );
}
