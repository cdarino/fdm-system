'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Settings,
} from 'lucide-react';
import { ComingSoonModal } from './coming-soon-modal';

interface SidebarNavProps {
  isSystemAdmin?: boolean;
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
    icon: Settings,
    systemAdminOnly: true,
  },
];

export function SidebarNav({ isSystemAdmin = false }: SidebarNavProps) {
  const pathname = usePathname();
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

  const navigationItems = allNavigationItems.filter(
    (item) => !item.systemAdminOnly || isSystemAdmin
  );

  return (
    <div className="flex flex-col h-full">
      {/* Navigation Items */}
      <nav className="flex-1 space-y-1 py-6 px-3">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const buttonClasses = cn(
            'w-full flex items-center space-x-3 px-4 py-2 rounded transition-colors text-sm font-medium',
            isActive
              ? 'bg-[#E2F4FA] text-[#5BC4E7]'
              : 'text-[#6C7E8E] hover:bg-[#F5F3EC] hover:text-[#1A1D20]'
          );

          const content = (
            <button className={buttonClasses}>
              <Icon className={cn("w-5 h-5", isActive && "text-yellow-500")} />
              <span>{item.title}</span>
            </button>
          );

          return (
            <div key={item.href}>
              {item.comingSoon ? (
                <div onClick={() => handleComingSoon(item.title)} className="cursor-pointer">
                  {content}
                </div>
              ) : (
                <Link href={item.href}>
                  {content}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      <ComingSoonModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        title={modalState.title}
      />
    </div>
  );
}
