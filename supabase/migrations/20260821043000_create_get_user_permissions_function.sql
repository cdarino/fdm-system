CREATE OR REPLACE FUNCTION rbac.get_user_permissions(
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (permission_name TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = rbac, auth, public
AS $$
    SELECT DISTINCT p.name AS permission_name
    FROM rbac.user_role ur
    JOIN rbac.role_permission rp
        ON rp.role_id = ur.role_id
    JOIN rbac.permission p
        ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id;
$$;
