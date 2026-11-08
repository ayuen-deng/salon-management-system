import { AppShell } from '@/shared/views/layout/app-shell';
import { ManagerRulesView } from '@/modules/manager';

export const metadata = {
  title: 'Rules & Policies | Manager Operations | Mzuri Unisex Salon',
};

export default function RulesPage() {
  return (
    <AppShell role="manager" userDisplayName="Joan (Manager)" pageTitle="Rules">
      <ManagerRulesView />
    </AppShell>
  );
}
