-- FDM operational modules: contracts/title transfer, billing, payables, and
-- cross-department activity. Statutory values are intentionally recorded and
-- reviewed by staff; this system does not decide legal/tax applicability.

CREATE TABLE public.contract_record (
  contract_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.client(client_id) ON DELETE RESTRICT,
  property_id UUID REFERENCES public.property_lot(property_id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.ledger_account(account_id) ON DELETE SET NULL,
  contract_type TEXT NOT NULL DEFAULT 'Contract to Sell',
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'For review', 'Active', 'Completed', 'Cancelled')),
  signed_on DATE,
  effective_on DATE,
  total_contract_price NUMERIC(15,2),
  terms_summary TEXT,
  document_path TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.title_transaction (
  title_transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client(client_id) ON DELETE RESTRICT,
  property_id UUID NOT NULL REFERENCES public.property_lot(property_id) ON DELETE RESTRICT,
  contract_id UUID REFERENCES public.contract_record(contract_id) ON DELETE SET NULL,
  title_number TEXT,
  status TEXT NOT NULL DEFAULT 'Requirements gathering' CHECK (status IN (
    'Requirements gathering', 'Ready for BIR', 'Submitted to BIR', 'BIR eCAR issued',
    'Ready for LGU', 'Submitted to LGU', 'Ready for Registry of Deeds',
    'Submitted to Registry of Deeds', 'For release', 'Released to client', 'On hold'
  )),
  current_agency TEXT,
  started_on DATE NOT NULL DEFAULT CURRENT_DATE,
  target_completion_on DATE,
  last_follow_up_on DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, property_id)
);

CREATE TABLE public.title_requirement (
  title_requirement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_transaction_id UUID NOT NULL REFERENCES public.title_transaction(title_transaction_id) ON DELETE CASCADE,
  requirement_code TEXT NOT NULL,
  label TEXT NOT NULL,
  agency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Missing' CHECK (status IN ('Missing', 'Ready', 'Submitted', 'Verified', 'Not applicable')),
  reference_number TEXT,
  submitted_on DATE,
  verified_on DATE,
  notes TEXT,
  UNIQUE (title_transaction_id, requirement_code)
);

CREATE TABLE public.title_submission (
  title_submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_transaction_id UUID NOT NULL REFERENCES public.title_transaction(title_transaction_id) ON DELETE CASCADE,
  agency TEXT NOT NULL CHECK (agency IN ('BIR', 'LGU / Assessor', 'Registry of Deeds', 'Other')),
  submitted_on DATE NOT NULL DEFAULT CURRENT_DATE,
  received_reference TEXT,
  follow_up_on DATE,
  outcome TEXT,
  notes TEXT,
  logged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.billing_payment (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.ledger_account(account_id) ON DELETE RESTRICT,
  received_on DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  reference_number TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.billing_statement (
  statement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.ledger_account(account_id) ON DELETE RESTRICT,
  statement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_on DATE,
  principal_due NUMERIC(15,2) NOT NULL DEFAULT 0,
  penalty_due NUMERIC(15,2) NOT NULL DEFAULT 0,
  storage_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'For review', 'Released', 'Voided')),
  notes TEXT,
  prepared_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.accounts_payable (
  payable_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payee_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Title processing',
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  due_on DATE,
  status TEXT NOT NULL DEFAULT 'For review' CHECK (status IN ('Draft', 'For review', 'Approved', 'Paid', 'Cancelled')),
  payment_reference TEXT,
  title_transaction_id UUID REFERENCES public.title_transaction(title_transaction_id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.operation_log (
  operation_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  module TEXT NOT NULL CHECK (module IN ('Client', 'Contract', 'Title transfer', 'Billing', 'Payable', 'Document', 'Other')),
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  client_id UUID REFERENCES public.client(client_id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.property_lot(property_id) ON DELETE SET NULL,
  title_transaction_id UUID REFERENCES public.title_transaction(title_transaction_id) ON DELETE SET NULL,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_contract_record_updated_at BEFORE UPDATE ON public.contract_record FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_title_transaction_updated_at BEFORE UPDATE ON public.title_transaction FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_accounts_payable_updated_at BEFORE UPDATE ON public.accounts_payable FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Keep the existing ledger balance correct even when payments are entered by a
-- different staff member. Refunds/adjustments remain deliberate manual entries.
CREATE OR REPLACE FUNCTION public.apply_billing_payment_to_ledger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.ledger_account
  SET remaining_balance = GREATEST(0, remaining_balance - NEW.amount)
  WHERE account_id = NEW.account_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER apply_billing_payment_to_ledger AFTER INSERT ON public.billing_payment FOR EACH ROW EXECUTE FUNCTION public.apply_billing_payment_to_ledger();

ALTER TABLE public.contract_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.title_transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.title_requirement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.title_submission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_statement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read fdm operations" ON public.contract_record FOR SELECT TO authenticated USING (rbac.has_permission('legal.read', auth.uid()) OR rbac.has_permission('billing.read', auth.uid()) OR rbac.has_permission('accounting.read', auth.uid()) OR rbac.has_permission('system.read', auth.uid()));
CREATE POLICY "manage contracts" ON public.contract_record FOR ALL TO authenticated USING (rbac.has_permission('legal.update', auth.uid()) OR rbac.has_permission('system.update', auth.uid())) WITH CHECK (rbac.has_permission('legal.create', auth.uid()) OR rbac.has_permission('system.create', auth.uid()));
CREATE POLICY "read title transactions" ON public.title_transaction FOR SELECT TO authenticated USING (rbac.has_permission('legal.read', auth.uid()) OR rbac.has_permission('billing.read', auth.uid()) OR rbac.has_permission('system.read', auth.uid()));
CREATE POLICY "manage title transactions" ON public.title_transaction FOR ALL TO authenticated USING (rbac.has_permission('legal.update', auth.uid()) OR rbac.has_permission('system.update', auth.uid())) WITH CHECK (rbac.has_permission('legal.create', auth.uid()) OR rbac.has_permission('system.create', auth.uid()));
CREATE POLICY "manage title requirements" ON public.title_requirement FOR ALL TO authenticated USING (rbac.has_permission('legal.read', auth.uid()) OR rbac.has_permission('system.read', auth.uid())) WITH CHECK (rbac.has_permission('legal.update', auth.uid()) OR rbac.has_permission('system.update', auth.uid()));
CREATE POLICY "manage title submissions" ON public.title_submission FOR ALL TO authenticated USING (rbac.has_permission('legal.read', auth.uid()) OR rbac.has_permission('system.read', auth.uid())) WITH CHECK (rbac.has_permission('legal.create', auth.uid()) OR rbac.has_permission('system.create', auth.uid()));
CREATE POLICY "manage billing payments" ON public.billing_payment FOR ALL TO authenticated USING (rbac.has_permission('billing.read', auth.uid()) OR rbac.has_permission('accounting.read', auth.uid()) OR rbac.has_permission('system.read', auth.uid())) WITH CHECK (rbac.has_permission('billing.create', auth.uid()) OR rbac.has_permission('accounting.create', auth.uid()) OR rbac.has_permission('system.create', auth.uid()));
CREATE POLICY "manage billing statements" ON public.billing_statement FOR ALL TO authenticated USING (rbac.has_permission('billing.read', auth.uid()) OR rbac.has_permission('system.read', auth.uid())) WITH CHECK (rbac.has_permission('billing.create', auth.uid()) OR rbac.has_permission('system.create', auth.uid()));
CREATE POLICY "manage accounts payable" ON public.accounts_payable FOR ALL TO authenticated USING (rbac.has_permission('accounting.read', auth.uid()) OR rbac.has_permission('billing.read', auth.uid()) OR rbac.has_permission('system.read', auth.uid())) WITH CHECK (rbac.has_permission('accounting.create', auth.uid()) OR rbac.has_permission('system.create', auth.uid()));
CREATE POLICY "manage operation log" ON public.operation_log FOR ALL TO authenticated USING (rbac.has_permission('clients.read', auth.uid()) OR rbac.has_permission('legal.read', auth.uid()) OR rbac.has_permission('billing.read', auth.uid()) OR rbac.has_permission('system.read', auth.uid())) WITH CHECK (rbac.has_permission('clients.update', auth.uid()) OR rbac.has_permission('legal.create', auth.uid()) OR rbac.has_permission('billing.create', auth.uid()) OR rbac.has_permission('system.create', auth.uid()));

GRANT ALL ON public.contract_record, public.title_transaction, public.title_requirement, public.title_submission, public.billing_payment, public.billing_statement, public.accounts_payable, public.operation_log TO authenticated, service_role;
