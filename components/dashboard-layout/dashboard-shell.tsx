'use client';

import * as React from 'react';
import { PanelLeftClose } from 'lucide-react';
import { SidebarNav } from '@/components/dashboard-layout/sidebar-nav';
import { DashboardTopBar } from '@/components/dashboard-layout/top-bar';
import { FdmLogo } from '@/components/shared/fdm-logo';
import { Button } from '@/components/ui/button';

interface DashboardShellProps {
  children: React.ReactNode;
  user: Parameters<typeof DashboardTopBar>[0]['user'];
  roleSections: Parameters<typeof SidebarNav>[0]['roleSections'];
}

export function DashboardShell({
  children,
  user,
  roleSections,
}: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const hasLoadedSidebarPreference = React.useRef(false);

  React.useEffect(() => {
    // NOTE: Could be fine for now, in the future we could use some kind of class/hook to manage local configs
    const savedPreference = window.localStorage.getItem('dashboard-sidebar-open');
    if (savedPreference !== null) {
      setIsSidebarOpen(savedPreference === 'true');
    } else if (window.matchMedia('(max-width: 1023px)').matches) {
      setIsSidebarOpen(false);
    }
    hasLoadedSidebarPreference.current = true;
  }, []);

  React.useEffect(() => {
    if (hasLoadedSidebarPreference.current) {
      window.localStorage.setItem('dashboard-sidebar-open', String(isSidebarOpen));
    }
  }, [isSidebarOpen]);

  // Close mobile sidebar on Escape key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen && window.matchMedia('(max-width: 1023px)').matches) {
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
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs transition-opacity duration-200 lg:hidden"
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
        <div className="shrink-0 border-b border-border p-2 lg:p-4">
          <div className="relative flex flex-col items-center space-y-2">
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
            <FdmLogo className="h-12 w-12 shrink-0 object-contain lg:h-24 lg:w-40" />
            <span className="hidden text-center font-bold text-foreground lg:block">
              First Davao Millennium
              <br />
              Property Ventures Inc.
            </span>
          </div>
        </div>
        <SidebarNav roleSections={roleSections} />
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
        />
        <main id="main-content" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
