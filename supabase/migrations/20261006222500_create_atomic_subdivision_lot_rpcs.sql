-- ==============================================================================
-- ATOMIC SUBDIVISION & PROPERTY ASSIGNMENT RPCS (SECURITY INVOKER)
-- ==============================================================================

-- 1. Atomic creation of site_subdivision and optional property_lot
CREATE OR REPLACE FUNCTION public.create_subdivision_lot(
    p_site_id UUID,
    p_block_number INT,
    p_lot_number INT,
    p_boundary JSONB,
    p_create_property_lot BOOLEAN DEFAULT FALSE,
    p_area_size NUMERIC(10, 2) DEFAULT NULL,
    p_price_per_sqm NUMERIC(12, 2) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_site_name VARCHAR(255);
    v_subdivision public.site_subdivision;
    v_lot public.property_lot;
BEGIN
    SELECT s.name
    INTO v_site_name
    FROM public.site s
    WHERE s.site_id = p_site_id;

    IF v_site_name IS NULL THEN
        RAISE EXCEPTION 'Site not found.';
    END IF;

    INSERT INTO public.site_subdivision (
        site_id,
        block_number,
        lot_number,
        boundary
    ) VALUES (
        p_site_id,
        p_block_number,
        p_lot_number,
        p_boundary
    )
    RETURNING * INTO v_subdivision;

    IF COALESCE(p_create_property_lot, FALSE) THEN
        INSERT INTO public.property_lot (
            site_id,
            location,
            block_number,
            lot_number,
            area_size,
            price_per_sqm,
            status,
            boundary
        ) VALUES (
            p_site_id,
            v_site_name,
            p_block_number,
            p_lot_number,
            p_area_size,
            p_price_per_sqm,
            'Open'::public.property_status_enum,
            p_boundary
        )
        ON CONFLICT (location, block_number, lot_number) DO UPDATE SET
            site_id = EXCLUDED.site_id,
            area_size = EXCLUDED.area_size,
            price_per_sqm = EXCLUDED.price_per_sqm,
            status = EXCLUDED.status,
            boundary = EXCLUDED.boundary
        RETURNING * INTO v_lot;

        RETURN pg_catalog.jsonb_build_object(
            'subdivision', pg_catalog.to_jsonb(v_subdivision),
            'lot', pg_catalog.to_jsonb(v_lot)
        );
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'subdivision', pg_catalog.to_jsonb(v_subdivision),
        'lot', NULL
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_subdivision_lot(UUID, INT, INT, JSONB, BOOLEAN, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_subdivision_lot(UUID, INT, INT, JSONB, BOOLEAN, NUMERIC, NUMERIC) TO authenticated, service_role;

-- 2. Atomic creation of property_lot and client assignment (installment or fully_paid)
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

    IF p_ownership_type = 'fully_paid' THEN
        INSERT INTO public.land_title (
            property_id,
            client_id,
            title_number,
            status
        ) VALUES (
            v_property_id,
            p_client_id,
            p_title_number,
            'Processing'
        );
    ELSE
        v_tcp := COALESCE(p_total_contract_price, p_area_size * p_price_per_sqm);
        v_balance := COALESCE(p_remaining_balance, v_tcp);

        INSERT INTO public.ledger_account (
            property_id,
            status,
            total_contract_price,
            remaining_balance
        ) VALUES (
            v_property_id,
            'Active'::public.account_status_enum,
            v_tcp,
            v_balance
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
    END IF;

    RETURN v_property_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_and_assign_property_from_subdivision(UUID, INT, INT, NUMERIC, NUMERIC, UUID, TEXT, NUMERIC, NUMERIC, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_and_assign_property_from_subdivision(UUID, INT, INT, NUMERIC, NUMERIC, UUID, TEXT, NUMERIC, NUMERIC, VARCHAR) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
