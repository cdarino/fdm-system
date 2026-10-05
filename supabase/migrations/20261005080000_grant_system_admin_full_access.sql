-- ==============================================================================
-- GRANT SYSTEM_ADMIN FULL ACCESS ACROSS ALL DOMAINS & UPDATE RBAC FUNCTIONS
--
-- 1. Inserts all permissions into rbac.role_permission for system_admin.
-- 2. Updates rbac.has_permission to evaluate system_admin role as universal superadmin.
-- 3. Updates rbac.get_user_permissions to include all permissions for system_admin.
-- ==============================================================================

-- 1. Grant all existing permissions to system_admin role
INSERT INTO rbac.role_permission (role_id, permission_id)
SELECT r.id AS role_id, p.id AS permission_id
FROM rbac.role r
CROSS JOIN rbac.permission p
WHERE r.name = 'system_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 2. Update rbac.has_permission function to support superadmin bypass
CREATE OR REPLACE FUNCTION rbac.has_permission(
    p_permission_name TEXT,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = rbac, auth, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM rbac.user_role ur
        JOIN rbac.role r ON r.id = ur.role_id
        WHERE ur.user_id = p_user_id
          AND (
              r.name = 'system_admin'
              OR EXISTS (
                  SELECT 1
                  FROM rbac.role_permission rp
                  JOIN rbac.permission p ON p.id = rp.permission_id
                  WHERE rp.role_id = r.id
                    AND p.name = p_permission_name
              )
          )
    );
$$;

-- 3. Update rbac.get_user_permissions function
CREATE OR REPLACE FUNCTION rbac.get_user_permissions(
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (permission_name TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = rbac, auth, public
AS $$
    SELECT p.name::TEXT AS permission_name
    FROM rbac.permission p
    WHERE EXISTS (
        SELECT 1
        FROM rbac.user_role ur
        JOIN rbac.role r ON r.id = ur.role_id
        WHERE ur.user_id = p_user_id
          AND r.name = 'system_admin'
    )
    UNION
    SELECT DISTINCT p.name::TEXT AS permission_name
    FROM rbac.user_role ur
    JOIN rbac.role_permission rp ON rp.role_id = ur.role_id
    JOIN rbac.permission p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id;
$$;

NOTIFY pgrst, 'reload schema';
