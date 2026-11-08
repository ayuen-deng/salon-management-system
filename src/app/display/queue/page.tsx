import { QueueDisplayView } from '@/modules/queue';

export const metadata = {
  title: 'Queue Display | Mzuri Unisex Salon',
};

export default function QueueDisplayPage() {
  return (
    <main className="min-h-screen bg-slate-950">
      <QueueDisplayView />
    </main>
  );
}
