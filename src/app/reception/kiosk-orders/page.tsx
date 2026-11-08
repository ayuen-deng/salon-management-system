import { AppShell } from '@/shared/views/layout/app-shell';
import { ReceptionKioskOrdersView } from '@/modules/reception/views/reception-kiosk-orders.view';
import { getAuthUser } from '@/modules/auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Kiosk Orders | Mzuri Unisex Salon' };

export default async function ReceptionKioskOrdersPage() {
  const user = await getAuthUser();
  if (!user || user.role !== 'receptionist') redirect('/login');
  return <AppShell role="receptionist" userDisplayName={user.displayName} pageTitle="Kiosk orders"><ReceptionKioskOrdersView /></AppShell>;
}
