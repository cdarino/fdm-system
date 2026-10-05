'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logout as signOut } from '@/lib/auth';
import type { AuthUser } from '@supabase/supabase-js';
import type { SessionUser } from '@/lib/types/session';
import { ComingSoonModal } from './coming-soon-modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DashboardTopBarProps {
  user?: SessionUser | AuthUser | null;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
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
  clients: 'Clients',
  properties: 'Property Lots',
  map: 'Site Map',
  reports: 'Reports',
  admin: 'Administration',
  settings: 'Account Settings',
  billing: 'Invoicing & Billing',
  accounting: 'Accounts Payable',
  legal: 'Contract Management',
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
}: DashboardTopBarProps) {
  const { isLoggingOut, logoutError, handleLogout } = useTopBar();
  const metadata = user?.user_metadata as Record<string, string> | undefined;
  const displayName = [metadata?.first_name, metadata?.last_name]
    .filter(Boolean)
    .join(' ') || user?.email || 'Unknown';
  const avatarInitial = displayName[0]?.toUpperCase() ?? '?';
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
  }>({
    isOpen: false,
    title: 'Coming Soon!'
  });

  const handleComingSoon = (title: string) => {
    setModalState({ isOpen: true, title });
  };

  return (
    <>
      <div className="bg-card border-b border-border sticky top-0 z-40">
        <div className="flex h-16 min-w-0 items-center justify-between gap-3 px-4 sm:px-6 sm:gap-6">
          {/* Left: Sidebar Toggle + Breadcrumbs */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {onToggleSidebar && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 text-muted-foreground hover:bg-background hover:text-foreground"
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
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-background hover:text-foreground relative"
            onClick={() => handleComingSoon('Notifications')}
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex min-w-0 items-center space-x-2 text-foreground hover:bg-background hover:text-foreground"
              >
                <span className="hidden max-w-40 min-w-0 truncate text-sm font-medium sm:block">{displayName}</span>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-400 text-sm font-semibold text-white">
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

      <ComingSoonModal 
        isOpen={modalState.isOpen} 
        onClose={() => setModalState({ ...modalState, isOpen: false })} 
        title={modalState.title}
      />
    </>
  );
}
