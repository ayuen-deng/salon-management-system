import { AppShell } from '@/shared/views/layout/app-shell';
import { OwnerStaffView } from '@/modules/dashboard-owner';

export const metadata = {
  title: 'Staff | Mzuri Unisex Salon',
};

export default function StaffPage() {
  return (
    <AppShell role="owner" userDisplayName="Godfrey Mugisha" pageTitle="Staff">
      <OwnerStaffView />
    </AppShell>
  );
}
