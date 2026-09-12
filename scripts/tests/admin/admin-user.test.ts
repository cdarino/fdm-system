import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import {
  registerUser,
  listUsers,
  updateUserProfile,
  toggleUser,
  deleteUser,
} from "@/lib/actions/admin-user";
import { getActiveRoles } from "@/lib/actions/admin-roles";
import { SELF_DEACTIVATE_ERROR, SELF_DELETE_ERROR } from "@/lib/self-protection";
import {
  loginAsAdmin,
  logoutUser,
  getTestAdminClient,
  createTemporaryUser,
  runTrackedCleanups,
  trackCleanup,
  type TemporaryUser,
} from "../framework/session";

describe("Admin User Management Actions", () => {
  const createdUserIds: string[] = [];
  let targetUser: TemporaryUser;

  beforeAll(async () => {
    targetUser = await createTemporaryUser({
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
    });
    createdUserIds.push(targetUser.id);
  });

  beforeEach(async () => {
    await logoutUser();
  });

  afterAll(async () => {
    const adminClient = getTestAdminClient();
    for (const id of createdUserIds) {
      try {
        await adminClient.schema("rbac").from("user_role").delete().eq("user_id", id);
        await adminClient.auth.admin.deleteUser(id);
      } catch {
        // Ignore residual delete errors
      }
    }
    await logoutUser();
    await runTrackedCleanups();
  });

  it("registerUser rejects when unauthenticated", async () => {
    const res = await registerUser({
      email: faker.internet.email(),
      password: "TempPassword123!",
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("You must be logged in");
    }
  });

  it("registerUser creates a user with metadata and roles when authorized as admin", async () => {
    await loginAsAdmin();
    const roles = await getActiveRoles();
    const billingRole = roles.find((r) => r.name === "billing_staff");
    const roleIds = billingRole ? [billingRole.id] : [];

    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName }).toLowerCase();

    const res = await registerUser({
      email,
      password: "ValidAdminPassword123!",
      firstName,
      lastName,
      roleIds,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      createdUserIds.push(res.userId);
      trackCleanup(async () => {
        await deleteUser(res.userId);
      });

      const listRes = await listUsers();
      expect(listRes.success).toBe(true);
      if (listRes.success) {
        const found = listRes.users.find((u) => u.id === res.userId);
        expect(found).toBeDefined();
        expect(found?.firstName).toBe(firstName);
        expect(found?.lastName).toBe(lastName);
        if (billingRole) {
          expect(found?.roles.some((r) => r.id === billingRole.id)).toBe(true);
        }
      }
    }
  });

  it("registerUser returns descriptive error when email already exists", async () => {
    await loginAsAdmin();
    const existingEmail = `duplicate-${Date.now()}@example.com`;

    const first = await registerUser({
      email: existingEmail,
      password: "ValidPassword123!",
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
    });
    expect(first.success).toBe(true);
    if (first.success) createdUserIds.push(first.userId);

    const second = await registerUser({
      email: existingEmail,
      password: "ValidPassword123!",
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
    });

    expect(second.success).toBe(false);
    if (!second.success) {
      expect(second.error).toContain("already exists");
    }
  });

  it("registerUser returns descriptive error on invalid email format", async () => {
    await loginAsAdmin();
    const res = await registerUser({
      email: "invalid-email-format",
      password: "ValidPassword123!",
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("That email address is not valid");
    }
  });

  it("listUsers returns full user list with roles and ban flags for admin", async () => {
    await loginAsAdmin();
    const res = await listUsers();

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.users.length).toBeGreaterThan(0);
      const admin = res.users.find((u) => u.email === "admin@example.com");
      expect(admin).toBeDefined();
      expect(admin?.roles.some((r) => r.name === "system_admin")).toBe(true);
      expect(typeof admin?.isBanned).toBe("boolean");
    }
  });

  it("updateUserProfile updates user first and last name", async () => {
    await loginAsAdmin();
    const updatedFirst = faker.person.firstName();
    const updatedLast = faker.person.lastName();

    const updateRes = await updateUserProfile(targetUser.id, updatedFirst, updatedLast);
    expect(updateRes.success).toBe(true);

    const listRes = await listUsers();
    if (listRes.success) {
      const updatedUser = listRes.users.find((u) => u.id === targetUser.id);
      expect(updatedUser?.firstName).toBe(updatedFirst);
      expect(updatedUser?.lastName).toBe(updatedLast);
    }
  });

  it("toggleUser blocks admin from deactivating their own account", async () => {
    const adminSession = await loginAsAdmin();
    const adminId = adminSession.user.id;

    const res = await toggleUser(adminId, false);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe(SELF_DEACTIVATE_ERROR);
    }
  });

  it("toggleUser deactivates and reactivates a target user", async () => {
    await loginAsAdmin();

    // Deactivate user
    const deactivateRes = await toggleUser(targetUser.id, false);
    expect(deactivateRes.success).toBe(true);

    let listRes = await listUsers();
    if (listRes.success) {
      const found = listRes.users.find((u) => u.id === targetUser.id);
      expect(found?.isBanned).toBe(true);
    }

    // Reactivate user
    const reactivateRes = await toggleUser(targetUser.id, true);
    expect(reactivateRes.success).toBe(true);

    listRes = await listUsers();
    if (listRes.success) {
      const found = listRes.users.find((u) => u.id === targetUser.id);
      expect(found?.isBanned).toBe(false);
    }
  });

  it("deleteUser blocks admin from deleting their own account", async () => {
    const adminSession = await loginAsAdmin();
    const adminId = adminSession.user.id;

    const res = await deleteUser(adminId);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe(SELF_DELETE_ERROR);
    }
  });

  it("deleteUser removes user and their associated roles", async () => {
    await loginAsAdmin();

    const deleteRes = await deleteUser(targetUser.id);
    expect(deleteRes.success).toBe(true);

    const listRes = await listUsers();
    if (listRes.success) {
      const found = listRes.users.find((u) => u.id === targetUser.id);
      expect(found).toBeUndefined();
    }
  });
});
