'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Settings,
  Receipt,
  CreditCard,
  FileCheck,
  ClipboardList,
  UserCog,
  Users,
  LandPlot,
} from 'lucide-react';
import { ComingSoonModal } from './coming-soon-modal';

interface SidebarNavProps {
  isSystemAdmin?: boolean;
  roleSections?: {
    category: string;
    tabs: { title: string; href: string; comingSoon?: true }[];
  }[];
}

const allNavigationItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Reports',
    href: '/dashboard/reports',
    icon: FileText,
    comingSoon: true,
  },
  {
    title: 'Admin',
    href: '/dashboard/admin',
    icon: UserCog,
    systemAdminOnly: true,
  },
  {
    title: 'Account Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

// Map role tab titles to icons
const ROLE_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Invoicing & Billing': Receipt,
  'Accounts Payable':   CreditCard,
  'Contract Management': FileCheck,
  'Operations Log':     ClipboardList,
  'Clients':              Users,
  'Property Lots':      LandPlot,
};

/**
 * `text-left` matters: a <button> defaults to text-align:center, so a label
 * long enough to wrap (e.g. "Contract Management") renders its second line
 * centred while every shorter label looks fine.
 *
 * `items-start` keeps the icon on the first line of a wrapped label instead of
 * floating to the vertical centre of the whole block. The icon is h-5 (20px)
 * and text-sm's line-height is also 20px, so single-line items are unaffected.
 */
function navItemClasses(isActive: boolean): string {
  return cn(
    'flex w-full items-start justify-center rounded px-2 py-2 text-left text-sm font-medium transition-colors lg:justify-start lg:space-x-3 lg:px-4',
    isActive
      ? 'bg-sidebar-accent text-accent-blue-foreground'
      : 'text-muted-foreground hover:bg-background hover:text-foreground',
  );
}

export function SidebarNav({ isSystemAdmin = false, roleSections = [] }: SidebarNavProps) {
  const pathname = usePathname();
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
  }>({
    isOpen: false,
    title: 'Coming Soon!',
  });

  const handleComingSoon = (title: string) => {
    setModalState({ isOpen: true, title });
  };

  const navigationItems = allNavigationItems.filter(
    (item) => !item.systemAdminOnly || isSystemAdmin
  );

  return (
    // flex-1 + min-h-0 lets this shrink inside the sidebar's flex column;
    // without min-h-0 a flex child refuses to shrink below its content and
    // the nav overflows the viewport instead of scrolling.
    <div className="flex flex-col flex-1 min-h-0">
      {/* Navigation Items */}
      <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 py-6 px-3">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          const content = (
            <>
              <Icon className={cn('w-5 h-5 shrink-0', isActive && 'text-yellow-500')} />
              <span className="sr-only lg:not-sr-only">{item.title}</span>
            </>
          );

          return (
            <div key={item.href}>
              {item.comingSoon ? (
                <button
                  type="button"
                  onClick={() => handleComingSoon(item.title)}
                  className={navItemClasses(isActive)}
                  title={item.title}
                >
                  {content}
                </button>
              ) : (
                <Link
                  href={item.href}
                  className={navItemClasses(isActive)}
                  title={item.title}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {content}
                </Link>
              )}
            </div>
          );
        })}

        {/* Role-based tabs, grouped under their department heading. */}
        {roleSections.map((section) => (
          <div key={section.category} className="pt-4 first:pt-2">
            <p className="sr-only px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:not-sr-only">
              {section.category}
            </p>
            {section.tabs.map((tab) => {
              const Icon = ROLE_TAB_ICONS[tab.title] ?? FileText;
              const isActive =
                pathname === tab.href ||
                pathname.startsWith(`${tab.href}/`) ||
                (tab.href === '/dashboard/properties/map' && pathname.startsWith('/dashboard/properties'));

              const content = (
                <>
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="sr-only lg:not-sr-only">{tab.title}</span>
                </>
              );

              return (
                <div key={tab.href}>
                  {tab.comingSoon ? (
                    <button
                      type="button"
                      onClick={() => handleComingSoon(tab.title)}
                      className={navItemClasses(isActive)}
                      title={tab.title}
                    >
                      {content}
                    </button>
                  ) : (
                    <Link
                      href={tab.href}
                      className={navItemClasses(isActive)}
                      title={tab.title}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {content}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <ComingSoonModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        title={modalState.title}
      />
    </div>
  );
}
