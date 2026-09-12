import { describe, it, expect } from "vitest";
import { roleLabel } from "@/lib/role-labels";
import { deriveColor } from "@/lib/color";
import { cn, hasEnvVars } from "@/lib/utils";
import {
  checkSelfDeactivate,
  checkSelfDelete,
  checkSelfDemote,
  SELF_DEACTIVATE_ERROR,
  SELF_DELETE_ERROR,
  SELF_DEMOTE_ERROR,
} from "@/lib/self-protection";

describe("Utility and Pure Guard Functions", () => {
  it("roleLabel returns formatted human-readable labels for known roles", () => {
    expect(roleLabel("system_admin")).toBe("System Administrator");
    expect(roleLabel("admin_staff")).toBe("Admin Staff");
    expect(roleLabel("billing_staff")).toBe("Billing Staff");
    expect(roleLabel("legal_staff")).toBe("Legal Staff");
    expect(roleLabel("accounting_staff")).toBe("Accounting Staff");
  });

  it("roleLabel falls back to title casing for unknown or custom slugs", () => {
    expect(roleLabel("property_inspector")).toBe("Property Inspector");
    expect(roleLabel("audit-officer")).toBe("Audit Officer");
    expect(roleLabel("senior_lead_auditor")).toBe("Senior Lead Auditor");
  });

  it("deriveColor creates CSS color-mix strings with white or black", () => {
    expect(deriveColor("primary", 0.15)).toBe("color-mix(in srgb, var(--primary) 15%, white)");
    expect(deriveColor("success", 0.2)).toBe("color-mix(in srgb, var(--success) 20%, white)");
    expect(deriveColor("destructive", -0.15)).toBe("color-mix(in srgb, var(--destructive) 85%, black)");
  });

  it("cn merges Tailwind and conditional class names correctly", () => {
    expect(cn("px-2 py-1", "bg-primary", { hidden: false, block: true })).toBe("px-2 py-1 bg-primary block");
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it("hasEnvVars evaluates to truthy when Supabase URL and key are provided", () => {
    expect(Boolean(hasEnvVars)).toBe(true);
  });

  it("checkSelfDeactivate blocks self deactivation but allows reactivation", () => {
    const callerId = "user-123";
    expect(checkSelfDeactivate(callerId, callerId, false)).toBe(SELF_DEACTIVATE_ERROR);
    expect(checkSelfDeactivate(callerId, callerId, true)).toBe(null);
    expect(checkSelfDeactivate(callerId, "other-user", false)).toBe(null);
  });

  it("checkSelfDelete blocks an admin from deleting their own account", () => {
    const callerId = "user-123";
    expect(checkSelfDelete(callerId, callerId)).toBe(SELF_DELETE_ERROR);
    expect(checkSelfDelete(callerId, "other-user")).toBe(null);
  });

  it("checkSelfDemote prevents an admin from stripping their own system_admin role", () => {
    const callerId = "admin-user-1";
    const systemAdminRoleId = "role-sysadmin-id";
    const staffRoleId = "role-staff-id";

    // Dropping system_admin while caller is target
    expect(checkSelfDemote(callerId, callerId, systemAdminRoleId, [staffRoleId])).toBe(SELF_DEMOTE_ERROR);
    // Retaining system_admin
    expect(checkSelfDemote(callerId, callerId, systemAdminRoleId, [systemAdminRoleId, staffRoleId])).toBe(null);
    // Demoting another user
    expect(checkSelfDemote(callerId, "other-admin", systemAdminRoleId, [staffRoleId])).toBe(null);
    // System admin role absent
    expect(checkSelfDemote(callerId, callerId, null, [staffRoleId])).toBe(null);
  });
});
