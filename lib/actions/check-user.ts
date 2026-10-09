"use server";

import { cache } from "react";
import { createScope } from "@/lib/actions/action-handler";
import { hasPermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { SYSTEM_ADMIN_ROLE } from "@/lib/self-protection";
import { uuidSchema } from "@/lib/validations/client";

export interface RoleTab {
  title: string;
  href: string;
  comingSoon?: true;
}

export interface RoleSection {
  category: string;
  tabs: RoleTab[];
}

const authScope = createScope([]);

export async function checkIsSystemAdmin(userId: string): Promise<boolean> {
  const validUserId = uuidSchema.parse(userId);
  return hasPermission("system.create", validUserId);
}

export async function getIsCurrentUserSystemAdmin(): Promise<boolean> {
  return hasPermission("system.create");
}

const ROLE_SECTIONS: { role: string; section: RoleSection }[] = [
  {
    role: "admin_staff",
    section: {
      category: "Administration",
      tabs: [
        { title: "Clients", href: "/dashboard/clients" },
        { title: "Property Lots", href: "/dashboard/properties/map" },
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
      tabs: [{ title: "Contract Management", href: "/dashboard/legal" }],
    },
  },
];

const fetchRoleNames = cache(async (userId: string): Promise<string[]> => {
  const supabase = await createClient();
  const { data: userRoles, error } = await supabase
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

export async function getCurrentUserRoleNames(): Promise<string[]> {
  return authScope.query(async ({ userId }) => {
    if (!userId) return [];
    return fetchRoleNames(userId);
  });
}

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
