import fs from 'node:fs';
import path from 'node:path';

const routes = [
  // Manager routes
  { path: 'src/app/manager/approvals', title: 'Approvals', role: 'manager' },
  { path: 'src/app/manager/queue', title: 'Queue control', role: 'manager' },
  { path: 'src/app/manager/visits', title: 'Visits', role: 'manager' },
  { path: 'src/app/manager/payments', title: 'Payments', role: 'manager' },
  { path: 'src/app/manager/appointments', title: 'Appointments', role: 'manager' },
  { path: 'src/app/manager/catalogue', title: 'Catalogue and prices', role: 'manager' },
  { path: 'src/app/manager/rules', title: 'Rules', role: 'manager' },
  { path: 'src/app/manager/reconciliation', title: 'Reconciliation', role: 'manager' },
  { path: 'src/app/manager/day', title: 'Day', role: 'manager' },
  { path: 'src/app/manager/staff', title: 'Staff', role: 'manager' },
  { path: 'src/app/manager/devices', title: 'Devices', role: 'manager' },
  { path: 'src/app/manager/customers', title: 'Customers', role: 'manager' },
  { path: 'src/app/manager/paper-entry', title: 'Enter from paper', role: 'manager' },
  { path: 'src/app/manager/paper-forms', title: 'Paper forms', role: 'manager' },
  { path: 'src/app/manager/reports', title: 'Reports', role: 'manager' },

  // Receptionist routes
  { path: 'src/app/reception/checkout', title: 'Checkout', role: 'receptionist' },
  { path: 'src/app/reception/appointments', title: 'Appointments', role: 'receptionist' },
  { path: 'src/app/reception/customers', title: 'Customers', role: 'receptionist' },
  { path: 'src/app/reception/enter-paper', title: 'Enter from Paper', role: 'receptionist' },
  { path: 'src/app/reception/close-prep', title: 'Close Prep', role: 'receptionist' },

  // HR routes
  { path: 'src/app/hr/accounts', title: 'Accounts & Roles', role: 'hr' },
  { path: 'src/app/hr/attendance', title: 'Attendance Logs', role: 'hr' },
  { path: 'src/app/hr/leave', title: 'Leave Requests', role: 'hr' },
  { path: 'src/app/hr/rota', title: 'Weekly Rota Grid', role: 'hr' },
  { path: 'src/app/hr/audit', title: 'People Audit', role: 'hr' },

  // Staff routes
  { path: 'src/app/staff/attendance', title: 'My Attendance', role: 'staff' },
];

for (const r of routes) {
  const dir = path.resolve(process.cwd(), r.path);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const pageContent = `import { AppShell } from '@/shared/views/layout/app-shell';
import { NeutralPlaceholderView } from '@/shared/views/ui/neutral-placeholder.view';

export const metadata = {
  title: '${r.title} | Mzuri Unisex Salon',
};

export default function Page() {
  return (
    <AppShell role="${r.role}" userDisplayName="Operational User" pageTitle="${r.title}">
      <NeutralPlaceholderView title="${r.title}" role="${r.role}" />
    </AppShell>
  );
}
`;

  const loadingContent = `export default function Loading() {
  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-1/3"></div>
      <div className="h-40 bg-slate-100 rounded-xl"></div>
    </div>
  );
}
`;

  const errorContent = `'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6 max-w-lg mx-auto text-center space-y-4">
      <h2 className="text-lg font-bold text-slate-900">Something went wrong</h2>
      <p className="text-xs text-rose-600 font-mono">{error.message}</p>
      <button onClick={() => reset()} className="px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold">
        Try again
      </button>
    </div>
  );
}
`;

  fs.writeFileSync(path.join(dir, 'page.tsx'), pageContent);
  fs.writeFileSync(path.join(dir, 'loading.tsx'), loadingContent);
  fs.writeFileSync(path.join(dir, 'error.tsx'), errorContent);
}

console.log('✅ Generated thin route shells for all role subroutes.');
