-- ==============================================================================
-- ENUMS
-- ==============================================================================

DO $$ BEGIN
    CREATE TYPE public.account_status_enum AS ENUM ('Active', 'Matured', 'Delinquent', 'Cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- LEDGER ACCOUNT & ACCOUNT PARTY TABLES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.ledger_account (
    account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.property_lot(property_id) ON DELETE RESTRICT,
    status public.account_status_enum NOT NULL DEFAULT 'Active',
    total_contract_price NUMERIC(15, 2) NOT NULL,
    remaining_balance NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_ledger_account_updated_at
BEFORE UPDATE ON public.ledger_account
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Enforce exactly one active ledger per property lot to prevent double-selling
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_lot_ledger
ON public.ledger_account(property_id)
WHERE status = 'Active';

CREATE TABLE IF NOT EXISTS public.account_party (
    account_id UUID NOT NULL REFERENCES public.ledger_account(account_id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.client(client_id) ON DELETE RESTRICT,
    role VARCHAR(50) NOT NULL DEFAULT 'Principal Buyer',
    ownership_percentage NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (account_id, client_id)
);

-- ==============================================================================
-- DATA MIGRATION: Migrate existing property_lot.client_id to ledger_account
-- ==============================================================================

DO $$
DECLARE
    lot_record RECORD;
    new_account_id UUID;
    computed_tcp NUMERIC(15, 2);
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'property_lot'
          AND column_name = 'client_id'
    ) THEN
        FOR lot_record IN
            SELECT property_id, client_id, area_size, price_per_sqm, status
            FROM public.property_lot
            WHERE client_id IS NOT NULL
        LOOP
            computed_tcp := COALESCE(lot_record.area_size * lot_record.price_per_sqm, 0.00);

            INSERT INTO public.ledger_account (
                property_id,
                status,
                total_contract_price,
                remaining_balance
            ) VALUES (
                lot_record.property_id,
                'Active',
                computed_tcp,
                computed_tcp
            ) RETURNING account_id INTO new_account_id;

            INSERT INTO public.account_party (
                account_id,
                client_id,
                role,
                ownership_percentage,
                is_primary
            ) VALUES (
                new_account_id,
                lot_record.client_id,
                'Principal Buyer',
                100.00,
                TRUE
            ) ON CONFLICT (account_id, client_id) DO NOTHING;
        END LOOP;

        ALTER TABLE public.property_lot DROP COLUMN client_id;
    END IF;
END $$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.ledger_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_party ENABLE ROW LEVEL SECURITY;

-- Permissions for public.ledger_account
CREATE POLICY "Allow read ledger_account" ON public.ledger_account
    FOR SELECT TO authenticated
    USING (rbac.has_permission('properties.read', auth.uid()) OR rbac.has_permission('billing.read', auth.uid()));

CREATE POLICY "Allow insert ledger_account" ON public.ledger_account
    FOR INSERT TO authenticated
    WITH CHECK (rbac.has_permission('properties.update', auth.uid()) OR rbac.has_permission('billing.create', auth.uid()));

CREATE POLICY "Allow update ledger_account" ON public.ledger_account
    FOR UPDATE TO authenticated
    USING (rbac.has_permission('properties.update', auth.uid()) OR rbac.has_permission('billing.update', auth.uid()))
    WITH CHECK (rbac.has_permission('properties.update', auth.uid()) OR rbac.has_permission('billing.update', auth.uid()));

CREATE POLICY "Allow delete ledger_account" ON public.ledger_account
    FOR DELETE TO authenticated
    USING (rbac.has_permission('properties.delete', auth.uid()) OR rbac.has_permission('billing.delete', auth.uid()));

-- Permissions for public.account_party
CREATE POLICY "Allow read account_party" ON public.account_party
    FOR SELECT TO authenticated
    USING (
        rbac.has_permission('properties.read', auth.uid()) 
        OR rbac.has_permission('billing.read', auth.uid()) 
        OR rbac.has_permission('clients.read', auth.uid())
    );

CREATE POLICY "Allow insert account_party" ON public.account_party
    FOR INSERT TO authenticated
    WITH CHECK (
        rbac.has_permission('properties.update', auth.uid()) 
        OR rbac.has_permission('billing.update', auth.uid()) 
        OR rbac.has_permission('clients.update', auth.uid())
    );

CREATE POLICY "Allow update account_party" ON public.account_party
    FOR UPDATE TO authenticated
    USING (
        rbac.has_permission('properties.update', auth.uid()) 
        OR rbac.has_permission('billing.update', auth.uid()) 
        OR rbac.has_permission('clients.update', auth.uid())
    )
    WITH CHECK (
        rbac.has_permission('properties.update', auth.uid()) 
        OR rbac.has_permission('billing.update', auth.uid()) 
        OR rbac.has_permission('clients.update', auth.uid())
    );

CREATE POLICY "Allow delete account_party" ON public.account_party
    FOR DELETE TO authenticated
    USING (
        rbac.has_permission('properties.update', auth.uid()) 
        OR rbac.has_permission('billing.update', auth.uid()) 
        OR rbac.has_permission('clients.update', auth.uid())
    );

-- Grants
GRANT ALL ON TABLE public.ledger_account TO authenticated, service_role;
GRANT ALL ON TABLE public.account_party TO authenticated, service_role;

