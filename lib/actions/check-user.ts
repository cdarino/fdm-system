'use server';

import { hasPermission } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function checkIsSystemAdmin(userId: string): Promise<boolean> {
  return hasPermission('system.create', userId);
}

export async function getIsCurrentUserSystemAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  return hasPermission('system.create', user.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Role → Sidebar tab mapping
// ─────────────────────────────────────────────────────────────────────────────

export interface RoleTab {
  title: string;
  href: string;
  comingSoon: true;
}

const ROLE_TAB_MAP: Record<string, RoleTab> = {
  billing_staff:    { title: 'Invoicing & Billing', href: '/dashboard/billing',     comingSoon: true },
  accounting_staff: { title: 'Accounts Payable',    href: '/dashboard/accounting',  comingSoon: true },
  legal_staff:      { title: 'Contract Management',  href: '/dashboard/legal',        comingSoon: true },
  admin_staff:      { title: 'Operations Log',     href: '/dashboard/operations',  comingSoon: true },
};

/**
 * Returns the list of role-based tabs the current user should see in the sidebar.
 */
export async function getCurrentUserRoleTabs(): Promise<RoleTab[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const adminClient = createAdminClient();
  const { data: userRoles, error } = await adminClient
    .schema('rbac')
    .from('user_role')
    .select('role:role_id(name)')
    .eq('user_id', user.id)
    .returns<{ role: { name: string } | null }[]>();

  if (error || !userRoles) return [];

  const roleNames = userRoles
    .map((row) => row.role?.name)
    .filter((name): name is string => !!name);

  return roleNames
    // Only include operational staff roles — never include system_admin here
    .filter((name) => name in ROLE_TAB_MAP && name !== 'system_admin')
    .map((name) => ROLE_TAB_MAP[name])
    // de-duplicate in case of duplicate role assignments
    .filter((tab, idx, arr) => arr.findIndex((t) => t.href === tab.href) === idx);
}
