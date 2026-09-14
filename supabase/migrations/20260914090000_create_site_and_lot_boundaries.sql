-- ==============================================================================
-- SITE + LOT BOUNDARIES  (Sprint 2 / r28 Interactive Map Base Rendering)
--
-- Geometry is stored as plain JSONB in a LOCAL coordinate space — metres from
-- an arbitrary site origin — not as latitude/longitude and not as PostGIS.
--
-- The site plan is a plat drawing, so it needs accurate relative shapes but no
-- georeference: nothing here projects, measures distance, or indexes spatially,
-- which is the whole reason PostGIS would earn its cost. JSONB round-trips
-- straight into an SVG `points` attribute with no conversion.
--
-- Convention (must match the lot editor, Sprint 2 / r33):
--   * boundary = [[x, y], ...] — an array of vertex pairs, at least 3.
--   * Units are metres; origin is the site's own top-left. X grows right,
--     Y grows DOWN, matching SVG's coordinate system so no flip is needed
--     at render time.
--   * The ring is implicitly closed: do NOT repeat the first vertex last.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.site (
    site_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    -- Outline of the whole land area the lots are cut from.
    boundary JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT site_boundary_is_ring CHECK (
        jsonb_typeof(boundary) = 'array' AND jsonb_array_length(boundary) >= 3
    )
);

CREATE TRIGGER set_site_updated_at
BEFORE UPDATE ON public.site
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- PROPERTY LOT: link to a site, and give each lot its own cut shape
--
-- Both columns are nullable: lots created through the Property Lots form (r26)
-- have no geometry yet, and must keep working. The map simply skips lots it
-- cannot draw.
--
-- `location` is left in place. It is a free-text VARCHAR carried by the
-- existing unique constraint (location, block_number, lot_number) and by
-- getPropertyLots()'s search; migrating it into site.name is a separate change
-- that would need a backfill.
-- ==============================================================================

ALTER TABLE public.property_lot
    ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES public.site(site_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS boundary JSONB;

DO $$ BEGIN
    ALTER TABLE public.property_lot
        ADD CONSTRAINT property_lot_boundary_is_ring CHECK (
            boundary IS NULL
            OR (jsonb_typeof(boundary) = 'array' AND jsonb_array_length(boundary) >= 3)
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_property_lot_site_id ON public.property_lot (site_id);

-- ==============================================================================
-- ROW LEVEL SECURITY
--
-- A site is property data, so it reuses the properties.* permissions rather
-- than introducing a new resource. admin_staff and system_admin already hold
-- all four from the original seed.
-- ==============================================================================

ALTER TABLE public.site ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read site" ON public.site
    FOR SELECT TO authenticated
    USING (rbac.has_permission('properties.read', auth.uid()));

CREATE POLICY "Allow insert site" ON public.site
    FOR INSERT TO authenticated
    WITH CHECK (rbac.has_permission('properties.create', auth.uid()));

CREATE POLICY "Allow update site" ON public.site
    FOR UPDATE TO authenticated
    USING (rbac.has_permission('properties.update', auth.uid()))
    WITH CHECK (rbac.has_permission('properties.update', auth.uid()));

CREATE POLICY "Allow delete site" ON public.site
    FOR DELETE TO authenticated
    USING (rbac.has_permission('properties.delete', auth.uid()));

GRANT ALL ON TABLE public.site TO authenticated, service_role;
