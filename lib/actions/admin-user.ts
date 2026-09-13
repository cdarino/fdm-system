"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthorizedCaller } from "@/lib/actions/auth-guard";
import { AuthError } from "@supabase/supabase-js";
import type { RbacRole } from "@/lib/actions/admin-roles";
import { checkSelfDeactivate, checkSelfDelete } from "@/lib/self-protection";

export interface RegisterUserParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  /** Zero or more rbac.role.id values to assign immediately after creation. */
  roleIds?: string[];
}

export type RegisterUserResult = {
  success: true;
  userId: string;
};

export interface UserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Pick<RbacRole, "id" | "name">[];
  isBanned: boolean;
}

export type ListUsersResult = {
  success: true;
  users: UserListItem[];
};

/**
 * Turns Supabase's raw auth errors into something an admin can act on.
 *
 * Testers hit the duplicate-email case repeatedly and only saw the raw message,
 * which read like a system fault rather than "this account already exists".
 */
function describeCreateUserError(error: AuthError): string {
  const code = (error as AuthError & { code?: string }).code;
  const message = error.message.toLowerCase();

  if (code === "email_exists" || message.includes("already been registered") || message.includes("already exists")) {
    return "An account with this email address already exists. Search for it in the user list instead of creating a new one.";
  }

  if (code === "weak_password" || message.includes("password")) {
    return `Password rejected: ${error.message}`;
  }

  if (message.includes("invalid") && message.includes("email")) {
    return "That email address is not valid. Check it and try again.";
  }

  return error.message;
}

export async function registerUser(
  params: RegisterUserParams
): Promise<RegisterUserResult> {
  const { email, password, firstName, lastName, roleIds = [] } = params;

  const caller = await getAuthorizedCaller();
  if ("error" in caller) throw new Error(caller.error);

  const adminClient = createAdminClient();

  const { data: createData, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

  if (createError) {
    throw new Error(describeCreateUserError(createError));
  }

  const newUserId = createData.user.id;

  if (roleIds.length > 0) {
    const uniqueRoleIds = Array.from(new Set(roleIds));
    const { error: roleError } = await adminClient
      .schema("rbac")
      .rpc("set_user_roles", {
        p_user_id: newUserId,
        p_role_ids: uniqueRoleIds,
      });

    if (roleError) {
      // Revert created auth user to maintain atomicity and avoid orphaned accounts
      await adminClient.auth.admin.deleteUser(newUserId);
      throw new Error(`Role assignment failed: ${roleError.message}`);
    }
  }

  return { success: true, userId: newUserId };
}

export async function toggleUser(userId: string, enable: boolean): Promise<{ success: true }> {
  const caller = await getAuthorizedCaller();
  if ("error" in caller) throw new Error(caller.error);

  // Guard against an admin locking themselves out. Enforced here rather than
  // only in the UI so it still holds if the action is called directly.
  const deactivateError = checkSelfDeactivate(caller.id, userId, enable);
  if (deactivateError) {
    throw new Error(deactivateError);
  }

  const adminClient = createAdminClient();
  const ban_duration = enable ? "0h" : "876000h";
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

export async function listUsers(): Promise<ListUsersResult> {
  const caller = await getAuthorizedCaller();
  if ("error" in caller) throw new Error(caller.error);

  const adminClient = createAdminClient();

  const allAuthUsers: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    banned_until?: string | null;
  }[] = [];
  let page = 1;
  const perPage = 1000;
  const maxPages = 10;

  while (page <= maxPages) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(error.message);
    }

    allAuthUsers.push(
      ...data.users.map((u) => ({
        id: u.id,
        email: u.email ?? "",
        first_name: (u.user_metadata as Record<string, string> | null)?.first_name ?? "",
        last_name: (u.user_metadata as Record<string, string> | null)?.last_name ?? "",
        banned_until: u.banned_until,
      }))
    );

    if (data.users.length < perPage) break;
    page++;
  }

  const userIds = allAuthUsers.map((u) => u.id);
  let userRoles: { user_id: string; role: Pick<RbacRole, "id" | "name"> | null }[] = [];

  if (userIds.length > 0) {
    const { data: rolesData, error: rolesError } = await adminClient
      .schema("rbac")
      .from("user_role")
      .select("user_id, role:role_id(id, name)")
      .in("user_id", userIds)
      .returns<{ user_id: string; role: Pick<RbacRole, "id" | "name"> | null }[]>();

    if (rolesError) {
      throw new Error(rolesError.message);
    }
    userRoles = rolesData ?? [];
  }

  const rolesByUser = userRoles.reduce((map, row) => {
    if (row.role) map.set(row.user_id, [...(map.get(row.user_id) ?? []), row.role]);
    return map;
  }, new Map<string, Pick<RbacRole, "id" | "name">[]>());

  const now = new Date();
  const users: UserListItem[] = allAuthUsers.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.first_name,
    lastName: u.last_name,
    roles: rolesByUser.get(u.id) ?? [],
    isBanned: !!u.banned_until && new Date(u.banned_until) > now,
  }));

  return { success: true, users };
}

export type DeleteUserResult = { success: true };

export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  const caller = await getAuthorizedCaller();
  if ("error" in caller) throw new Error(caller.error);

  const selfDeleteError = checkSelfDelete(caller.id, userId);
  if (selfDeleteError) {
    throw new Error(selfDeleteError);
  }

  const adminClient = createAdminClient();

  // Remove associated RBAC role mappings first (in case there is no ON DELETE CASCADE)
  const { error: rolesError } = await adminClient
    .schema("rbac")
    .from("user_role")
    .delete()
    .eq("user_id", userId);

  if (rolesError) {
    throw new Error(`Role cleanup error: ${rolesError.message}`);
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  return { success: true };
}

export type UpdateUserProfileResult = { success: true };

export async function updateUserProfile(
  userId: string,
  firstName: string,
  lastName: string
): Promise<UpdateUserProfileResult> {
  const caller = await getAuthorizedCaller();
  if ("error" in caller) throw new Error(caller.error);

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}
