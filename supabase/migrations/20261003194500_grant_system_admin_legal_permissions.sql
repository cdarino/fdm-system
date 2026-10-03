-- ==============================================================================
-- GRANT SYSTEM_ADMIN LEGAL PERMISSIONS FOR TITLE ADMINISTRATION
--
-- Enables system_admin to create, view, and update land title records,
-- matching administrative capabilities on clients and properties.
-- ==============================================================================

INSERT INTO rbac.role_permission (role_id, permission_id)
SELECT r.id AS role_id, p.id AS permission_id
FROM rbac.role r
CROSS JOIN rbac.permission p
WHERE r.name = 'system_admin'
  AND p.name IN ('legal.create', 'legal.read', 'legal.update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
