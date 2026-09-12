import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import { hasPermission, getUserPermissions } from "@/lib/permissions";
import { getAuthorizedCaller, requirePermission } from "@/lib/actions/auth-guard";
import { createClient } from "@/lib/actions/clients";
import { createPropertyLot } from "@/lib/actions/properties";
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
    await expect(
      createClient({ full_name: faker.person.fullName() })
    ).rejects.toThrow("Forbidden: You do not have permission 'clients.create'.");

    // Attempting to create property lot without properties.create
    await expect(
      createPropertyLot({
        location: "Forbidden Location",
        block_number: 1,
        lot_number: 1,
        area_size: 100,
        price_per_sqm: 1000,
      })
    ).rejects.toThrow("Forbidden: You do not have permission 'properties.create'.");
  });
});
