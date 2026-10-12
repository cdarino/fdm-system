'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileCheck2, FileText, LayoutDashboard, LandPlot, Settings, UserCog, Users } from 'lucide-react';
import { useSession } from '@/lib/hooks/use-session';
import { DASHBOARD_WORKFLOW } from '@/lib/dashboard-workflow';
import { cn } from '@/lib/utils';

const icons = [Users, LandPlot, FileCheck2];

export function SidebarNav() {
  const { hasPermission, isSystemAdmin } = useSession();
  const pathname = usePathname();
  const workflow = DASHBOARD_WORKFLOW.filter(item => hasPermission(item.permission));
  const tools = [
    { title: 'Reports', href: '/dashboard/reports', icon: FileText, visible: workflow.length > 0 },
    { title: 'Team & access', href: '/dashboard/admin', icon: UserCog, visible: isSystemAdmin },
    { title: 'My account', href: '/dashboard/settings', icon: Settings, visible: true },
  ].filter(item => item.visible);

  function isActive(href: string) {
    const path = href === '/dashboard/properties/map' ? '/dashboard/properties' : href;
    return pathname === path || (path !== '/dashboard' && pathname.startsWith(path + '/'));
  }

  function itemClasses(active: boolean) {
    return cn('flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      active ? 'bg-sidebar-accent text-accent-blue-foreground' : 'text-muted-foreground hover:bg-row-hover hover:text-foreground');
  }

  return (
    <nav aria-label="Main navigation" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-5">
      <Link href="/dashboard" className={itemClasses(isActive('/dashboard'))} aria-current={isActive('/dashboard') ? 'page' : undefined}>
        <LayoutDashboard className="h-4 w-4 shrink-0" /> Overview
      </Link>
      {workflow.length > 0 && <section className="mt-7 space-y-1">
        <h2 className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Daily workflow</h2>
        {workflow.map(item => {
          const Icon = icons[DASHBOARD_WORKFLOW.indexOf(item)];
          const active = isActive(item.href);
          return <Link key={item.href} href={item.href} className={itemClasses(active)} aria-current={active ? 'page' : undefined}>
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.title}</span>
            <span aria-hidden="true" className="text-[10px] tabular-nums text-muted-foreground">{item.step}</span>
          </Link>;
        })}
      </section>}
      <section className="mt-auto space-y-1 pt-8">
        <h2 className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace tools</h2>
        {tools.map(({ icon: Icon, ...item }) => <Link key={item.href} href={item.href} className={itemClasses(isActive(item.href))} aria-current={isActive(item.href) ? 'page' : undefined}>
          <Icon className="h-4 w-4 shrink-0" />{item.title}
        </Link>)}
      </section>
    </nav>
  );
}
