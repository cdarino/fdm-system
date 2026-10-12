'use client';

import * as React from 'react';
import { PanelLeftClose } from 'lucide-react';
import { SidebarNav } from '@/components/dashboard-layout/sidebar-nav';
import { DashboardTopBar } from '@/components/dashboard-layout/top-bar';
import { FdmLogo } from '@/components/shared/fdm-logo';
import { Button } from '@/components/ui/button';
import type { RecentActivityItem } from '@/lib/actions/recent-activity';

const MOBILE_QUERY = '(max-width: 1023px)';

interface DashboardShellProps {
  children: React.ReactNode;
  user: Parameters<typeof DashboardTopBar>[0]['user'];
  recentActivity: RecentActivityItem[];
}

export function DashboardShell({
  children,
  user,
  recentActivity,
}: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const hasLoadedSidebarPreference = React.useRef(false);

  React.useEffect(() => {
    // NOTE: Could be fine for now, in the future we could use some kind of class/hook to manage local configs
    // On small screens the sidebar is an overlay drawer, so it always starts
    // closed. The saved preference only applies to the desktop layout.
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setIsSidebarOpen(false);
    } else {
      const savedPreference = window.localStorage.getItem('dashboard-sidebar-open');
      if (savedPreference !== null) {
        setIsSidebarOpen(savedPreference === 'true');
      }
    }
    hasLoadedSidebarPreference.current = true;
  }, []);

  React.useEffect(() => {
    if (hasLoadedSidebarPreference.current && !window.matchMedia(MOBILE_QUERY).matches) {
      window.localStorage.setItem('dashboard-sidebar-open', String(isSidebarOpen));
    }
  }, [isSidebarOpen]);

  // Close mobile sidebar on Escape key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen && window.matchMedia(MOBILE_QUERY).matches) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[60] -translate-y-20 rounded-md bg-card px-3 py-2 text-sm font-medium text-foreground shadow focus:translate-y-0"
      >
        Skip to main content
      </a>

      {/* Dismissible mobile backdrop overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-[color-mix(in_srgb,var(--foreground)_40%,transparent)] backdrop-blur-xs transition-opacity duration-200 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="dashboard-navigation"
        className={`fixed bottom-0 left-0 top-0 z-40 flex flex-col border-r border-border bg-card transition-[width,transform] duration-200 ${
          isSidebarOpen ? 'w-72 max-w-[calc(100vw-2rem)] lg:w-60' : 'w-0 -translate-x-full overflow-hidden border-r-0'
        }`}
        aria-hidden={!isSidebarOpen}
        inert={!isSidebarOpen}
      >
        <div className="shrink-0 border-b border-border px-5 py-5">
          <div className="relative flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-8 w-8 text-muted-foreground hover:text-foreground lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close navigation menu"
              title="Close navigation menu"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
            <FdmLogo className="h-11 w-11 shrink-0 object-contain" />
            <div className="min-w-0 pr-6 lg:pr-0">
              <p className="text-sm font-semibold tracking-tight text-foreground">First Davao Millennium</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Property operations workspace</p>
            </div>
          </div>
        </div>
        <SidebarNav />
      </aside>

      <div
        className={`flex h-screen min-w-0 flex-col transition-[margin] duration-200 ${
          isSidebarOpen ? 'ml-0 lg:ml-60' : 'ml-0'
        }`}
      >
        <DashboardTopBar
          user={user}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
          recentActivity={recentActivity}
        />
        <main id="main-content" className="flex min-h-0 flex-1 flex-col overflow-clip">
          {children}
        </main>
      </div>
    </div>
  );
}
