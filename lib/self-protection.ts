/**
 * Guards that stop a system administrator from locking themselves out.
 *
 * During user testing a tester deactivated the shared admin account and the
 * team could no longer sign in ("after testing, cannot login admin anymore").
 * These rules are enforced in the server actions as well as reflected in the
 * UI, so they still hold if an action is invoked directly.
 *
 * The checks are pure functions so the decision logic can be exercised
 * directly. Plain module (no "use server") because a server-action module may
 * only export async functions, and both the actions and the client UI import
 * from here.
 */

export const SYSTEM_ADMIN_ROLE = "system_admin";

export const SELF_DEACTIVATE_ERROR =
  "You cannot deactivate your own account. Ask another system administrator to do it.";

export const SELF_DELETE_ERROR =
  "You cannot delete your own account. Ask another system administrator to do it.";

export const SELF_DEMOTE_ERROR =
  "You cannot remove your own system administrator role. Ask another system administrator to do it.";

export const SELF_SET_PASSWORD_ERROR =
  "You cannot set a temporary password on your own account. Use the profile or password reset workflow instead.";

/**
 * @returns an error message if the change is blocked, otherwise null.
 */
export function checkSelfDeactivate(
  callerId: string,
  targetUserId: string,
  enable: boolean,
): string | null {
  // Re-activating yourself is harmless; only deactivation locks you out.
  if (!enable && callerId.toLowerCase() === targetUserId.toLowerCase()) return SELF_DEACTIVATE_ERROR;
  return null;
}

export function checkSelfDelete(callerId: string, targetUserId: string): string | null {
  if (callerId.toLowerCase() === targetUserId.toLowerCase()) return SELF_DELETE_ERROR;
  return null;
}

export function checkSelfSetPassword(callerId: string, targetUserId: string): string | null {
  if (callerId.toLowerCase() === targetUserId.toLowerCase()) return SELF_SET_PASSWORD_ERROR;
  return null;
}

/**
 * Blocks an admin from dropping their own system_admin role, which would leave
 * them unable to reach the admin panel to undo it.
 *
 * @param systemAdminRoleId the id of the system_admin role, or null if absent
 * @param nextRoleIds the full set of role ids the user would be left with
 */
export function checkSelfDemote(
  callerId: string,
  targetUserId: string,
  systemAdminRoleId: string | null,
  nextRoleIds: string[],
): string | null {
  if (callerId.toLowerCase() !== targetUserId.toLowerCase()) return null;
  if (!systemAdminRoleId) return null;
  if (nextRoleIds.includes(systemAdminRoleId)) return null;
  return SELF_DEMOTE_ERROR;
}
