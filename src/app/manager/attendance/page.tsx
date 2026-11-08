import { AppShell } from '@/shared/views/layout/app-shell';
import { NeutralPlaceholderView } from '@/shared/views/ui/neutral-placeholder.view';

export const metadata = {
  title: 'Staff Attendance | Mzuri Unisex Salon',
};

export default function Page() {
  return (
    <AppShell role="manager" userDisplayName="Operational User" pageTitle="Staff Attendance">
      <NeutralPlaceholderView title="Staff Attendance" role="manager" />
    </AppShell>
  );
}
