import { AppShell } from '@/shared/views/layout/app-shell';
import { OwnerSettingsView } from '@/modules/dashboard-owner';

export const metadata = {
  title: 'Settings | Mzuri Unisex Salon',
};

export default function SettingsPage() {
  return (
    <AppShell role="owner" userDisplayName="Godfrey Mugisha" pageTitle="Settings">
      <OwnerSettingsView />
    </AppShell>
  );
}
