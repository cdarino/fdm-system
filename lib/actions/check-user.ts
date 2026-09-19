"use server";

import { cache } from "react";
import { hasPermission } from "@/lib/permissions";
import { getUserInfo } from "@/lib/user";
import { createAdminClient } from "@/lib/supabase/admin";
import { SYSTEM_ADMIN_ROLE } from "@/lib/self-protection";

// TODO: refactor
export async function checkIsSystemAdmin(userId: string): Promise<boolean> {
  return hasPermission("system.create", userId);
}

export async function getIsCurrentUserSystemAdmin(): Promise<boolean> {
  return hasPermission("system.create");
}

// ─────────────────────────────────────────────────────────────────────────────
// Role → Sidebar section mapping
// ─────────────────────────────────────────────────────────────────────────────

export interface RoleTab {
  title: string;
  href: string;
  comingSoon?: true;
}

export interface RoleSection {
  category: string;
  tabs: RoleTab[];
}

const ROLE_SECTIONS: { role: string; section: RoleSection }[] = [
  {
    role: "admin_staff",
    section: {
      category: "Administration",
      tabs: [
        { title: "Clients", href: "/dashboard/clients" },
        { title: "Property Lots", href: "/dashboard/properties" },
        { title: "Operations Log", href: "/dashboard/operations", comingSoon: true },
      ],
    },
  },
  {
    role: "billing_staff",
    section: {
      category: "Billing",
      tabs: [{ title: "Invoicing & Billing", href: "/dashboard/billing", comingSoon: true }],
    },
  },
  {
    role: "accounting_staff",
    section: {
      category: "Accounting",
      tabs: [{ title: "Accounts Payable", href: "/dashboard/accounting", comingSoon: true }],
    },
  },
  {
    role: "legal_staff",
    section: {
      category: "Legal",
      tabs: [{ title: "Contract Management", href: "/dashboard/legal", comingSoon: true }],
    },
  },
];

/**
 * Memoized per request. Only exported members of a "use server" module have to
 * be async functions, so the cached helper stays module-private.
 */
const fetchRoleNames = cache(async (userId: string): Promise<string[]> => {
  const adminClient = createAdminClient();
  const { data: userRoles, error } = await adminClient
    .schema("rbac")
    .from("user_role")
    .select("role:role_id(name)")
    .eq("user_id", userId)
    .returns<{ role: { name: string } | null }[]>();

  if (error || !userRoles) return [];

  return [
    ...new Set(
      userRoles
        .map((row) => row.role?.name)
        .filter((name): name is string => !!name)
    ),
  ];
});

/** Raw rbac role slugs assigned to the current user. */
export async function getCurrentUserRoleNames(): Promise<string[]> {
  const user = await getUserInfo();
  if (!user) return [];
  return fetchRoleNames(user.id);
}

/**
 * Sidebar sections the current user should see.
 *
 * A system administrator oversees every department, so they get all sections
 * rather than only those matching a role they happen to also hold.
 */
export async function getCurrentUserRoleSections(): Promise<RoleSection[]> {
  const roleNames = await getCurrentUserRoleNames();
  if (roleNames.length === 0) return [];

  if (roleNames.includes(SYSTEM_ADMIN_ROLE)) {
    return ROLE_SECTIONS.map((entry) => entry.section);
  }

  return ROLE_SECTIONS.filter((entry) => roleNames.includes(entry.role)).map(
    (entry) => entry.section
  );
}
