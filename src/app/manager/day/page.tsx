import { AppShell } from '@/shared/views/layout/app-shell';
import { ManagerDayView } from '@/modules/manager';

export const metadata = {
  title: 'Day Operations | Manager Operations | Mzuri Unisex Salon',
};

export default function DayPage() {
  return (
    <AppShell role="manager" userDisplayName="Joan (Manager)" pageTitle="Day">
      <ManagerDayView />
    </AppShell>
  );
}
