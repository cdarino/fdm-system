import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import { getActiveRoles, setUserRoles } from "@/lib/actions/admin-roles";
import {
  checkIsSystemAdmin,
  getIsCurrentUserSystemAdmin,
  getCurrentUserRoleNames,
  getCurrentUserRoleSections,
} from "@/lib/actions/check-user";
import { SELF_DEMOTE_ERROR } from "@/lib/self-protection";
import {
  loginAsAdmin,
  loginAs,
  logoutUser,
  createTemporaryUser,
  runTrackedCleanups,
  type TemporaryUser,
} from "../framework/session";

describe("Admin Roles & User Role Inspection Actions", () => {
  let tempUser: TemporaryUser;

  beforeAll(async () => {
    tempUser = await createTemporaryUser({
      emailPrefix: faker.internet.username().toLowerCase(),
    });
  });

  beforeEach(async () => {
    await logoutUser();
  });

  afterAll(async () => {
    await logoutUser();
    await runTrackedCleanups();
  });

  it("getActiveRoles returns empty array when unauthenticated", async () => {
    const roles = await getActiveRoles();
    expect(roles).toEqual([]);
  });

  it("getActiveRoles returns all system roles for authorized admin", async () => {
    await loginAsAdmin();
    const roles = await getActiveRoles();

    expect(roles.length).toBeGreaterThanOrEqual(5);
    const roleNames = roles.map((r) => r.name);
    expect(roleNames).toContain("system_admin");
    expect(roleNames).toContain("admin_staff");
    expect(roleNames).toContain("billing_staff");
    expect(roleNames).toContain("legal_staff");
    expect(roleNames).toContain("accounting_staff");
  });

  it("setUserRoles rejects unauthorized caller", async () => {
    const res = await setUserRoles(tempUser.id, []);

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("You must be logged in");
    }
  });

  it("setUserRoles prevents admin from removing their own system_admin role", async () => {
    const adminSession = await loginAsAdmin();
    const adminId = adminSession.user.id;

    const roles = await getActiveRoles();
    const billingRole = roles.find((r) => r.name === "billing_staff")!;

    const res = await setUserRoles(adminId, [billingRole.id]);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe(SELF_DEMOTE_ERROR);
    }
  });

  it("setUserRoles assigns roles to a target user and updates their permissions", async () => {
    await loginAsAdmin();

    const roles = await getActiveRoles();
    const legalRole = roles.find((r) => r.name === "legal_staff")!;

    const assignRes = await setUserRoles(tempUser.id, [legalRole.id]);
    expect(assignRes.success).toBe(true);

    // Switch session to temp user and inspect roles
    await loginAs(tempUser.email, tempUser.password);

    const userRoles = await getCurrentUserRoleNames();
    expect(userRoles).toContain("legal_staff");
    expect(userRoles.length).toBe(1);
  });

  it("checkIsSystemAdmin identifies admin vs non-admin user IDs", async () => {
    const adminSession = await loginAsAdmin();

    const isAdmin = await checkIsSystemAdmin(adminSession.user.id);
    expect(isAdmin).toBe(true);

    const isTempAdmin = await checkIsSystemAdmin(tempUser.id);
    expect(isTempAdmin).toBe(false);
  });

  it("getIsCurrentUserSystemAdmin reflects active session status", async () => {
    // Unauthenticated
    let isAdmin = await getIsCurrentUserSystemAdmin();
    expect(isAdmin).toBe(false);

    // Admin session
    await loginAsAdmin();
    isAdmin = await getIsCurrentUserSystemAdmin();
    expect(isAdmin).toBe(true);

    // Temp non-admin user session
    await loginAs(tempUser.email, tempUser.password);
    isAdmin = await getIsCurrentUserSystemAdmin();
    expect(isAdmin).toBe(false);
  });

  it("getCurrentUserRoleSections returns full suite for admin and scoped sections for role-specific user", async () => {
    // Admin user receives all department sections
    await loginAsAdmin();
    const adminSections = await getCurrentUserRoleSections();
    const categories = adminSections.map((s) => s.category);
    expect(categories).toContain("Administration");
    expect(categories).toContain("Billing");
    expect(categories).toContain("Accounting");
    expect(categories).toContain("Legal");

    // Staff user with billing_staff only receives Billing section
    tempUser = await createTemporaryUser({ roleNames: ["billing_staff"] });
    await loginAs(tempUser.email, tempUser.password);

    const staffSections = await getCurrentUserRoleSections();
    expect(staffSections.length).toBe(1);
    expect(staffSections[0].category).toBe("Billing");
  });
});
