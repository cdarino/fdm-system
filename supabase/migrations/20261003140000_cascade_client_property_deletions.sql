-- ==============================================================================
-- UPDATE FOREIGN KEY CONSTRAINTS TO CASCADE DELETES
-- 
-- Allows administrative cleanup, automated tests, and system deletions to cleanly
-- remove clients and property lots without hitting FK restriction errors.
-- ==============================================================================

-- Update account_party -> client FK constraint to CASCADE
ALTER TABLE public.account_party
    DROP CONSTRAINT IF EXISTS account_party_client_id_fkey,
    ADD CONSTRAINT account_party_client_id_fkey
    FOREIGN KEY (client_id)
    REFERENCES public.client(client_id)
    ON DELETE CASCADE;

-- Update ledger_account -> property_lot FK constraint to CASCADE
ALTER TABLE public.ledger_account
    DROP CONSTRAINT IF EXISTS ledger_account_property_id_fkey,
    ADD CONSTRAINT ledger_account_property_id_fkey
    FOREIGN KEY (property_id)
    REFERENCES public.property_lot(property_id)
    ON DELETE CASCADE;
