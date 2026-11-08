import { AppRole } from './roles';

export interface NavItem {
  title: string;
  href: string;
  iconName: string;
  badge?: string;
  group?: string;
}

export const ROLE_NAVIGATION: Record<AppRole, NavItem[]> = {
  owner: [
    { title: 'Dashboard', href: '/owner', iconName: 'LayoutDashboard' },
    { title: 'Visits', href: '/owner/visits', iconName: 'Scissors' },
    { title: 'Payments', href: '/owner/payments', iconName: 'CreditCard' },
    { title: 'Staff', href: '/owner/staff', iconName: 'Award' },
    { title: 'Waits and services', href: '/owner/waits', iconName: 'Clock' },
    { title: 'Daily summaries', href: '/owner/summaries', iconName: 'FileText' },
    { title: 'Audit log', href: '/owner/audit', iconName: 'ShieldAlert' },
    { title: 'Customers', href: '/owner/customers', iconName: 'Users' },
    { title: 'Catalogue', href: '/owner/catalogue', iconName: 'Tag' },
    { title: 'Settings', href: '/owner/settings', iconName: 'Sliders' },
  ],
  manager: [
    // Operations
    { title: 'Today', href: '/manager', iconName: 'Activity', group: 'Operations' },
    { title: 'Approvals', href: '/manager/approvals', iconName: 'CheckSquare', group: 'Operations' },
    { title: 'Queue control', href: '/manager/queue', iconName: 'ListOrdered', group: 'Operations' },
    { title: 'Visits', href: '/manager/visits', iconName: 'Scissors', group: 'Operations' },
    { title: 'Kiosk orders', href: '/manager/kiosk-orders', iconName: 'Tablet', group: 'Operations' },
    // Money
    { title: 'Payments', href: '/manager/payments', iconName: 'CreditCard', group: 'Money' },
    { title: 'Reconciliation', href: '/manager/reconciliation', iconName: 'FileSpreadsheet', group: 'Money' },
    { title: 'Day', href: '/manager/day', iconName: 'Lock', group: 'Money' },
    // Setup
    { title: 'Appointments', href: '/manager/appointments', iconName: 'Calendar', group: 'Setup' },
    { title: 'Catalogue and prices', href: '/manager/catalogue', iconName: 'Tag', group: 'Setup' },
    { title: 'Rules', href: '/manager/rules', iconName: 'Percent', group: 'Setup' },
    // People and devices
    { title: 'Staff', href: '/manager/staff', iconName: 'Award', group: 'People and devices' },
    { title: 'Devices', href: '/manager/devices', iconName: 'Smartphone', group: 'People and devices' },
    { title: 'Customers', href: '/manager/customers', iconName: 'Users', group: 'People and devices' },
    // Paper
    { title: 'Enter from paper', href: '/manager/paper-entry', iconName: 'FileText', group: 'Paper' },
    { title: 'Paper forms', href: '/manager/paper-forms', iconName: 'Printer', group: 'Paper' },
    // Reports
    { title: 'Reports', href: '/manager/reports', iconName: 'FileSpreadsheet', group: 'Reports' },
  ],
  receptionist: [
    { title: 'Check-in', href: '/reception', iconName: 'Users' },
    { title: 'Kiosk orders', href: '/reception/kiosk-orders', iconName: 'Tablet' },
    { title: 'Visits', href: '/reception/visits', iconName: 'Scissors' },
    { title: 'Appointments', href: '/reception/appointments', iconName: 'Calendar' },
    { title: 'Customers', href: '/reception/customers', iconName: 'UserCheck' },
    { title: 'Customer tablet', href: '/reception/tablet', iconName: 'Tablet' },
    { title: 'Enter from paper', href: '/reception/paper-entry', iconName: 'FileText' },
    { title: 'Close prep', href: '/reception/close-prep', iconName: 'Clock' },
    { title: 'Paper forms', href: '/reception/paper-forms', iconName: 'Printer' },
  ],
  hr: [
    { title: 'Overview', href: '/hr', iconName: 'LayoutDashboard' },
    { title: 'Staff', href: '/hr/staff', iconName: 'Users' },
    { title: 'Access', href: '/hr/access', iconName: 'Shield' },
    { title: 'Attendance', href: '/hr/attendance', iconName: 'Clock' },
    { title: 'Leave', href: '/hr/leave', iconName: 'CalendarOff' },
    { title: 'Rota', href: '/hr/rota', iconName: 'Calendar' },
    { title: 'Performance', href: '/hr/performance', iconName: 'Award' },
    { title: 'Audit', href: '/hr/audit', iconName: 'ShieldAlert' },
  ],
  staff: [
    { title: 'Queue', href: '/staff', iconName: 'ListOrdered' },
    { title: 'Appointments', href: '/staff/appointments', iconName: 'Calendar' },
    { title: 'Target', href: '/staff/target', iconName: 'Award' },
    { title: 'History', href: '/staff/history', iconName: 'Clock' },
    { title: 'Leave', href: '/staff/leave', iconName: 'Calendar' },
    { title: 'Attendance', href: '/staff/attendance', iconName: 'UserCheck' },
  ],
};
