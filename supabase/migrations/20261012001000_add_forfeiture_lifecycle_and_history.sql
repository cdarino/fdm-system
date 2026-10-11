-- ==============================================================================
-- ADD FORFEITURE LIFECYCLE AND HISTORY
--
-- 1. Extend account_status_enum with 'Forfeited'.
-- 2. Add forfeited_at, forfeiture_reason, and reopened_at to ledger_account.
-- 3. Update calculate_property_lot_status to recognize unresolved forfeitures.
-- ==============================================================================

-- 1. Extend account status enum
ALTER TYPE public.account_status_enum ADD VALUE IF NOT EXISTS 'Forfeited';

-- 2. Add forfeiture tracking columns to ledger_account
ALTER TABLE public.ledger_account
ADD COLUMN IF NOT EXISTS forfeited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS forfeiture_reason TEXT,
ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ;

-- 3. Update status calculation logic for property lots
CREATE OR REPLACE FUNCTION public.calculate_property_lot_status(p_property_id UUID)
RETURNS public.property_status_enum
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_property_id IS NULL THEN
        RETURN 'Open'::public.property_status_enum;
    END IF;

    -- Check if client ownership title exists
    IF EXISTS (
        SELECT 1
        FROM public.land_title
        WHERE property_id = p_property_id
    ) THEN
        RETURN 'Sold'::public.property_status_enum;
    END IF;

    -- Check if an active account cleared by Billing exists
    IF EXISTS (
        SELECT 1
        FROM public.ledger_account
        WHERE property_id = p_property_id
          AND status = 'Active'
          AND cleared_at IS NOT NULL
    ) THEN
        RETURN 'Sold'::public.property_status_enum;
    END IF;

    -- Check if an active installment ledger account exists
    IF EXISTS (
        SELECT 1
        FROM public.ledger_account
        WHERE property_id = p_property_id
          AND status = 'Active'
    ) THEN
        RETURN 'Reserved'::public.property_status_enum;
    END IF;

    -- Check if an active forfeiture awaiting redemption or reopening exists
    IF EXISTS (
        SELECT 1
        FROM public.ledger_account
        WHERE property_id = p_property_id
          AND status = 'Forfeited'
          AND reopened_at IS NULL
    ) THEN
        RETURN 'Forfeited'::public.property_status_enum;
    END IF;

    -- Default status when unassigned
    RETURN 'Open'::public.property_status_enum;
END;
$$;

NOTIFY pgrst, 'reload schema';
