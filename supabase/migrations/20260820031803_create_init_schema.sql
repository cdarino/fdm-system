-- this is a modified version of the rbac approach from: https://mannylara.medium.com/rbac-enforced-by-rls-in-supabase-bc6e98ff9cc3
-- except 

-- RBAC schema
CREATE SCHEMA IF NOT EXISTS rbac;

CREATE TABLE IF NOT EXISTS rbac.role(
  id UUID DEFAULT GEN_RANDOM_UUID() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NULL,
  active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS rbac.permission(
  id UUID DEFAULT GEN_RANDOM_UUID() PRIMARY KEY,
  name TEXT NOT NULL, -- examples: billing.read, billing.edit, billing.write, billing.delete
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS rbac.role_permission(
  role_id UUID NOT NULL REFERENCES rbac.role(id),
  permission_id UUID NOT NULL REFERENCES rbac.permission(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,
  
  PRIMARY KEY(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS rbac.user_role(
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role_id UUID NOT NULL REFERENCES rbac.role(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,
  
  PRIMARY KEY(user_id, role_id)
);

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
        JOIN rbac.role_permission rp
            ON rp.role_id = ur.role_id
        JOIN rbac.permission p
            ON p.id = rp.permission_id
        WHERE ur.user_id = p_user_id
          AND p.name = p_permission_name
    );
$$;

