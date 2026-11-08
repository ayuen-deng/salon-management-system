import { AppShell } from '@/shared/views/layout/app-shell';
import { StaffPortalView } from '@/modules/staff-portal';
import { getAuthUser } from '@/modules/auth';

export const metadata = {
  title: 'Staff Phone Portal | Mzuri Unisex Salon',
};

export default async function StaffPage() {
  const user = await getAuthUser();
  const displayName = user?.displayName || user?.fullName || 'Staff Member';

  return (
    <AppShell role="staff" userDisplayName={displayName} pageTitle="Staff Portal">
      <StaffPortalView initialDisplayName={displayName} />
    </AppShell>
  );
}
