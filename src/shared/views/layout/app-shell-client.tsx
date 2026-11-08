'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AppRole } from '@/shared/models/roles';
import { ROLE_NAVIGATION } from '@/shared/models/navigation';
import { Button } from '@/shared/views/ui/button';
import { AttendancePill } from '@/shared/views/ui/attendance-pill';
import { useAttendance } from '@/shared/lib/attendance-context';
import { Loader2 } from 'lucide-react';
import {
  Menu,
  X,
  LayoutDashboard,
  Scissors,
  CreditCard,
  Award,
  Clock,
  FileText,
  ShieldAlert,
  Users,
  Sliders,
  Activity,
  CheckSquare,
  ListOrdered,
  Receipt,
  Calendar,
  Tag,
  Upload,
  Percent,
  FileSpreadsheet,
  Lock,
  Smartphone,
  Printer,
  Tablet,
  UserCheck,
  Shield,
  CalendarOff,
  MoreHorizontal
} from 'lucide-react';
import { logoutAction } from '@/modules/auth/controllers/auth.actions';
import { getPendingApprovalsCountAction } from '@/modules/manager/controllers/manager-nav.actions';
import { NotificationBell } from '@/modules/notifications';
import { getPendingKioskOrderCountAction } from '@/modules/reception/controllers/reception.actions';
import { dispatchSalonDataChanged, subscribeToSalonLiveChanges } from '@/shared/lib/salon-live-updates';
import { createSalonChangeCoalescer } from '@/shared/lib/salon-change-coalescer';

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Scissors,
  CreditCard,
  Award,
  Clock,
  FileText,
  ShieldAlert,
  Users,
  Sliders,
  Activity,
  CheckSquare,
  ListOrdered,
  Receipt,
  Calendar,
  Tag,
  Upload,
  Percent,
  FileSpreadsheet,
  Lock,
  Smartphone,
  Printer,
  Tablet,
  UserCheck,
  Shield,
  CalendarOff,
};

interface AppShellProps {
  children: React.ReactNode;
  role: AppRole;
  userDisplayName?: string;
  pageTitle: string;
}

export function AppShellClient({
  children,
  role,
  userDisplayName = 'Operational User',
  pageTitle,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const signedInName = userDisplayName === 'Operational User' ? '' : userDisplayName;

  useEffect(() => {
    const coalescer = createSalonChangeCoalescer((tables) => {
      if (tables.length === 0) return;
      const handledLocally = dispatchSalonDataChanged({ table: '*' });
      // Client views already reload through their local hook. Refresh the
      // Server Component tree only on routes with no local invalidation hook.
      if (!handledLocally) router.refresh();
    });
    const unsubscribe = subscribeToSalonLiveChanges(({ table }) => coalescer.push(table));
    return () => {
      coalescer.dispose();
      unsubscribe();
    };
  }, [router]);

  const salonName = process.env.NEXT_PUBLIC_SALON_NAME || 'Mzuri Unisex Salon';
  const branchName = process.env.NEXT_PUBLIC_BRANCH_NAME || 'Mbarara';
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  const navItems = ROLE_NAVIGATION[role] || [];
  const currentDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const currentTime = new Date().toLocaleTimeString('en-UG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  function handleSwitchRole(targetRole: AppRole) {
    logoutAction().then(() => {
      router.push(`/login?role=${targetRole}`);
    });
  }

  // Mobile Bottom Bar items for Owner
  const ownerBottomItems = [
    { title: 'Dashboard', href: '/owner', icon: LayoutDashboard },
    { title: 'Visits', href: '/owner/visits', icon: Scissors },
    { title: 'Payments', href: '/owner/payments', icon: CreditCard },
    { title: 'Summaries', href: '/owner/summaries', icon: FileText },
  ];

  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [pendingKioskOrders, setPendingKioskOrders] = useState<number>(0);
  const [hrBadges, setHrBadges] = useState<{ pendingRevocations: number; pendingLeave: number }>({
    pendingRevocations: 0,
    pendingLeave: 0,
  });

  React.useEffect(() => {
    if (role === 'manager') {
      getPendingApprovalsCountAction().then((res) => {
        if (res.success) {
          setPendingApprovalsCount(res.count);
        }
      });
    } else if (role === 'hr') {
      import('@/modules/people-hr/controllers/hr.actions').then((mod) => {
        mod.getHrBadgesAction().then((res) => {
          if (res.success && res.data) {
            setHrBadges({
              pendingRevocations: res.data.pendingRevocations,
              pendingLeave: res.data.pendingLeave,
            });
          }
        });
      });
    }
  }, [role]);

  React.useEffect(() => {
    if (role !== 'receptionist' && role !== 'manager') return;
    const loadCount = () => getPendingKioskOrderCountAction().then((res) => { if (res.success) setPendingKioskOrders(res.data); });
    void loadCount();
    const handleSalonChange = (event: Event) => {
      const table = (event as CustomEvent<{ table?: string }>).detail?.table;
      if (table === 'visit' || table === '*') void loadCount();
    };
    window.addEventListener('salon:data-changed', handleSalonChange);
    return () => window.removeEventListener('salon:data-changed', handleSalonChange);
  }, [role]);

  React.useEffect(() => {
    if (role !== 'hr') return;
    const refreshHrBadges = () => {
      import('@/modules/people-hr/controllers/hr.actions').then((mod) => {
        mod.getHrBadgesAction().then((res) => {
          if (res.success && res.data) setHrBadges({ pendingRevocations: res.data.pendingRevocations, pendingLeave: res.data.pendingLeave });
        });
      });
    };
    window.addEventListener('salon-notifications-updated', refreshHrBadges);
    return () => window.removeEventListener('salon-notifications-updated', refreshHrBadges);
  }, [role]);

  // Group nav items if groups exist
  const groupedNav = React.useMemo(() => {
    const groups: { name: string | null; items: typeof navItems }[] = [];
    let currentGroup: string | null = null;
    let currentList: typeof navItems = [];

    navItems.forEach((item) => {
      const g = item.group || null;
      if (g !== currentGroup) {
        if (currentList.length > 0) {
          groups.push({ name: currentGroup, items: currentList });
        }
        currentGroup = g;
        currentList = [item];
      } else {
        currentList.push(item);
      }
    });
    if (currentList.length > 0) {
      groups.push({ name: currentGroup, items: currentList });
    }
    return groups;
  }, [navItems]);

  return (
    <AttendanceShellBoundary role={role} userDisplayName={userDisplayName} next={pathname}>
      <div className="min-h-screen bg-background flex flex-col font-sans text-foreground">
      {/* Thin Neutral Demo Banner */}
      {isDemoMode && (
        <div className="bg-muted text-muted-foreground border-b border-border px-4 py-1 text-center text-xs font-normal tracking-tight">
          Demo data environment • Simulated records for review
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row min-w-0 pb-16 md:pb-0">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden md:flex w-64 bg-card border-r border-border flex-col justify-between shrink-0 overflow-y-auto max-h-screen sticky top-0">
          <div>
            {/* Brand Logo & Name */}
            <div className="p-5 border-b border-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary text-white font-bold flex items-center justify-center text-sm shadow-xs">
                M
              </div>
              <div className="truncate">
                <div className="font-semibold text-sm text-foreground leading-tight truncate">{salonName}</div>
                <div className="text-xs text-muted-foreground truncate">{branchName}</div>
              </div>
            </div>

            {/* Nav Items Grouped */}
            <nav className="p-3 space-y-3">
              {groupedNav.map((grp, grpIdx) => (
                <div key={grpIdx} className="space-y-0.5">
                  {grp.name ? (
                    <div className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                      {grp.name}
                    </div>
                  ) : grpIdx === 0 ? (
                    <div className="px-3 pb-1 text-xs font-medium text-muted-foreground capitalize">
                      {role === 'hr' ? 'HR' : role} workspace
                    </div>
                  ) : null}
                  {grp.items.map((item) => {
                    const isActive = pathname === item.href;
                    const IconComponent = ICON_MAP[item.iconName] || LayoutDashboard;
                    const badgeValue =
                      item.href === '/manager/approvals' && pendingApprovalsCount > 0
                        ? pendingApprovalsCount.toString()
                        : item.href === '/hr/access' && hrBadges.pendingRevocations > 0
                        ? hrBadges.pendingRevocations.toString()
                        : item.href === '/hr/leave' && hrBadges.pendingLeave > 0
                        ? hrBadges.pendingLeave.toString()
                        : ['/reception/kiosk-orders', '/manager/kiosk-orders'].includes(item.href) && pendingKioskOrders > 0
                        ? pendingKioskOrders.toString()
                        : item.badge;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-900 font-semibold'
                            : 'text-muted-foreground hover:bg-slate-100 hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <IconComponent className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                          <span className="truncate">{item.title}</span>
                        </div>
                        {badgeValue && (
                          <span className="text-xs px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 tabular-nums font-medium">
                            {badgeValue}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>

          {/* User Profile Footer */}
          <div className="p-3 border-t border-border bg-card">
            <div className="flex items-center justify-between">
              <div className="truncate pr-2">
                <div className="text-xs font-medium text-foreground truncate">{signedInName || (role === 'hr' ? 'HR' : role === 'owner' ? 'Owner' : role === 'manager' ? 'Manager' : role === 'receptionist' ? 'Receptionist' : 'Staff')}</div>
                <div className="text-xs text-muted-foreground capitalize">{role === 'hr' ? 'HR' : role}</div>
              </div>
              <button
                onClick={() => logoutAction()}
                className="text-xs text-muted-foreground hover:text-foreground font-normal shrink-0"
              >
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {/* MOBILE DRAWER MODAL */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-black/40 backdrop-blur-xs flex">
            <div className="w-72 bg-card h-full flex flex-col justify-between p-5 border-r border-border shadow-md">
              <div>
                <div className="flex justify-between items-center pb-3 border-b border-border mb-3">
                  <div className="font-semibold text-sm text-foreground">{salonName}</div>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <nav className="space-y-0.5">
                  {(role === 'staff' ? navItems.filter((item) => ['/staff/history','/staff/leave','/staff/attendance'].includes(item.href)) : navItems).map((item) => {
                    const IconComponent = ICON_MAP[item.iconName] || LayoutDashboard;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium ${
                          isActive ? 'bg-muted text-foreground font-semibold' : 'text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        <IconComponent className="w-4 h-4 text-muted-foreground" />
                        <span>{item.title}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-3 border-t border-border">
                <div className="text-xs font-medium text-foreground">{signedInName || (role === 'hr' ? 'HR' : role === 'owner' ? 'Owner' : role === 'manager' ? 'Manager' : role === 'receptionist' ? 'Receptionist' : 'Staff')}</div>
                <button
                  onClick={() => logoutAction()}
                  className="text-xs text-muted-foreground hover:text-foreground mt-1 block"
                >
                  Sign out
                </button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)}></div>
          </div>
        )}

        {/* MAIN WORKSPACE CONTENT */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* TOP BAR */}
          <header className="h-14 bg-card border-b border-border px-4 md:px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <NotificationBell />
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-1.5 text-muted-foreground hover:bg-muted rounded"
              >
                <Menu className="w-4 h-4" />
              </button>
              <h1 className="text-sm md:text-base font-semibold text-foreground truncate">{pageTitle}</h1>
            </div>

            <div className="flex items-center gap-3">
              {/* SHARED ATTENDANCE CONTROL (Manager, Receptionist, HR, Staff) */}
              {role !== 'owner' && (
                <div className="hidden sm:block">
                  <AttendancePill />
                </div>
              )}

              <div className="text-right hidden sm:block">
                <div className="text-xs text-muted-foreground">{currentDate}</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Updated {currentTime}
                </div>
              </div>

              {/* ROLE SWITCHER */}
              <div className="relative group">
                <Button variant="outline" size="sm" className="font-normal text-xs h-7 px-2.5 border-border">
                  <span className="hidden sm:inline">Switch role ▾</span>
                  <span className="sm:hidden">Role ▾</span>
                </Button>
                <div className="absolute right-0 mt-1.5 w-48 bg-card border border-border rounded-lg shadow-sm p-1.5 hidden group-hover:block z-50">
                  <div className="text-xs text-muted-foreground px-2 py-1 font-medium">Switch workspace</div>
                  {(['owner', 'manager', 'hr', 'receptionist', 'staff'] as AppRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => handleSwitchRole(r)}
                      className="w-full text-left px-2 py-1 rounded text-xs font-normal text-foreground hover:bg-muted capitalize"
                    >
                      {r}
                    </button>
                  ))}
                  <div className="border-t border-border my-1"></div>
                  <div className="text-xs text-muted-foreground px-2 py-1 font-medium">Paired devices</div>
                  <a
                    href="/desk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-2 py-1 rounded text-xs font-normal text-foreground hover:bg-muted"
                  >
                    Customer tablet ↗
                  </a>
                  <a
                    href="/display/queue"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-2 py-1 rounded text-xs font-normal text-foreground hover:bg-muted"
                  >
                    Queue screen ↗
                  </a>
                </div>
              </div>
            </div>
          </header>

          {/* MAIN PAGE VIEW AREA */}
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (for Owner role on phone) */}
      {role === 'owner' && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-card border-t border-border flex items-center justify-around z-40 px-2">
          {ownerBottomItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center w-14 h-full text-xs font-normal transition-colors ${
                  isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                }`}
              >
                <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span>{item.title}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center w-14 h-full text-xs text-muted-foreground"
          >
            <MoreHorizontal className="w-4 h-4 mb-0.5" />
            <span>More</span>
          </button>
        </nav>
      )}

      {/* MOBILE BOTTOM TAB BAR FOR STAFF ROLE (<768px phone) */}
      {role === 'staff' && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-card border-t border-border flex items-center justify-around z-40 px-2">
          <Link
            href="/staff"
            className={`flex flex-col items-center justify-center flex-1 h-full text-xs font-normal transition-colors ${
              pathname === '/staff' ? 'text-primary font-medium' : 'text-muted-foreground'
            }`}
          >
            <ListOrdered className={`w-4 h-4 mb-0.5 ${pathname === '/staff' ? 'text-primary' : 'text-muted-foreground'}`} />
            <span>Queue</span>
          </Link>
          <Link
            href="/staff/appointments"
            className={`flex flex-col items-center justify-center flex-1 h-full text-xs font-normal transition-colors ${
              pathname === '/staff/appointments' ? 'text-primary font-medium' : 'text-muted-foreground'
            }`}
          >
            <Calendar className={`w-4 h-4 mb-0.5 ${pathname === '/staff/appointments' ? 'text-primary' : 'text-muted-foreground'}`} />
            <span>Appointments</span>
          </Link>
          <Link href="/staff/target" className={`flex flex-col items-center justify-center flex-1 h-full text-xs font-normal ${pathname === '/staff/target' ? 'text-primary font-medium' : 'text-muted-foreground'}`}><Award className={`w-4 h-4 mb-0.5 ${pathname === '/staff/target' ? 'text-primary' : 'text-muted-foreground'}`} /><span>Target</span></Link>
          <button type="button" onClick={() => setMobileMenuOpen(true)} className={`flex flex-col items-center justify-center flex-1 h-full text-xs font-normal ${['/staff/history','/staff/leave','/staff/attendance'].includes(pathname) ? 'text-primary font-medium' : 'text-muted-foreground'}`}><MoreHorizontal className="mb-0.5 h-4 w-4" /><span>More</span></button>
        </nav>
      )}
    </div>
      </AttendanceShellBoundary>
  );
}

function AttendanceShellBoundary({
  role,
  userDisplayName,
  next,
  children,
}: {
  role: AppRole;
  userDisplayName: string;
  next: string;
  children: React.ReactNode;
}) {
  const { status } = useAttendance();
  if (role === 'owner') return <>{children}</>;
  if (status === 'in') return <>{children}</>;

  const hasWorkedToday = status === 'break' || status === 'out';
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="text-sm font-medium text-blue-700">Mzuri Unisex Salon</div>
        {status === null ? (
          <div className="mt-6 flex items-center gap-3 text-slate-600" role="status" aria-live="polite">
            <Loader2 className="h-5 w-5 animate-spin" /> Checking today’s attendance…
          </div>
        ) : (
          <>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950">{hasWorkedToday ? 'You are currently out' : 'Clock in to continue'}</h1>
            <p className="mt-2 text-slate-600">{userDisplayName} · {role === 'hr' ? 'HR' : role}</p>
            <p className="mt-4 text-slate-600">{hasWorkedToday ? 'Return to In to reopen your workspace.' : 'Your workspace is available after you mark yourself as In.'}</p>
            <a href={`/attendance-gate?next=${encodeURIComponent(next)}`} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800">
              {hasWorkedToday ? 'I’m back' : 'I’m in'}
            </a>
            <button className="ml-4 mt-6 min-h-11 px-4 text-slate-600 hover:text-slate-950" onClick={async () => { await fetch('/api/auth/signout', { method: 'POST' }); window.location.assign('/login'); }} type="button">Sign out</button>
          </>
        )}
      </section>
    </main>
  );
}
