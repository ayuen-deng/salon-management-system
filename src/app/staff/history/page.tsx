import { AppShell } from '@/shared/views/layout/app-shell';
import { StaffHistoryView } from '@/modules/staff-portal';
import { getAuthUser } from '@/modules/auth';

export const metadata = {
  title: 'Service History | Mzuri Unisex Salon',
};

export default async function StaffHistoryPage() {
  const user = await getAuthUser();
  const displayName = user?.displayName || user?.fullName || 'Staff Member';

  return (
    <AppShell role="staff" userDisplayName={displayName} pageTitle="History">
      <StaffHistoryView />
    </AppShell>
  );
}
