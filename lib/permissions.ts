import { createClient } from "@/lib/supabase/server";

/**
 * Checks whether a user (defaults to the currently logged-in user) has a specific RBAC permission.
 *
 * @param permissionName The name of the permission (e.g. 'billing.read')
 * @param userId Optional user UUID. If omitted, PostgREST / Postgres defaults to auth.uid()
 */
export async function hasPermission(
    permissionName: string,
    userId?: string
): Promise<boolean> {
    if (!permissionName) return false;

    const supabase = await createClient();

    const rpcParams: { p_permission_name: string; p_user_id?: string } = {
        p_permission_name: permissionName,
    };

    if (userId) {
        rpcParams.p_user_id = userId;
    }

    const { data, error } = await supabase.schema("rbac").rpc("has_permission", rpcParams);

    if (error) {
        console.error("Error checking permission:", error.message || error.details || error);
        return false;
    }

    return Boolean(data);
}

/**
 * Returns a list of permission names assigned to a user (defaults to the currently logged-in user).
 *
 * @param userId Optional user UUID. If omitted, PostgREST / Postgres defaults to auth.uid()
 */
export async function getUserPermissions(userId?: string): Promise<string[]> {
    const supabase = await createClient();

    const rpcParams: { p_user_id?: string } = {};
    if (userId) {
        rpcParams.p_user_id = userId;
    }

    const { data, error } = await supabase.schema("rbac").rpc("get_user_permissions", rpcParams);

    if (error || !data) {
        if (error) {
            console.error(
                "Error fetching user permissions:",
                error.message || error.details || error
            );
        }
        return [];
    }

    return (data as Array<{ permission_name: string } | string>).map((item) =>
        typeof item === "string" ? item : item.permission_name
    );
}
