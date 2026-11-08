import { AppShell } from '@/shared/views/layout/app-shell';
import { ReceptionWorkspaceView } from '@/modules/reception';
import { Suspense } from 'react';

export const metadata = {
  title: 'Check-in Desk | Mzuri Unisex Salon',
};

export default function ReceptionPage() {
  return (
    <AppShell role="receptionist" userDisplayName="Mary Namubiru" pageTitle="Check-in">
      <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading check-in desk…</div>}>
        <ReceptionWorkspaceView />
      </Suspense>
    </AppShell>
  );
}
