-- ==============================================================================
-- LAND TITLE & FULLY-PAID CLIENT OWNERSHIP
--
-- For clients who have completed payment outside or inside the app,
-- ownership is tracked directly via land_title while processing titles,
-- bypassing active ledger accounts.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.land_title (
    title_id     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id  UUID         NOT NULL REFERENCES public.property_lot(property_id) ON DELETE CASCADE,
    client_id    UUID         NOT NULL REFERENCES public.client(client_id) ON DELETE CASCADE,
    title_number VARCHAR(100),
    status       VARCHAR(50)  NOT NULL DEFAULT 'Processing',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_land_title_property UNIQUE (property_id)
);

CREATE INDEX IF NOT EXISTS idx_land_title_client_id ON public.land_title (client_id);
CREATE INDEX IF NOT EXISTS idx_land_title_property_id ON public.land_title (property_id);

CREATE OR REPLACE TRIGGER set_land_title_updated_at
BEFORE UPDATE ON public.land_title
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- ROW LEVEL SECURITY
--
-- Read allowed for legal.read or properties.read (for property display).
-- Write operations (insert, update, delete) restricted to legal.*.
-- ==============================================================================

ALTER TABLE public.land_title ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read land_title" ON public.land_title;
CREATE POLICY "Allow read land_title" ON public.land_title
    FOR SELECT TO authenticated
    USING (
        rbac.has_permission('legal.read', auth.uid()) OR
        rbac.has_permission('properties.read', auth.uid())
    );

DROP POLICY IF EXISTS "Allow insert land_title" ON public.land_title;
CREATE POLICY "Allow insert land_title" ON public.land_title
    FOR INSERT TO authenticated
    WITH CHECK (rbac.has_permission('legal.create', auth.uid()));

DROP POLICY IF EXISTS "Allow update land_title" ON public.land_title;
CREATE POLICY "Allow update land_title" ON public.land_title
    FOR UPDATE TO authenticated
    USING (rbac.has_permission('legal.update', auth.uid()))
    WITH CHECK (rbac.has_permission('legal.update', auth.uid()));

DROP POLICY IF EXISTS "Allow delete land_title" ON public.land_title;
CREATE POLICY "Allow delete land_title" ON public.land_title
    FOR DELETE TO authenticated
    USING (rbac.has_permission('legal.delete', auth.uid()));

GRANT ALL ON TABLE public.land_title TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
