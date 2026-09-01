'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Settings,
} from 'lucide-react';

const navigationItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Reports',
    href: '/dashboard/reports',
    icon: FileText,
  },
  {
    title: 'Admin',
    href: '/dashboard/admin',
    icon: Settings,
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Navigation Items */}
      <nav className="flex-1 space-y-1 py-6 px-3">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link key={item.href} href={item.href}>
              <button
                className={cn(
                  'w-full flex items-center space-x-3 px-4 py-2 rounded transition-colors text-sm font-medium',
                  isActive
                    ? 'bg-[#E2F4FA] text-[#5BC4E7]'
                    : 'text-[#6C7E8E] hover:bg-[#F5F3EC] hover:text-[#1A1D20]'
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.title}</span>
              </button>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
