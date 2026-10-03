-- ==============================================================================
-- OVERHAUL DELETE PERMISSIONS AND INTRODUCE ARCHIVE TRACKING
--
-- 1. Restricts all domain delete permissions exclusively to system_admin.
-- 2. Revokes delete permissions from non-system_admin roles.
-- 3. Adds archived_at and is_archived columns to client, property_lot, and site.
-- ==============================================================================

-- 1. Revoke delete permissions from non-system_admin roles
DELETE FROM rbac.role_permission
WHERE role_id IN (
    SELECT id FROM rbac.role WHERE name IN ('admin_staff', 'billing_staff', 'legal_staff', 'accounting_staff')
)
AND permission_id IN (
    SELECT id FROM rbac.permission WHERE name LIKE '%.delete'
);

-- 2. Ensure system_admin has delete permissions across all domains
INSERT INTO rbac.role_permission (role_id, permission_id)
SELECT r.id AS role_id, p.id AS permission_id
FROM rbac.role r
CROSS JOIN rbac.permission p
WHERE r.name = 'system_admin'
  AND p.name LIKE '%.delete'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. Add archive columns to client
ALTER TABLE public.client
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

-- Backfill existing archived clients with updated_at timestamp
UPDATE public.client
SET archived_at = updated_at
WHERE status = 'Archived' AND archived_at IS NULL;

-- 4. Add archive columns to property_lot
ALTER TABLE public.property_lot
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

-- 5. Add archive columns to site
ALTER TABLE public.site
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;
