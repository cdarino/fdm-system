-- ==============================================================================
-- DROP public.property_lot.client_id
--
-- Property lots now associate with clients through public.ledger_account and
-- public.account_party, which supports multiple buyers and ownership splits.
--
-- An earlier migration (20260914120000_restore_property_lot_client_id.sql) was
-- merged out-of-order after 20260914223800_refactor_property_lot_client_relationship.sql,
-- re-adding client_id to databases that had already refactored.
--
-- This migration permanently drops public.property_lot.client_id to ensure
-- all environments are consistent.
-- ==============================================================================

DROP INDEX IF EXISTS public.idx_property_lot_client_id;

ALTER TABLE public.property_lot DROP COLUMN IF EXISTS client_id;

-- PostgREST builds its embed graph from a cached schema introspection.
-- Reload schema so the dropped column/relationship is immediately reflected.
NOTIFY pgrst, 'reload schema';
