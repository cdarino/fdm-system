-- ==============================================================================
-- RESTORE public.property_lot.client_id
--
-- The column is declared inside the CREATE TABLE in
-- 20260911143000_create_client_property_schema.sql, but that statement is
-- `CREATE TABLE IF NOT EXISTS`. On any database where property_lot already
-- existed when client_id was added to that file, the whole statement became a
-- no-op and the column was never created — silently, because IF NOT EXISTS
-- reports success.
--
-- Everything that joins a lot to its owner has been failing as a result:
--   * getPropertyLots()      — the Property Lots table's Client column
--   * getSiteWithLots()      — the site map, which errors outright
--   * assignPropertyClient() — cannot target a column that is not there
--
-- PostgREST reports this as "Could not find a relationship between
-- 'property_lot' and 'client_id' in the schema cache", which reads like an
-- embed-syntax problem rather than a missing column.
-- ==============================================================================

ALTER TABLE public.property_lot
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.client(client_id) ON DELETE SET NULL;

-- Lots are looked up by owner whenever a client profile is opened.
CREATE INDEX IF NOT EXISTS idx_property_lot_client_id ON public.property_lot (client_id);

-- PostgREST builds its embed graph from a cached introspection of the schema.
-- Adding a foreign key does not always invalidate that cache on its own, and
-- until it reloads the relationship stays invisible to the API.
NOTIFY pgrst, 'reload schema';
