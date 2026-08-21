-- Right before this migration, supabase clients didnt recognize that
-- the rbac schema exists. This migration makes it visible and available to supabase clients.

GRANT USAGE ON SCHEMA rbac TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA rbac TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA rbac TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA rbac TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA rbac GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA rbac GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA rbac GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;