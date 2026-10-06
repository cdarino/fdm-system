import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import { hasPermission, getUserPermissions } from "@/lib/permissions";
import { getAuthorizedCaller, requirePermission } from "@/lib/actions/auth-guard";
import { createClient } from "@/lib/actions/clients";
import { createPropertyLot } from "@/lib/actions/properties";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import {
  loginAsAdmin,
  loginAs,
  logoutUser,
  createTemporaryUser,
  runTrackedCleanups,
  type TemporaryUser,
} from "../framework/session";

describe("Permissions & Authorization Guard Actions", () => {
  let unprivilegedUser: TemporaryUser;

  beforeAll(async () => {
    unprivilegedUser = await createTemporaryUser({
      emailPrefix: faker.internet.username().toLowerCase(),
      roleNames: [],
    });
  });

  beforeEach(async () => {
    await logoutUser();
  });

  afterAll(async () => {
    await logoutUser();
    await runTrackedCleanups();
  });

  it("hasPermission and getUserPermissions return empty/false when unauthenticated", async () => {
    const hasPerm = await hasPermission("clients.read");
    expect(hasPerm).toBe(false);

    const perms = await getUserPermissions();
    expect(perms).toEqual([]);
  });

  it("hasPermission returns false for empty permission name", async () => {
    await loginAsAdmin();
    const hasPerm = await hasPermission("");
    expect(hasPerm).toBe(false);
  });

  it("hasPermission and getUserPermissions return valid permissions for system_admin", async () => {
    await loginAsAdmin();

    const canCreateClient = await hasPermission("clients.create");
    expect(canCreateClient).toBe(true);

    const canReadProperties = await hasPermission("properties.read");
    expect(canReadProperties).toBe(true);

    const allPerms = await getUserPermissions();
    expect(allPerms).toContain("clients.create");
    expect(allPerms).toContain("clients.read");
    expect(allPerms).toContain("properties.create");
    expect(allPerms).toContain("properties.read");
  });

  it("getAuthorizedCaller rejects unauthenticated caller", async () => {
    const caller = await getAuthorizedCaller();
    expect("error" in caller).toBe(true);
    if ("error" in caller) {
      expect(caller.error).toContain("You must be logged in");
    }
  });

  it("getAuthorizedCaller rejects user without system.create permission", async () => {
    await loginAs(unprivilegedUser.email, unprivilegedUser.password);

    const caller = await getAuthorizedCaller();
    expect("error" in caller).toBe(true);
    if ("error" in caller) {
      expect(caller.error).toContain("Access denied");
    }
  });

  it("getAuthorizedCaller succeeds and returns user id for system admin", async () => {
    const adminSession = await loginAsAdmin();
    const caller = await getAuthorizedCaller();

    expect("id" in caller).toBe(true);
    if ("id" in caller) {
      expect(caller.id).toBe(adminSession.user.id);
    }
  });

  it("requirePermission throws Unauthorized when not logged in", async () => {
    await expect(requirePermission("clients.read")).rejects.toThrow("Unauthorized");
  });

  it("requirePermission throws Forbidden when user lacks permission", async () => {
    await loginAs(unprivilegedUser.email, unprivilegedUser.password);

    await expect(requirePermission("clients.delete")).rejects.toThrow(
      "Forbidden: You do not have permission 'clients.delete'."
    );
  });

  it("unprivileged user cannot execute client or property mutations", async () => {
    await loginAs(unprivilegedUser.email, unprivilegedUser.password);

    // Attempting to create client without clients.create
    const clientRes = await createClient({ full_name: faker.person.fullName() });
    expect(clientRes.success).toBe(false);
    if (!clientRes.success) {
      expect(clientRes.error).toContain("Forbidden: You do not have permission");
    }

    // Attempting to create property lot without properties.create
    const lotRes = await createPropertyLot({
      location: "Forbidden Location",
      block_number: 1,
      lot_number: 1,
      area_size: 100,
      price_per_sqm: 1000,
    });
    expect(lotRes.success).toBe(false);
    if (!lotRes.success) {
      expect(lotRes.error).toContain("Forbidden: You do not have permission");
    }
  });

  it("verifies system_admin has all delete permissions across domains", async () => {
    await loginAsAdmin();
    const allPerms = await getUserPermissions();
    const deletePerms = ["clients.delete", "properties.delete", "billing.delete", "legal.delete", "accounting.delete", "system.delete"];
    for (const perm of deletePerms) {
      expect(allPerms).toContain(perm);
      expect(await hasPermission(perm)).toBe(true);
    }
  });

  it("verifies non-sysadmin roles hold no delete permissions across domains", async () => {
    const rolesToTest = ["admin_staff", "billing_staff", "legal_staff", "accounting_staff"];
    for (const roleName of rolesToTest) {
      const tempStaff = await createTemporaryUser({
        emailPrefix: `test-${roleName}`,
        roleNames: [roleName],
      });

      await loginAs(tempStaff.email, tempStaff.password);
      const staffPerms = await getUserPermissions();
      const anyDelete = staffPerms.filter((p) => p.endsWith(".delete"));
      expect(anyDelete).toEqual([]);
    }
  });

  it("blocks anon access to rbac schema tables and routines", async () => {
    const supabase = await createServerSupabaseClient();

    const { data: roles, error: roleErr } = await supabase
      .schema("rbac")
      .from("role")
      .select("id, name");
    expect(roles).toBeNull();
    expect(roleErr).not.toBeNull();

    const { data: userRoles, error: userRoleErr } = await supabase
      .schema("rbac")
      .from("user_role")
      .select("user_id, role_id");
    expect(userRoles).toBeNull();
    expect(userRoleErr).not.toBeNull();
  });

  it("enforces RLS on rbac.user_role and blocks direct client mutations to rbac tables", async () => {
    const staffUser = await createTemporaryUser({
      emailPrefix: "rls-staff",
      roleNames: ["billing_staff"],
    });
    const sysAdminUser = await createTemporaryUser({
      emailPrefix: "rls-sysadmin",
      roleNames: ["system_admin"],
    });

    await loginAs(staffUser.email, staffUser.password);
    const staffSupabase = await createServerSupabaseClient();

    // Non-admin user can read active roles, permissions, and role_permission, but only their own user_role rows
    const { data: roles, error: rolesErr } = await staffSupabase
      .schema("rbac")
      .from("role")
      .select("id, name");
    expect(rolesErr).toBeNull();
    expect(roles?.length).toBeGreaterThanOrEqual(5);

    const { data: perms, error: permsErr } = await staffSupabase
      .schema("rbac")
      .from("permission")
      .select("id, name");
    expect(permsErr).toBeNull();
    expect(perms?.length).toBeGreaterThan(0);

    const { data: rolePerms, error: rpErr } = await staffSupabase
      .schema("rbac")
      .from("role_permission")
      .select("role_id, permission_id");
    expect(rpErr).toBeNull();
    expect(rolePerms?.length).toBeGreaterThan(0);

    const { data: visibleUserRoles, error: urErr } = await staffSupabase
      .schema("rbac")
      .from("user_role")
      .select("user_id, role_id");
    expect(urErr).toBeNull();
    expect(visibleUserRoles?.length).toBe(1);
    expect(visibleUserRoles?.every((r) => r.user_id === staffUser.id)).toBe(true);

    // Direct self-promotion to system_admin via user_role INSERT is rejected
    const sysAdminRole = roles!.find((r) => r.name === "system_admin")!;
    const { error: escalateErr } = await staffSupabase
      .schema("rbac")
      .from("user_role")
      .insert({ user_id: staffUser.id, role_id: sysAdminRole.id });
    expect(escalateErr).not.toBeNull();

    // User with system.read (system_admin) can read all user_role rows via RLS, but still cannot directly mutate
    await loginAs(sysAdminUser.email, sysAdminUser.password);
    const adminSupabase = await createServerSupabaseClient();

    const { data: allUserRoles, error: allUrErr } = await adminSupabase
      .schema("rbac")
      .from("user_role")
      .select("user_id, role_id");
    expect(allUrErr).toBeNull();
    expect(allUserRoles?.some((r) => r.user_id === staffUser.id)).toBe(true);
    expect(allUserRoles?.some((r) => r.user_id === sysAdminUser.id)).toBe(true);

    const { error: directDeleteErr } = await adminSupabase
      .schema("rbac")
      .from("user_role")
      .delete()
      .eq("user_id", staffUser.id);
    expect(directDeleteErr).not.toBeNull();
  });
});

