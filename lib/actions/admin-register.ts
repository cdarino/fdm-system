/**
 * lib/actions/admin-register.ts
 *
 * Server actions for registering / managing Supabase Auth users and RBAC roles.
 *
 * All functions require the caller to hold the `system.create` permission
 * (granted by the `system_admin` role), except `getActiveRoles`.
 */

"use server";

import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AuthError } from "@supabase/supabase-js";

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

export interface UserListItem {
  id: string;
  email: string;
  roles: Pick<RbacRole, "id" | "name">[];
  isBanned: boolean;
}

export type ListUsersResult =
  | { success: true; users: UserListItem[] }
  | { success: false; error: string };

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
  const caller = await getAuthorizedCaller();
  if ("error" in caller) return { success: false, error: caller.error };

  if (!roleIds.length) return { success: true }; // nothing to do

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
  const caller = await getAuthorizedCaller();
  if ("error" in caller) {
    console.error("[getActiveRoles] unauthorized:", caller.error);
    return [];
  }

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

/*
  Activates/deactives a user by their userId.
  `true` is to activate.
  `false is to deactivate.
*/
export async function toggleUser(userId: string, enable: boolean) {

  const caller = await getAuthorizedCaller();
  if ("error" in caller) return { success: false, error: caller.error };

  const adminClient = createAdminClient();

  let error_main: AuthError | null = null;

  if (enable) {
    let { error } = await adminClient.auth.admin.updateUserById(userId, {
      // Workaround: to disable a user, ban them for a very long time.
      ban_duration: '0h'
    });
    error_main = error;
  } else {
    let { error } = await adminClient.auth.admin.updateUserById(userId, {
      ban_duration: '876000h'
    });
    error_main = error;
  }

  if (error_main) {
    console.error("[toggleUser] error: ", error_main.message);
    return { success: false, error: error_main.message };
  }

  return { success: true };
}

/**
 * Returns every Auth user with their email, assigned RBAC roles, and ban status.
 * Requires `system.create` permission.
 */
export async function listUsers(): Promise<ListUsersResult> {
  const caller = await getAuthorizedCaller();
  if ("error" in caller) return { success: false, error: caller.error };

  const adminClient = createAdminClient();

  // Collect all auth users across pages
  const allAuthUsers: { id: string; email: string; banned_until?: string | null }[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("[listUsers] listUsers error:", error.message);
      return { success: false, error: error.message };
    }

    allAuthUsers.push(
      ...data.users.map((u) => ({
        id: u.id,
        email: u.email ?? "",
        banned_until: u.banned_until,
      }))
    );

    if (data.users.length < perPage) break;
    page++;
  }

  // Fetch all user→role mappings in one query
  const { data: userRoles, error: rolesError } = await adminClient
    .schema("rbac")
    .from("user_role")
    .select("user_id, role:role_id(id, name)")
    .returns<{ user_id: string; role: Pick<RbacRole, "id" | "name"> | null }[]>();

  if (rolesError) {
    console.error("[listUsers] user_role fetch error:", rolesError.message);
    return { success: false, error: rolesError.message };
  }

  // Build a lookup: userId → roles[] (FK join returns a single object per row, not an array)
  const rolesByUser = (userRoles ?? []).reduce((map, row) => {
    if (row.role) map.set(row.user_id, [...(map.get(row.user_id) ?? []), row.role]);
    return map;
  }, new Map<string, Pick<RbacRole, "id" | "name">[]>());

  const now = new Date();
  const users: UserListItem[] = allAuthUsers.map((u) => ({
    id: u.id,
    email: u.email,
    roles: rolesByUser.get(u.id) ?? [],
    // A user is considered banned when banned_until is set and in the future
    isBanned: !!u.banned_until && new Date(u.banned_until) > now,
  }));

  return { success: true, users };
}
