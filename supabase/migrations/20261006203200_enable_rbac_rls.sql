-- ==============================================================================
-- ENABLE RLS ON RBAC SCHEMA, REVOKE EXCESSIVE GRANTS, AND HARDEN RBAC FUNCTIONS
-- ==============================================================================

-- 1. Revoke excessive privileges from PUBLIC, anon, and authenticated
REVOKE ALL ON ALL TABLES IN SCHEMA rbac FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA rbac FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA rbac FROM PUBLIC, anon;
REVOKE USAGE ON SCHEMA rbac FROM PUBLIC, anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA rbac REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA rbac REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA rbac REVOKE ALL ON ROUTINES FROM PUBLIC, anon;

-- 2. Enable Row Level Security on all RBAC tables
ALTER TABLE rbac.role ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac.permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac.role_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac.user_role ENABLE ROW LEVEL SECURITY;

-- 3. Grant schema usage and least-privilege table access
GRANT USAGE ON SCHEMA rbac TO authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA rbac TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA rbac TO service_role;

GRANT SELECT ON TABLE rbac.role TO authenticated;
GRANT SELECT ON TABLE rbac.permission TO authenticated;
GRANT SELECT ON TABLE rbac.role_permission TO authenticated;
GRANT SELECT ON TABLE rbac.user_role TO authenticated;

-- 4. Harden rbac.has_permission with search_path = '', superadmin bypass, and active/soft-delete checks
CREATE OR REPLACE FUNCTION rbac.has_permission(
    p_permission_name TEXT,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM rbac.user_role ur
        JOIN rbac.role r ON r.id = ur.role_id
        WHERE ur.user_id = p_user_id
          AND r.active = TRUE
          AND r.deleted_at IS NULL
          AND ur.deleted_at IS NULL
          AND (
              r.name = 'system_admin'
              OR EXISTS (
                  SELECT 1
                  FROM rbac.role_permission rp
                  JOIN rbac.permission p ON p.id = rp.permission_id
                  WHERE rp.role_id = r.id
                    AND p.name = p_permission_name
                    AND rp.deleted_at IS NULL
                    AND p.deleted_at IS NULL
              )
          )
    );
$$;

REVOKE EXECUTE ON FUNCTION rbac.has_permission(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rbac.has_permission(TEXT, UUID) TO authenticated, service_role;

-- 5. Harden rbac.get_user_permissions with search_path = '', superadmin bypass, and active/soft-delete checks
CREATE OR REPLACE FUNCTION rbac.get_user_permissions(
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (permission_name TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.name::TEXT AS permission_name
    FROM rbac.permission p
    WHERE p.deleted_at IS NULL
      AND EXISTS (
          SELECT 1
          FROM rbac.user_role ur
          JOIN rbac.role r ON r.id = ur.role_id
          WHERE ur.user_id = p_user_id
            AND r.name = 'system_admin'
            AND r.active = TRUE
            AND r.deleted_at IS NULL
            AND ur.deleted_at IS NULL
      )
    UNION
    SELECT DISTINCT p.name::TEXT AS permission_name
    FROM rbac.user_role ur
    JOIN rbac.role r ON r.id = ur.role_id
    JOIN rbac.role_permission rp ON rp.role_id = r.id
    JOIN rbac.permission p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND r.active = TRUE
      AND r.deleted_at IS NULL
      AND ur.deleted_at IS NULL
      AND rp.deleted_at IS NULL
      AND p.deleted_at IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION rbac.get_user_permissions(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rbac.get_user_permissions(UUID) TO authenticated, service_role;

-- 6. Harden rbac.set_user_roles with search_path = '' and active/soft-delete checks
CREATE OR REPLACE FUNCTION rbac.set_user_roles(
    p_user_id UUID,
    p_role_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_distinct_count INT;
    v_valid_count INT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User not found.';
    END IF;

    IF p_role_ids IS NOT NULL AND cardinality(p_role_ids) > 0 THEN
        SELECT COUNT(DISTINCT r_id)
        INTO v_distinct_count
        FROM unnest(p_role_ids) AS r_id;

        SELECT COUNT(*)
        INTO v_valid_count
        FROM rbac.role
        WHERE id = ANY(p_role_ids)
          AND active = TRUE
          AND deleted_at IS NULL;

        IF v_valid_count <> v_distinct_count THEN
            RAISE EXCEPTION 'One or more role IDs are invalid.';
        END IF;
    END IF;

    DELETE FROM rbac.user_role
    WHERE user_id = p_user_id;

    IF p_role_ids IS NOT NULL AND cardinality(p_role_ids) > 0 THEN
        INSERT INTO rbac.user_role (user_id, role_id)
        SELECT DISTINCT p_user_id, unnest(p_role_ids);
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION rbac.set_user_roles(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rbac.set_user_roles(UUID, UUID[]) TO service_role;

-- 7. Establish RLS policies on RBAC tables
DROP POLICY IF EXISTS "Allow read active roles" ON rbac.role;
CREATE POLICY "Allow read active roles" ON rbac.role
    FOR SELECT TO authenticated
    USING (active = TRUE AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Allow read permissions" ON rbac.permission;
CREATE POLICY "Allow read permissions" ON rbac.permission
    FOR SELECT TO authenticated
    USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Allow read role_permission" ON rbac.role_permission;
CREATE POLICY "Allow read role_permission" ON rbac.role_permission
    FOR SELECT TO authenticated
    USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Allow read own user_roles" ON rbac.user_role;
CREATE POLICY "Allow read own user_roles" ON rbac.user_role
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR rbac.has_permission('system.read', auth.uid()));

NOTIFY pgrst, 'reload schema';
