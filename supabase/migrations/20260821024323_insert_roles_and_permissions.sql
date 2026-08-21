-- Ensure unique constraints exist on role and permission names for conflict handling
CREATE UNIQUE INDEX IF NOT EXISTS rbac_role_name_key ON rbac.role (name);
CREATE UNIQUE INDEX IF NOT EXISTS rbac_permission_name_key ON rbac.permission (name);

-- Insert permissions, roles, and role-permission mappings
WITH permissions_seed (name) AS (
VALUES
    -- Billing permissions
    ('billing.create'),
    ('billing.read'),
    ('billing.update'),
    ('billing.delete'),

    -- Legal permissions
    ('legal.create'),
    ('legal.read'),
    ('legal.update'),
    ('legal.delete'),

    -- Accounting permissions
    ('accounting.create'),
    ('accounting.read'),
    ('accounting.update'),
    ('accounting.delete'),

    -- Clients permissions
    ('clients.create'),
    ('clients.read'),
    ('clients.update'),
    ('clients.delete'),

    -- Properties permissions
    ('properties.create'),
    ('properties.read'),
    ('properties.update'),
    ('properties.delete'),

    -- System permissions
    ('system.create'),
    ('system.read'),
    ('system.update'),
    ('system.delete')
),
inserted_permissions AS (
    INSERT INTO rbac.permission (name)
    SELECT name FROM permissions_seed
    ON CONFLICT (name) DO NOTHING
),
roles_seed (name, description, active) AS (
VALUES
    ('billing_staff', 'Staff handling billing operations', TRUE),
    ('legal_staff', 'Staff handling legal operations', TRUE),
    ('accounting_staff', 'Staff handling accounting operations', TRUE),
    ('admin_staff', 'Administrative staff with elevated management privileges', TRUE),
    ('system_admin', 'System administrator with system configuration permissions', TRUE)
),
inserted_roles AS (
    INSERT INTO rbac.role (name, description, active)
    SELECT name, description, active FROM roles_seed
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
        active = EXCLUDED.active
),
role_permissions_seed (role_name, permission_name) AS (
    VALUES
    -- billing_staff permissions
    ('billing_staff', 'billing.create'),
    ('billing_staff', 'billing.read'),
    ('billing_staff', 'billing.update'),
    ('billing_staff', 'billing.delete'),

    -- legal_staff permissions
    ('legal_staff', 'legal.create'),
    ('legal_staff', 'legal.read'),
    ('legal_staff', 'legal.update'),
    ('legal_staff', 'legal.delete'),

    -- accounting_staff permissions
    ('accounting_staff', 'accounting.create'),
    ('accounting_staff', 'accounting.read'),
    ('accounting_staff', 'accounting.update'),
    ('accounting_staff', 'accounting.delete'),

    -- admin_staff permissions (all of billing, legal, accounting, clients, and properties)
    ('admin_staff', 'billing.create'),
    ('admin_staff', 'billing.read'),
    ('admin_staff', 'billing.update'),
    ('admin_staff', 'billing.delete'),
    ('admin_staff', 'legal.create'),
    ('admin_staff', 'legal.read'),
    ('admin_staff', 'legal.update'),
    ('admin_staff', 'legal.delete'),
    ('admin_staff', 'accounting.create'),
    ('admin_staff', 'accounting.read'),
    ('admin_staff', 'accounting.update'),
    ('admin_staff', 'accounting.delete'),
    ('admin_staff', 'clients.create'),
    ('admin_staff', 'clients.read'),
    ('admin_staff', 'clients.update'),
    ('admin_staff', 'clients.delete'),
    ('admin_staff', 'properties.create'),
    ('admin_staff', 'properties.read'),
    ('admin_staff', 'properties.update'),
    ('admin_staff', 'properties.delete'),

    -- system_admin permissions
    ('system_admin', 'system.create'),
    ('system_admin', 'system.read'),
    ('system_admin', 'system.update'),
    ('system_admin', 'system.delete'),

    -- Common read permissions (clients.read & properties.read) for all non-system_admin roles
    ('billing_staff', 'clients.read'),
    ('billing_staff', 'properties.read'),
    ('legal_staff', 'clients.read'),
    ('legal_staff', 'properties.read'),
    ('accounting_staff', 'clients.read'),
    ('accounting_staff', 'properties.read')
)
INSERT INTO rbac.role_permission (role_id, permission_id)
SELECT DISTINCT
    r.id AS role_id,
    p.id AS permission_id
FROM role_permissions_seed rps
JOIN rbac.role r ON r.name = rps.role_name
JOIN rbac.permission p ON p.name = rps.permission_name
ON CONFLICT (role_id, permission_id) DO NOTHING;
