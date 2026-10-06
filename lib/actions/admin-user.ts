"use server";

import { createScope } from "@/lib/actions/action-handler";
import type { ActionResult } from "@/lib/actions/action-result";
import { AuthError } from "@supabase/supabase-js";
import type { RbacRole } from "@/lib/actions/admin-roles";
import { checkSelfDeactivate, checkSelfDelete } from "@/lib/self-protection";
import { uuidSchema } from "@/lib/validations/client";
import {
  createUserSchema,
  updateUserProfileActionSchema,
  toggleUserActionSchema,
} from "@/lib/validations/user";

export interface RegisterUserParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  /** Zero or more rbac.role.id values to assign immediately after creation. */
  roleIds?: string[];
}

export type RegisterUserResult = {
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

export type DeleteUserResult = { success: true };
export type UpdateUserProfileResult = { success: true };

const adminRead = createScope(["system.read"], { admin: true });
const adminCreate = adminRead.extend(["system.create"]);
const adminUpdate = adminRead.extend(["system.update"]);
const adminDelete = adminRead.extend(["system.delete"]);

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
  params: unknown
): Promise<ActionResult<RegisterUserResult>> {
  return adminCreate.run({
    schema: createUserSchema,
    input: params,
    handler: async (validated, { supabase: adminClient }) => {
      const { data: createData, error: createError } =
        await adminClient.auth.admin.createUser({
          email: validated.email,
          password: validated.password,
          email_confirm: true,
          user_metadata: {
            first_name: validated.firstName,
            last_name: validated.lastName,
          },
        });

      if (createError) {
        throw new Error(describeCreateUserError(createError));
      }

      const newUserId = createData.user.id;

      if (validated.roleIds.length > 0) {
        const uniqueRoleIds = Array.from(new Set(validated.roleIds));
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

      return { userId: newUserId };
    },
  });
}

export async function toggleUser(userId: string, enable: boolean): Promise<ActionResult<{ success: true }>> {
  return adminUpdate.run({
    schema: toggleUserActionSchema,
    input: { userId, enable },
    handler: async ({ userId: targetUserId, enable: isEnabled }, { supabase: adminClient, userId: callerId }) => {
      // Guard against an admin locking themselves out
      const deactivateError = checkSelfDeactivate(callerId, targetUserId, isEnabled);
      if (deactivateError) {
        throw new Error(deactivateError);
      }

      const ban_duration = isEnabled ? "0h" : "876000h";
      const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration,
      });

      if (error) {
        throw new Error(error.message);
      }

      return { success: true };
    },
  });
}

export async function listUsers(): Promise<ListUsersResult> {
  return adminRead.query(async ({ supabase: adminClient }) => {
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
  });
}

export async function deleteUser(userId: string): Promise<ActionResult<DeleteUserResult>> {
  return adminDelete.run({
    schema: uuidSchema,
    input: userId,
    handler: async (targetUserId, { supabase: adminClient, userId: callerId }) => {
      const selfDeleteError = checkSelfDelete(callerId, targetUserId);
      if (selfDeleteError) {
        throw new Error(selfDeleteError);
      }

      // Remove associated RBAC role mappings first
      const { error: rolesError } = await adminClient
        .schema("rbac")
        .from("user_role")
        .delete()
        .eq("user_id", targetUserId);

      if (rolesError) {
        throw new Error(`Role cleanup error: ${rolesError.message}`);
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return { success: true };
    },
  });
}

export async function updateUserProfile(
  userId: string,
  firstName: string,
  lastName: string
): Promise<ActionResult<UpdateUserProfileResult>> {
  return adminUpdate.run({
    schema: updateUserProfileActionSchema,
    input: { userId, firstName, lastName },
    handler: async ({ userId: targetUserId, firstName: first, lastName: last }, { supabase: adminClient }) => {
      const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
        user_metadata: {
          first_name: first,
          last_name: last,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return { success: true };
    },
  });
}
