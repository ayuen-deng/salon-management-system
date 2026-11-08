export type AppRole = 'owner' | 'manager' | 'hr' | 'receptionist' | 'staff';

export const ROLE_HOMES: Record<AppRole, string> = {
  owner: '/owner',
  manager: '/manager',
  hr: '/hr',
  receptionist: '/reception',
  staff: '/staff',
};

export function getRoleHome(role: AppRole): string {
  return ROLE_HOMES[role] || '/login';
}

export function isStaffRole(role: AppRole): boolean {
  return role === 'staff' || role === 'receptionist';
}

export function usernameToSyntheticEmail(username: string): string {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  
  // Specific demo aliases
  if (clean === 'owner') return 'owner@mzuri.salon';
  if (clean === 'manager') return 'manager@mzuri.salon';
  if (clean === 'hr') return 'hr@mzuri.salon';
  if (clean === 'reception' || clean === 'mary') return 'mary@staff.mzuri.salon';
  if (clean === 'staff' || clean === 'grace') return 'grace@staff.mzuri.salon';
  if (clean === 'sarah') return 'sarah@staff.mzuri.salon';
  if (clean === 'peter') return 'peter@staff.mzuri.salon';
  if (clean === 'rose') return 'rose@staff.mzuri.salon';

  return `${clean}@staff.mzuri.salon`;
}
