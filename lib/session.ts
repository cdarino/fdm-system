import "server-only";

import { cache } from "react";
import { getUserInfo } from "@/lib/user";
import { getCurrentUserRoleNames } from "@/lib/actions/check-user";
import { getUserPermissions } from "@/lib/permissions";
import { SYSTEM_ADMIN_ROLE } from "@/lib/self-protection";
import type { UserSession } from "@/lib/types/session";

export const getUserSession = cache(async (): Promise<UserSession> => {
  // Fetch user, roles, and permissions in parallel to avoid sequential round trips.
  const [user, roles, permissions] = await Promise.all([
    getUserInfo(),
    getCurrentUserRoleNames(),
    getUserPermissions(),
  ]);

  const isSystemAdmin =
    roles.includes(SYSTEM_ADMIN_ROLE) || permissions.includes("system.create");

  return {
    user: user
      ? {
          id: user.id,
          email: user.email,
          user_metadata: user.user_metadata,
          app_metadata: user.app_metadata,
        }
      : null,
    roles,
    permissions,
    isSystemAdmin,
  };
});
