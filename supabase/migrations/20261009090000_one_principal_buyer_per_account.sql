-- ==============================================================================
-- ONE PRINCIPAL BUYER PER ACCOUNT
--
-- Assigning a reserved lot to a second client used to add them to the lot's
-- account as another principal buyer, so one lot ended up sold to two people.
-- Clearing that account by Billing then cleared it for both, while Legal only
-- saw one of them. The server actions now refuse such assignments, and this
-- trigger enforces the same rule in the database, which also covers laptops
-- still running older versions of the app.
--
-- A co-buyer (is_primary = false) can still share an account with the
-- principal buyer.
--
-- Accounts that already have two principal buyers are left as they are and
-- need to be cleaned up by hand.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.enforce_single_principal_buyer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.account_party
        WHERE account_id = NEW.account_id
          AND is_primary
          AND client_id <> NEW.client_id
    ) THEN
        RAISE EXCEPTION 'This lot already has a principal buyer. Unassign it before assigning it to someone else.'
            USING ERRCODE = 'unique_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_account_party_single_principal ON public.account_party;
CREATE TRIGGER trg_account_party_single_principal
BEFORE INSERT OR UPDATE OF is_primary, account_id ON public.account_party
FOR EACH ROW
WHEN (NEW.is_primary)
EXECUTE FUNCTION public.enforce_single_principal_buyer();
