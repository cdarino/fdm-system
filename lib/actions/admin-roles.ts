"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/actions/auth-guard";
import { checkSelfDemote, SYSTEM_ADMIN_ROLE } from "@/lib/self-protection";
import {
  type ActionResult,
  actionSuccess,
  actionError,
} from "@/lib/actions/action-result";

export interface RbacRole {
  id: string;
  name: string;
  description: string | null;
}

export type SetUserRolesResult = { success: true };

export async function getActiveRoles(): Promise<RbacRole[]> {
  await requirePermission("system.create");

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .schema("rbac")
    .from("role")
    .select("id, name, description")
    .eq("active", true)
    .order("name");

  if (error) {
    throw new Error(`Failed to fetch active roles: ${error.message}`);
  }

  return (data ?? []) as RbacRole[];
}

export async function setUserRoles(
  userId: string,
  roleIds: string[]
): Promise<ActionResult<SetUserRolesResult>> {
  try {
    const callerId = await requirePermission("system.create");

    const adminClient = createAdminClient();
    const uniqueRoleIds = Array.from(new Set(roleIds));

    // Stop an admin from stripping their own system_admin role
    if (userId.toLowerCase() === callerId.toLowerCase()) {
      const { data: adminRole, error: roleLookupError } = await adminClient
        .schema("rbac")
        .from("role")
        .select("id")
        .eq("name", SYSTEM_ADMIN_ROLE)
        .maybeSingle<{ id: string }>();

      if (roleLookupError) {
        return actionError(`Role lookup failed: ${roleLookupError.message}`);
      }

      const demoteError = checkSelfDemote(
        callerId,
        userId,
        adminRole?.id ?? null,
        uniqueRoleIds,
      );
      if (demoteError) {
        return actionError(demoteError);
      }
    }

    const { error: rpcError } = await adminClient
      .schema("rbac")
      .rpc("set_user_roles", {
        p_user_id: userId,
        p_role_ids: uniqueRoleIds,
      });

    if (rpcError) {
      return actionError(`Failed to set user roles: ${rpcError.message}`);
    }

    return actionSuccess({ success: true });
  } catch (error) {
    return actionError(error instanceof Error ? error.message : "Failed to set user roles");
  }
}
