import { getMiddlewareUserContext } from '@/modules/auth/models/middleware-user-context';
import type { AppRole } from '@/shared/models/roles';
import { AppShellClient } from './app-shell-client';

interface AppShellProps {
  children: React.ReactNode;
  role: AppRole;
  userDisplayName?: string;
  pageTitle: string;
}

export async function AppShell({ children, role, userDisplayName, pageTitle }: AppShellProps) {
  const session = await getMiddlewareUserContext();
  return (
    <AppShellClient
      role={role}
      userDisplayName={session?.displayName || session?.fullName || userDisplayName}
      pageTitle={pageTitle}
    >
      {children}
    </AppShellClient>
  );
}
