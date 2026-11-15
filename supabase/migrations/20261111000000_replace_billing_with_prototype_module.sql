-- ==============================================================================
-- REPLACE BILLING MODULE WITH PROTOTYPE ARCHITECTURE
--
-- Completely removes old billing tables, views, triggers, and functions.
-- Adds clean tables and columns for the prototype-based billing ledger module.
-- ==============================================================================

-- 1. Drop old billing views, tables, and functions
DROP VIEW IF EXISTS public.billing_account CASCADE;
DROP TABLE IF EXISTS public.billing_import_discrepancy CASCADE;
DROP TABLE IF EXISTS public.billing_holding_charge CASCADE;
DROP TABLE IF EXISTS public.billing_account_penalty_arrangement CASCADE;
DROP TABLE IF EXISTS public.billing_penalty_policy CASCADE;
DROP TABLE IF EXISTS public.billing_post_dated_check CASCADE;
DROP TABLE IF EXISTS public.billing_payment_application CASCADE;
DROP TABLE IF EXISTS public.billing_payment CASCADE;
DROP TABLE IF EXISTS public.billing_transaction CASCADE;
DROP TABLE IF EXISTS public.billing_schedule_installment CASCADE;
DROP TABLE IF EXISTS public.billing_schedule CASCADE;
DROP TABLE IF EXISTS public.ledger_compromise CASCADE;
DROP TABLE IF EXISTS public.ledger_account_notice CASCADE;
DROP TABLE IF EXISTS public.ledger_payment CASCADE;
DROP FUNCTION IF EXISTS public.get_next_billing_transaction_sequence CASCADE;
DROP FUNCTION IF EXISTS public.handle_ledger_payment_reconciliation CASCADE;

-- 2. Ensure ledger_account has prototype-required columns
ALTER TABLE public.ledger_account
    ADD COLUMN IF NOT EXISTS downpayment NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS contract_policies JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS overdue_notice_stage VARCHAR(50) NOT NULL DEFAULT 'none';

-- 3. Create clean billing_payment table
CREATE TABLE IF NOT EXISTS public.billing_payment (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.ledger_account(account_id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    receipt_number VARCHAR(100) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'check', 'bank_transfer')),
    waive_penalty BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_payment_account ON public.billing_payment(account_id, payment_date ASC);
CREATE INDEX IF NOT EXISTS idx_billing_payment_receipt ON public.billing_payment(receipt_number);

-- 4. Create clean billing_notice_event table
CREATE TABLE IF NOT EXISTS public.billing_notice_event (
    notice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.ledger_account(account_id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL CHECK (stage IN ('first_notice', 'second_notice', 'final_demand', 'forfeited')),
    notice_number INT NOT NULL CHECK (notice_number BETWEEN 1 AND 4),
    notice_date DATE NOT NULL,
    title TEXT NOT NULL,
    tracking_number TEXT,
    notes TEXT,
    overdue_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    arrears_principal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    penalty_due NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_notice_account ON public.billing_notice_event(account_id, notice_date DESC);

-- 5. Enable Row Level Security and setup policies
ALTER TABLE public.billing_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_notice_event ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_payment_select" ON public.billing_payment;
CREATE POLICY "billing_payment_select" ON public.billing_payment
    FOR SELECT TO authenticated
    USING (rbac.has_permission('billing.read', auth.uid()));

DROP POLICY IF EXISTS "billing_payment_insert" ON public.billing_payment;
CREATE POLICY "billing_payment_insert" ON public.billing_payment
    FOR INSERT TO authenticated
    WITH CHECK (rbac.has_permission('billing.create', auth.uid()));

DROP POLICY IF EXISTS "billing_payment_update" ON public.billing_payment;
CREATE POLICY "billing_payment_update" ON public.billing_payment
    FOR UPDATE TO authenticated
    USING (rbac.has_permission('billing.update', auth.uid()))
    WITH CHECK (rbac.has_permission('billing.update', auth.uid()));

DROP POLICY IF EXISTS "billing_payment_delete" ON public.billing_payment;
CREATE POLICY "billing_payment_delete" ON public.billing_payment
    FOR DELETE TO authenticated
    USING (rbac.has_permission('billing.delete', auth.uid()));

DROP POLICY IF EXISTS "billing_notice_event_select" ON public.billing_notice_event;
CREATE POLICY "billing_notice_event_select" ON public.billing_notice_event
    FOR SELECT TO authenticated
    USING (rbac.has_permission('billing.read', auth.uid()) OR rbac.has_permission('legal.read', auth.uid()));

DROP POLICY IF EXISTS "billing_notice_event_insert" ON public.billing_notice_event;
CREATE POLICY "billing_notice_event_insert" ON public.billing_notice_event
    FOR INSERT TO authenticated
    WITH CHECK (rbac.has_permission('billing.create', auth.uid()) OR rbac.has_permission('billing.update', auth.uid()) OR rbac.has_permission('legal.create', auth.uid()));

DROP POLICY IF EXISTS "billing_notice_event_delete" ON public.billing_notice_event;
CREATE POLICY "billing_notice_event_delete" ON public.billing_notice_event
    FOR DELETE TO authenticated
    USING (rbac.has_permission('billing.delete', auth.uid()));

GRANT ALL ON TABLE public.billing_payment TO authenticated, service_role;
GRANT ALL ON TABLE public.billing_notice_event TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
