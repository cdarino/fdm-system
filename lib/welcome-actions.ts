import {
  FileCheck2,
  LandPlot,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface WelcomeAction {
  label: string;
  href: string;
  icon: LucideIcon;
  variant: 'default' | 'outline';
}

export function getWelcomeActions(isSystemAdmin: boolean, roles: string[]): WelcomeAction[] {
  if (isSystemAdmin) {
    return [
      {
        label: 'Team & access',
        href: '/dashboard/admin',
        icon: UserCog,
        variant: 'default',
      },
    ];
  }

  if (roles.includes('legal_staff')) {
    return [
      {
        label: 'Title releases',
        href: '/dashboard/legal',
        icon: FileCheck2,
        variant: 'default',
      },
    ];
  }

  if (roles.includes('admin_staff') || roles.includes('billing_staff')) {
    return [
      {
        label: 'Client records',
        href: '/dashboard/clients',
        icon: Users,
        variant: 'default',
      },
      {
        label: 'Property inventory',
        href: '/dashboard/properties/map',
        icon: LandPlot,
        variant: 'outline',
      },
    ];
  }

  return [];
}
