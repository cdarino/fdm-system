-- ==============================================================================
-- SITE SUBDIVISION  (r35 Pre-drawn Lot Plan)
--
-- Each row is one pre-planned lot division on a site, populated from the plat
-- drawing before any property sale takes place.
--
-- The site map renders every subdivision polygon. If a property_lot exists with
-- matching (site_id, block_number, lot_number), that subdivision is "claimed"
-- and coloured by the lot's status. Otherwise it renders as an empty slot.
--
-- Geometry convention matches site.boundary and property_lot.boundary:
--   boundary = [[x, y], ...] — local metres, Y grows down, ring not closed.
-- ==============================================================================

CREATE TABLE public.site_subdivision (
    subdivision_id UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id        UUID         NOT NULL REFERENCES public.site(site_id) ON DELETE CASCADE,
    block_number   INT          NOT NULL,
    lot_number     INT          NOT NULL,
    boundary       JSONB        NOT NULL,
    CONSTRAINT uq_site_subdivision UNIQUE (site_id, block_number, lot_number),
    CONSTRAINT site_subdivision_boundary_is_ring CHECK (
        jsonb_typeof(boundary) = 'array' AND jsonb_array_length(boundary) >= 3
    )
);

CREATE INDEX idx_site_subdivision_site_id ON public.site_subdivision (site_id);

CREATE OR REPLACE TRIGGER set_site_subdivision_updated_at
BEFORE UPDATE ON public.site_subdivision
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- ROW LEVEL SECURITY — reuses properties.* permissions, same as site
-- ==============================================================================

ALTER TABLE public.site_subdivision ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read site_subdivision" ON public.site_subdivision;
CREATE POLICY "Allow read site_subdivision" ON public.site_subdivision
    FOR SELECT TO authenticated
    USING (rbac.has_permission('properties.read', auth.uid()));

DROP POLICY IF EXISTS "Allow insert site_subdivision" ON public.site_subdivision;
CREATE POLICY "Allow insert site_subdivision" ON public.site_subdivision
    FOR INSERT TO authenticated
    WITH CHECK (rbac.has_permission('properties.create', auth.uid()));

DROP POLICY IF EXISTS "Allow update site_subdivision" ON public.site_subdivision;
CREATE POLICY "Allow update site_subdivision" ON public.site_subdivision
    FOR UPDATE TO authenticated
    USING (rbac.has_permission('properties.update', auth.uid()))
    WITH CHECK (rbac.has_permission('properties.update', auth.uid()));

DROP POLICY IF EXISTS "Allow delete site_subdivision" ON public.site_subdivision;
CREATE POLICY "Allow delete site_subdivision" ON public.site_subdivision
    FOR DELETE TO authenticated
    USING (rbac.has_permission('properties.delete', auth.uid()));

GRANT ALL ON TABLE public.site_subdivision TO authenticated, service_role;

