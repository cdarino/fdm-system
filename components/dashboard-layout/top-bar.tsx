'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, Bell, ChevronRight, Clock3, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { logout as signOut } from '@/lib/auth';
import type { AuthUser } from '@supabase/supabase-js';
import type { SessionUser } from '@/lib/types/session';
import type { RecentActivityItem } from '@/lib/actions/recent-activity';
import { getRecentActivity } from '@/lib/actions/recent-activity';
import { ActivityTime } from '@/components/shared/activity-time';
import { ACTIVITY_UPDATED_EVENT } from '@/lib/activity-events';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DashboardTopBarProps {
  user?: SessionUser | AuthUser | null;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  recentActivity?: RecentActivityItem[];
}

export function useTopBar() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await signOut();
      router.replace('/');
      router.refresh();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Unable to log out.');
      setIsLoggingOut(false);
    }
  };

  return { isLoggingOut, logoutError, handleLogout };
}

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  clients: 'Client records',
  properties: 'Property inventory',
  map: 'Site Map',
  reports: 'Reports',
  admin: 'Team & access',
  settings: 'Account Settings',
  billing: 'Invoicing & Billing',
  accounting: 'Accounts Payable',
  legal: 'Title releases',
  operations: 'Operations Log',
};

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0 || segments[0] !== 'dashboard') {
    return [{ label: 'Dashboard', isCurrent: true }];
  }

  const items: Array<{ label: string; href?: string; isCurrent?: boolean }> = [];
  let currentPath = '';

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    const isLast = i === segments.length - 1;

    let label = ROUTE_LABELS[segment];
    if (!label) {
      if (segments[i - 1] === 'clients') {
        label = 'Client Profile';
      } else if (segments[i - 1] === 'properties') {
        label = 'Lot Details';
      } else {
        label = segment.charAt(0).toUpperCase() + segment.slice(1);
      }
    }

    items.push({
      label,
      href: isLast ? undefined : currentPath,
      isCurrent: isLast,
    });
  }

  return items;
}

export function DashboardBreadcrumbs() {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center space-x-1.5 text-xs sm:text-sm">
      {breadcrumbs.map((crumb, idx) => (
        <span key={crumb.label + idx} className="inline-flex min-w-0 items-center space-x-1.5">
          {idx > 0 && (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          {crumb.href && !crumb.isCurrent ? (
            <Link
              href={crumb.href}
              className="truncate font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
          ) : (
            <span
              className="truncate font-semibold text-foreground"
              aria-current={crumb.isCurrent ? 'page' : undefined}
            >
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function DashboardTopBar({
  user,
  isSidebarOpen = true,
  onToggleSidebar,
  recentActivity = [],
}: DashboardTopBarProps) {
  const { isLoggingOut, logoutError, handleLogout } = useTopBar();
  const [activityItems, setActivityItems] = useState(recentActivity);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  useEffect(() => {
    let active = true;
    async function syncActivity() {
      if (document.visibilityState === 'hidden') return;
      try {
        const items = await getRecentActivity();
        if (active) setActivityItems(items);
      } catch {
        // Background refresh keeps the last readable activity list on failure.
      }
    }
    const refresh = () => void syncActivity();
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener(ACTIVITY_UPDATED_EVENT, refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener(ACTIVITY_UPDATED_EVENT, refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const metadata = user?.user_metadata as Record<string, string> | undefined;
  const displayName = [metadata?.first_name, metadata?.last_name]
    .filter(Boolean)
    .join(' ') || user?.email || 'Unknown';
  const avatarInitial = displayName[0]?.toUpperCase() ?? '?';

  async function refreshActivity(isOpen: boolean) {
    if (!isOpen) return;
    setIsLoadingActivity(true);
    try {
      setActivityItems(await getRecentActivity());
    } catch {
      toast.error('Unable to refresh recent activity');
    } finally {
      setIsLoadingActivity(false);
    }
  }

  return (
    <div className="bg-card border-b border-border sticky top-0 z-40">
      <div className="flex h-16 min-w-0 items-center justify-between gap-3 px-4 sm:px-6 sm:gap-6">
        {/* Left: Sidebar Toggle + Breadcrumbs */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {onToggleSidebar && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-background hover:text-foreground"
              onClick={onToggleSidebar}
              aria-label={isSidebarOpen ? 'Hide navigation menu' : 'Show navigation menu'}
              aria-expanded={isSidebarOpen}
              aria-controls="dashboard-navigation"
              title={isSidebarOpen ? 'Hide navigation menu' : 'Show navigation menu'}
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <PanelLeftOpen className="h-5 w-5" />
              )}
            </Button>
          )}
          <DashboardBreadcrumbs />
        </div>

        {/* Right utility buttons */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {/* Notifications */}
          <DropdownMenu onOpenChange={(open) => void refreshActivity(open)}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label={`Recent activity${activityItems.length ? `, ${activityItems.length} items` : ''}`}
                title="Recent activity"
              >
                <Bell className="h-5 w-5" />
                {activityItems.length > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1rem))] p-0">
              <DropdownMenuLabel className="flex items-center gap-2 px-4 py-3 text-sm">
                <Activity className="h-4 w-4 text-primary" />
                Recent activity
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isLoadingActivity ? (
                <p className="px-4 py-7 text-center text-sm text-muted-foreground">Refreshing activity…</p>
              ) : activityItems.length === 0 ? (
                <p className="px-4 py-7 text-center text-sm text-muted-foreground">
                  No recent activity is available for your role.
                </p>
              ) : (
                <div className="max-h-[min(65vh,26rem)] overflow-y-auto p-1">
                  {activityItems.map((item) => (
                    <DropdownMenuItem key={`${item.kind}-${item.id}`} asChild className="cursor-pointer whitespace-normal px-3 py-2.5">
                      <Link href={item.href} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-accent-blue-foreground">
                          {item.kind === 'title' ? <Clock3 className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-foreground">{item.label}</span>
                          <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.detail}</span>
                          <span className="mt-1 block text-[11px] text-muted-foreground">
                            {item.actor} · <ActivityTime timestamp={item.timestamp} />
                          </span>
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex min-w-0 items-center space-x-2 text-foreground hover:bg-background hover:text-foreground"
              >
                <span className="hidden max-w-40 min-w-0 truncate text-sm font-medium sm:block">{displayName}</span>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-accent-blue-foreground">
                  {avatarInitial}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* One destination, one entry. Profile details and password live
                  on the same page, so two items pointing at it was redundant. */}
              {/* Overridden locally so the whole header highlights like the
                  sidebar; the shared DropdownMenuItem default is still accent. */}
              <DropdownMenuItem asChild className="focus:bg-background focus:text-foreground">
                <Link href="/dashboard/settings">Account Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={isLoggingOut}
                onSelect={() => void handleLogout()}
              >
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </DropdownMenuItem>
              {logoutError && (
                <p className="max-w-56 px-2 py-1 text-xs text-destructive">{logoutError}</p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
