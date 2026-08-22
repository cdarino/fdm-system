/**
 * lib/actions/admin-register.ts
 *
 * This file contains server actions for registering a new Supabase Auth user
 * and managing role assignments.
 * 
 * Please note that the caller of any of the functions here should have 
 * the "system.create" permission (provided by the `system_admin` role).
 *
 */

"use server";

import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RegisterUserParams {
  email: string;
  password: string;
  /** Zero or more rbac.role.id values to assign immediately after creation. */
  roleIds?: string[];
}

export type RegisterUserResult =
  | { success: true; userId: string }
  | { success: false; error: string };

export type AssignRolesResult =
  | { success: true }
  | { success: false; error: string };

export interface RbacRole {
  id: string;
  name: string;
  description: string | null;
}

async function getAuthorizedCaller(): Promise<
  { id: string } | { error: string }
> {
  const serverClient = await createClient();
  const {
    data: { user: caller },
  } = await serverClient.auth.getUser();

  if (!caller) {
    return { error: "You must be logged in to perform this action." };
  }

  const allowed = await hasPermission("system.create", caller.id);
  if (!allowed) {
    return {
      error: "Access denied. You do not have permission to manage users.",
    };
  }

  return { id: caller.id };
}

/**
 * Assigns one or more RBAC roles to an existing user.
 *
 * - Requires the caller to have `system.create` permission.
 * - Safe to call multiple times (upserts on conflict).
 *
 * @param userId  UUID of the target user in auth.users.
 * @param roleIds Array of rbac.role.id values to assign.
 */
export async function assignRoles(
  userId: string,
  roleIds: string[]
): Promise<AssignRolesResult> {
  if (!roleIds.length) return { success: true }; // nothing to do

  const caller = await getAuthorizedCaller();
  if ("error" in caller) return { success: false, error: caller.error };

  const adminClient = createAdminClient();

  const rows = roleIds.map((roleId) => ({ user_id: userId, role_id: roleId }));

  const { error } = await adminClient
    .schema("rbac")
    .from("user_role")
    .upsert(rows, { onConflict: "user_id,role_id" });

  if (error) {
    console.error("[assignRoles] error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Creates a new Supabase Auth user and optionally assigns multiple roles.
 */
export async function registerUser(
  params: RegisterUserParams
): Promise<RegisterUserResult> {
  const { email, password, roleIds = [] } = params;

  // 1. Auth + permission check
  const caller = await getAuthorizedCaller();
  if ("error" in caller) return { success: false, error: caller.error };

  // 2. Create the user via the Admin API (bypasses disabled sign-ups)
  const adminClient = createAdminClient();

  const { data: createData, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError) {
    console.error("[registerUser] createUser error:", createError.message);
    return { success: false, error: createError.message };
  }

  const newUserId = createData.user.id;

  // 3. Optionally assign roles (delegates to the standalone action)
  if (roleIds.length > 0) {
    const roleResult = await assignRoles(newUserId, roleIds);
    if (!roleResult.success) {
      // Non-fatal: user was created; surface a clear message with the user ID.
      const { error: roleError } = roleResult;
      return {
        success: false,
        error: `User created (${newUserId}), but role assignment failed: ${roleError}`,
      };
    }
  }

  return { success: true, userId: newUserId };
}

/**
 * Returns all active roles from rbac.role, ordered by name.
 * Called from Server Components to avoid an extra client round-trip.
 */
export async function getActiveRoles(): Promise<RbacRole[]> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .schema("rbac")
    .from("role")
    .select("id, name, description")
    .eq("active", true)
    .order("name");

  if (error) {
    console.error("[getActiveRoles] error:", error.message);
    return [];
  }

  return (data ?? []) as RbacRole[];
}
