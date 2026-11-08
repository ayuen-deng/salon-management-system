import { AppShell } from '@/shared/views/layout/app-shell';
import { HrAccessView } from '@/modules/people-hr';

export const metadata = {
  title: 'Access & Security | Mzuri Unisex Salon',
};

export default function HrAccessPage() {
  return (
    <AppShell role="hr" pageTitle="Access & Security">
      <HrAccessView />
    </AppShell>
  );
}
