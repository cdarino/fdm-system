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
import { getPaginationOffsets, buildPaginatedResult } from "@/lib/pagination";
import { formatActivityTime } from "@/lib/format-activity-time";

describe("Utility and Pure Guard Functions", () => {
  it("getPaginationOffsets computes SQL query range and clamps page/limit", () => {
    expect(getPaginationOffsets()).toEqual({ page: 1, limit: 10, from: 0, to: 9 });
    expect(getPaginationOffsets({ page: 2, limit: 10 })).toEqual({ page: 2, limit: 10, from: 10, to: 19 });
    expect(getPaginationOffsets({ page: -5, limit: 0 }, 15)).toEqual({ page: 1, limit: 15, from: 0, to: 14 });
    expect(getPaginationOffsets({ page: 3, limit: 25 })).toEqual({ page: 3, limit: 25, from: 50, to: 74 });
  });

  it("buildPaginatedResult constructs standardized paginated structure", () => {
    const items = ["a", "b", "c"];
    const res = buildPaginatedResult(items, 25, 2, 10);
    expect(res).toEqual({
      data: items,
      totalCount: 25,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
  });
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

  it("formatActivityTime formats relative times and dates older than 7 days correctly", () => {
    const now = new Date();

    // Just now
    expect(formatActivityTime(now)).toBe("just now");

    // Minutes ago
    const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
    expect(formatActivityTime(tenMinsAgo)).toBe("10 minutes ago");

    // 1 minute ago
    const oneMinAgo = new Date(now.getTime() - 60 * 1000);
    expect(formatActivityTime(oneMinAgo)).toBe("1 minute ago");

    // Hours ago
    const threeHoursAgo = new Date(now.getTime() - 3 * 3600 * 1000);
    expect(formatActivityTime(threeHoursAgo)).toBe("3 hours ago");

    // Days ago (<= 7 days)
    const fiveDaysAgo = new Date(now.getTime() - 5 * 86400 * 1000);
    expect(formatActivityTime(fiveDaysAgo)).toBe("5 days ago");

    // Older than 7 days
    const twentyDaysAgo = new Date(now.getTime() - 20 * 86400 * 1000);
    const expectedFormatted = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(twentyDaysAgo);
    expect(formatActivityTime(twentyDaysAgo)).toBe(expectedFormatted);
  });
});
