import { DeskTabletEntryView } from '@/modules/desk/views/desk-tablet-entry.view';

export const metadata = {
  title: 'Customer Desk Tablet | Mzuri Unisex Salon',
};

export default function DeskPage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <DeskTabletEntryView />
    </main>
  );
}
