-- ==============================================================================
-- AUTOMATE PROPERTY LOT STATUS VIA SQL FUNCTION AND TRIGGERS
--
-- Replaces manual assignment of property_lot.status with automatic resolution
-- based on related entities:
--   - If land_title exists -> 'Sold'
--   - Else if active ledger_account exists -> 'Reserved'
--   - Else -> 'Open'
-- ==============================================================================

-- 1. SQL function to calculate status for a given property_id
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

    -- Check if an active installment ledger account exists
    IF EXISTS (
        SELECT 1
        FROM public.ledger_account
        WHERE property_id = p_property_id
          AND status = 'Active'
    ) THEN
        RETURN 'Reserved'::public.property_status_enum;
    END IF;

    -- Default status when unassigned
    RETURN 'Open'::public.property_status_enum;
END;
$$;

-- 2. Trigger function for property_lot BEFORE INSERT OR UPDATE
CREATE OR REPLACE FUNCTION public.handle_property_lot_status_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Automatically enforce calculated status; overrides any manually passed value
    NEW.status := public.calculate_property_lot_status(NEW.property_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_property_lot_status_sync ON public.property_lot;
CREATE TRIGGER trg_property_lot_status_sync
BEFORE INSERT OR UPDATE ON public.property_lot
FOR EACH ROW
EXECUTE FUNCTION public.handle_property_lot_status_sync();

-- 3. Trigger function for land_title changes
CREATE OR REPLACE FUNCTION public.handle_land_title_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE public.property_lot
        SET status = public.calculate_property_lot_status(OLD.property_id)
        WHERE property_id = OLD.property_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.property_id IS DISTINCT FROM NEW.property_id THEN
            UPDATE public.property_lot
            SET status = public.calculate_property_lot_status(OLD.property_id)
            WHERE property_id = OLD.property_id;
        END IF;
        UPDATE public.property_lot
        SET status = public.calculate_property_lot_status(NEW.property_id)
        WHERE property_id = NEW.property_id;
        RETURN NEW;
    ELSE -- INSERT
        UPDATE public.property_lot
        SET status = public.calculate_property_lot_status(NEW.property_id)
        WHERE property_id = NEW.property_id;
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_land_title_status_change ON public.land_title;
CREATE TRIGGER trg_land_title_status_change
AFTER INSERT OR UPDATE OR DELETE ON public.land_title
FOR EACH ROW
EXECUTE FUNCTION public.handle_land_title_status_change();

-- 4. Trigger function for ledger_account changes
CREATE OR REPLACE FUNCTION public.handle_ledger_account_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE public.property_lot
        SET status = public.calculate_property_lot_status(OLD.property_id)
        WHERE property_id = OLD.property_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.property_id IS DISTINCT FROM NEW.property_id THEN
            UPDATE public.property_lot
            SET status = public.calculate_property_lot_status(OLD.property_id)
            WHERE property_id = OLD.property_id;
        END IF;
        UPDATE public.property_lot
        SET status = public.calculate_property_lot_status(NEW.property_id)
        WHERE property_id = NEW.property_id;
        RETURN NEW;
    ELSE -- INSERT
        UPDATE public.property_lot
        SET status = public.calculate_property_lot_status(NEW.property_id)
        WHERE property_id = NEW.property_id;
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_account_status_change ON public.ledger_account;
CREATE TRIGGER trg_ledger_account_status_change
AFTER INSERT OR UPDATE OR DELETE ON public.ledger_account
FOR EACH ROW
EXECUTE FUNCTION public.handle_ledger_account_status_change();

-- 5. Backfill/synchronize existing property lots
UPDATE public.property_lot
SET status = public.calculate_property_lot_status(property_id);

NOTIFY pgrst, 'reload schema';
