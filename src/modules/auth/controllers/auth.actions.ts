'use server';

import { AuthRepository, UserSession } from '../models/auth.repository';
import { Result } from '@/shared/models/result';
import { AppRole, getRoleHome } from '@/shared/models/roles';
import { redirect } from 'next/navigation';

class AuthController {
  private repo = new AuthRepository();

  async login(identifier: string, secret: string, roleHint?: AppRole): Promise<Result<UserSession>> {
    return this.repo.signInWithCredentials(identifier, secret, roleHint);
  }

  async logout(): Promise<Result<void>> {
    return this.repo.signOut();
  }
}

export async function loginAction(identifier: string, secret: string, roleHint?: AppRole): Promise<Result<{ role: AppRole; redirectUrl: string }>> {
  const controller = new AuthController();
  const res = await controller.login(identifier, secret, roleHint);
  if (!res.success) {
    return res;
  }
  return {
    success: true,
    data: {
      role: res.data.role,
      redirectUrl: res.data.mustChangePin ? '/choose-pin' : getRoleHome(res.data.role),
    },
  };
}

export async function logoutAction(): Promise<void> {
  const controller = new AuthController();
  await controller.logout();
  redirect('/login');
}

export async function getCurrentUserAction(): Promise<UserSession | null> {
  const controller = new AuthController();
  const repo = new AuthRepository();
  return repo.getCurrentUser();
}

export async function changeTemporaryPinAction(pin: string, confirmation: string): Promise<Result<{ redirectUrl: string }>> {
  const repo = new AuthRepository();
  return repo.changeTemporaryPin(pin, confirmation);
}
