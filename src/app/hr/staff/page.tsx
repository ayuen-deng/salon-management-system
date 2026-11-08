import { AppShell } from '@/shared/views/layout/app-shell';
import { HrStaffView } from '@/modules/people-hr';

export const metadata = {
  title: 'Staff Directory | Mzuri Unisex Salon',
};

export default function HrStaffPage() {
  return (
    <AppShell role="hr" pageTitle="Staff Directory">
      <HrStaffView />
    </AppShell>
  );
}
