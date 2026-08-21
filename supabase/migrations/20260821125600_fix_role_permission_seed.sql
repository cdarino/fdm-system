-- Fix for 20260821024323: the original migration used a single CTE chain where
-- `inserted_permissions` and `inserted_roles` were never referenced, so PostgreSQL
-- skipped their execution. This migration re-seeds the data idempotently.

-- Step 1: Ensure permissions exist
INSERT INTO rbac.permission (name)
VALUES
    -- Billing
    ('billing.create'),
    ('billing.read'),
    ('billing.update'),
    ('billing.delete'),

    -- Legal
    ('legal.create'),
    ('legal.read'),
    ('legal.update'),
    ('legal.delete'),

    -- Accounting
    ('accounting.create'),
    ('accounting.read'),
    ('accounting.update'),
    ('accounting.delete'),

    -- Clients
    ('clients.create'),
    ('clients.read'),
    ('clients.update'),
    ('clients.delete'),

    -- Properties
    ('properties.create'),
    ('properties.read'),
    ('properties.update'),
    ('properties.delete'),

    -- System
    ('system.create'),
    ('system.read'),
    ('system.update'),
    ('system.delete')
ON CONFLICT (name) DO NOTHING;

-- Step 2: Ensure roles exist
INSERT INTO rbac.role (name, description, active)
VALUES
    ('billing_staff',    'Staff handling billing operations',                         TRUE),
    ('legal_staff',      'Staff handling legal operations',                           TRUE),
    ('accounting_staff', 'Staff handling accounting operations',                      TRUE),
    ('admin_staff',      'Administrative staff with elevated management privileges',  TRUE),
    ('system_admin',     'System administrator with system configuration permissions', TRUE)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    active      = EXCLUDED.active;

-- Step 3: Seed role-permission mappings
INSERT INTO rbac.role_permission (role_id, permission_id)
SELECT DISTINCT
    r.id AS role_id,
    p.id AS permission_id
FROM (VALUES
    -- billing_staff
    ('billing_staff', 'billing.create'),
    ('billing_staff', 'billing.read'),
    ('billing_staff', 'billing.update'),
    ('billing_staff', 'billing.delete'),
    ('billing_staff', 'clients.read'),
    ('billing_staff', 'properties.read'),

    -- legal_staff
    ('legal_staff', 'legal.create'),
    ('legal_staff', 'legal.read'),
    ('legal_staff', 'legal.update'),
    ('legal_staff', 'legal.delete'),
    ('legal_staff', 'clients.read'),
    ('legal_staff', 'properties.read'),

    -- accounting_staff
    ('accounting_staff', 'accounting.create'),
    ('accounting_staff', 'accounting.read'),
    ('accounting_staff', 'accounting.update'),
    ('accounting_staff', 'accounting.delete'),
    ('accounting_staff', 'clients.read'),
    ('accounting_staff', 'properties.read'),

    -- admin_staff (billing + legal + accounting + clients + properties)
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

    -- system_admin
    ('system_admin', 'system.create'),
    ('system_admin', 'system.read'),
    ('system_admin', 'system.update'),
    ('system_admin', 'system.delete')
) AS rps (role_name, permission_name)
JOIN rbac.role       r ON r.name = rps.role_name
JOIN rbac.permission p ON p.name = rps.permission_name
ON CONFLICT (role_id, permission_id) DO NOTHING;
