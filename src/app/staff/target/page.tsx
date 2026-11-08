import { AppShell } from '@/shared/views/layout/app-shell';
import { StaffTargetView } from '@/modules/staff-portal';
import { getAuthUser } from '@/modules/auth';

export const metadata = {
  title: 'Customer Target | Mzuri Unisex Salon',
};

export default async function StaffTargetPage() {
  const user = await getAuthUser();
  const displayName = user?.displayName || user?.fullName || 'Staff Member';

  return (
    <AppShell role="staff" userDisplayName={displayName} pageTitle="Target">
      <StaffTargetView />
    </AppShell>
  );
}
