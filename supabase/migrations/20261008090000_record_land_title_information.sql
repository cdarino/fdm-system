-- ==============================================================================
-- CLEARED BY BILLING AND LAND TITLE RECORDS (Sprint 3, S3-02)
--
-- The title release process now starts in two steps:
--   1. Billing marks a fully paid ledger account as cleared (cleared_at,
--      cleared_by on ledger_account). There is no Billing ledger until
--      Sprint 4, so this is a manual flag for now.
--   2. Legal creates the land title for a cleared account, choosing whose
--      name the title is in (title_holder) and entering the title number.
--
-- Title status is limited to the internal release steps and starts at
-- 'Cleared by Billing'. A lot counts as Sold once its account is cleared,
-- before Legal creates the title.
-- ==============================================================================

-- 1. Billing clearance on the ledger account
ALTER TABLE public.ledger_account
    ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cleared_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Title holder and author on the land title
ALTER TABLE public.land_title
    ADD COLUMN IF NOT EXISTS title_holder VARCHAR(10),
    ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.land_title DROP CONSTRAINT IF EXISTS chk_land_title_holder;
ALTER TABLE public.land_title ADD CONSTRAINT chk_land_title_holder CHECK (
    title_holder IS NULL OR title_holder IN ('client', 'fdm')
);

-- 3. Status limited to the release steps. Existing titles move onto them.
UPDATE public.land_title
SET status = CASE status
    WHEN 'Ready for Release' THEN 'Ready for Claim'
    ELSE 'Cleared by Billing'
END
WHERE status NOT IN (
    'Cleared by Billing', 'Legal Processing', 'Legal Review', 'Management Approval',
    '30-Day Clearance', 'Ready for Claim', 'Released'
);

ALTER TABLE public.land_title ALTER COLUMN status SET DEFAULT 'Cleared by Billing';

ALTER TABLE public.land_title DROP CONSTRAINT IF EXISTS chk_land_title_status;
ALTER TABLE public.land_title ADD CONSTRAINT chk_land_title_status CHECK (
    status IN (
        'Cleared by Billing', 'Legal Processing', 'Legal Review', 'Management Approval',
        '30-Day Clearance', 'Ready for Claim', 'Released'
    )
);

CREATE INDEX IF NOT EXISTS idx_land_title_status ON public.land_title (status);

-- ==============================================================================
-- LAND TITLE DEFAULTS TRIGGER
--
-- Fills created_by with the signed-in user, and translates the old status
-- names that laptops still running pre-Sprint 3 code will keep sending, so
-- their saves do not fail on the new CHECK constraint.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_land_title_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    END IF;

    NEW.status := CASE NEW.status
        WHEN 'Processing' THEN 'Cleared by Billing'
        WHEN 'Ready for Release' THEN 'Ready for Claim'
        ELSE NEW.status
    END;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_land_title_defaults ON public.land_title;
CREATE TRIGGER trg_land_title_defaults
BEFORE INSERT OR UPDATE ON public.land_title
FOR EACH ROW
EXECUTE FUNCTION public.handle_land_title_defaults();

-- ==============================================================================
-- LOT STATUS
--
-- Same as 20261003204000, plus: an active account cleared by Billing makes the
-- lot Sold even before Legal creates its title.
-- ==============================================================================

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

    IF EXISTS (
        SELECT 1
        FROM public.land_title
        WHERE property_id = p_property_id
    ) THEN
        RETURN 'Sold'::public.property_status_enum;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.ledger_account
        WHERE property_id = p_property_id
          AND status = 'Active'
          AND cleared_at IS NOT NULL
    ) THEN
        RETURN 'Sold'::public.property_status_enum;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.ledger_account
        WHERE property_id = p_property_id
          AND status = 'Active'
    ) THEN
        RETURN 'Reserved'::public.property_status_enum;
    END IF;

    RETURN 'Open'::public.property_status_enum;
END;
$$;

-- ==============================================================================
-- SUBDIVISION ASSIGNMENT RPC
--
-- Same as 20261006222500, except a fully paid sale now creates a ledger
-- account already cleared by Billing instead of a land title.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_and_assign_property_from_subdivision(
    p_site_id UUID,
    p_block_number INT,
    p_lot_number INT,
    p_area_size NUMERIC(10, 2),
    p_price_per_sqm NUMERIC(12, 2),
    p_client_id UUID,
    p_ownership_type TEXT,
    p_total_contract_price NUMERIC(15, 2) DEFAULT NULL,
    p_remaining_balance NUMERIC(15, 2) DEFAULT NULL,
    p_title_number VARCHAR(100) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_site_name VARCHAR(255);
    v_target_status public.property_status_enum;
    v_property_id UUID;
    v_tcp NUMERIC(15, 2);
    v_balance NUMERIC(15, 2);
    v_account_id UUID;
BEGIN
    SELECT s.name
    INTO v_site_name
    FROM public.site s
    WHERE s.site_id = p_site_id;

    v_site_name := COALESCE(v_site_name, 'Unknown Location');
    v_target_status := CASE
        WHEN p_ownership_type = 'fully_paid' THEN 'Sold'::public.property_status_enum
        ELSE 'Reserved'::public.property_status_enum
    END;

    INSERT INTO public.property_lot (
        site_id,
        location,
        block_number,
        lot_number,
        area_size,
        price_per_sqm,
        status
    ) VALUES (
        p_site_id,
        v_site_name,
        p_block_number,
        p_lot_number,
        p_area_size,
        p_price_per_sqm,
        v_target_status
    )
    RETURNING property_id INTO v_property_id;

    -- A fully paid sale is a ledger account that Billing has already cleared.
    -- The land title is created afterwards by Legal (createLandTitle), so
    -- p_title_number is no longer used here.
    v_tcp := COALESCE(p_total_contract_price, p_area_size * p_price_per_sqm);
    v_balance := CASE
        WHEN p_ownership_type = 'fully_paid' THEN 0
        ELSE COALESCE(p_remaining_balance, v_tcp)
    END;

    INSERT INTO public.ledger_account (
        property_id,
        status,
        total_contract_price,
        remaining_balance,
        cleared_at,
        cleared_by
    ) VALUES (
        v_property_id,
        'Active'::public.account_status_enum,
        v_tcp,
        v_balance,
        CASE WHEN p_ownership_type = 'fully_paid' THEN pg_catalog.now() END,
        CASE WHEN p_ownership_type = 'fully_paid' THEN auth.uid() END
    )
    RETURNING account_id INTO v_account_id;

    INSERT INTO public.account_party (
        account_id,
        client_id,
        role,
        ownership_percentage,
        is_primary
    ) VALUES (
        v_account_id,
        p_client_id,
        'Principal Buyer',
        100.00,
        TRUE
    );

    RETURN v_property_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
