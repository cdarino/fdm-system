"use server";

import { createScope } from "@/lib/actions/action-handler";
import type { ActionResult } from "@/lib/actions/action-result";
import { checkSelfDemote, SYSTEM_ADMIN_ROLE } from "@/lib/self-protection";
import { setUserRolesActionSchema } from "@/lib/validations/user";

export interface RbacRole {
  id: string;
  name: string;
  description: string | null;
}

export type SetUserRolesResult = { success: true };

const adminRead = createScope(["system.read"], { admin: true });
const adminUpdate = createScope(["system.update"], { admin: true });

export async function getActiveRoles(): Promise<RbacRole[]> {
  return adminRead.query(async ({ supabase: adminClient }) => {
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
  });
}

export async function setUserRoles(
  userId: string,
  roleIds: string[]
): Promise<ActionResult<SetUserRolesResult>> {
  return adminUpdate.run({
    schema: setUserRolesActionSchema,
    input: { userId, roleIds },
    handler: async ({ userId: targetUserId, roleIds: ids }, { supabase: adminClient, userId: callerId }) => {
      const uniqueRoleIds = Array.from(new Set(ids));

      // Stop an admin from stripping their own system_admin role
      if (targetUserId.toLowerCase() === callerId.toLowerCase()) {
        const { data: adminRole, error: roleLookupError } = await adminClient
          .schema("rbac")
          .from("role")
          .select("id")
          .eq("name", SYSTEM_ADMIN_ROLE)
          .maybeSingle<{ id: string }>();

        if (roleLookupError) {
          throw new Error(`Role lookup failed: ${roleLookupError.message}`);
        }

        const demoteError = checkSelfDemote(
          callerId,
          targetUserId,
          adminRole?.id ?? null,
          uniqueRoleIds
        );
        if (demoteError) {
          throw new Error(demoteError);
        }
      }

      const { error: rpcError } = await adminClient
        .schema("rbac")
        .rpc("set_user_roles", {
          p_user_id: targetUserId,
          p_role_ids: uniqueRoleIds,
        });

      if (rpcError) {
        throw new Error(`Failed to set user roles: ${rpcError.message}`);
      }

      return { success: true };
    },
  });
}
