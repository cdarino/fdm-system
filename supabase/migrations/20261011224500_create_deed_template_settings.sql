-- Global Deed Template Settings Table for persistent company & representative defaults

CREATE TABLE IF NOT EXISTS public.deed_template_settings (
    setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE DEFAULT 'default',
    vendor_name TEXT NOT NULL DEFAULT 'FIRST DAVAO MILLENNIUM PROPERTY VENTURES SERVICES, INC.',
    vendor_representative TEXT NOT NULL DEFAULT 'JETRUDE A. GARCIA',
    vendor_rep_title TEXT NOT NULL DEFAULT 'Executive Vice-President',
    vendor_rep_civil_status TEXT NOT NULL DEFAULT 'single',
    vendor_rep_res_cert_no TEXT DEFAULT '01665165',
    vendor_rep_res_cert_date TEXT DEFAULT 'January 06, 2014',
    vendor_rep_res_cert_place TEXT DEFAULT 'IGACOS',
    vendor_tin TEXT DEFAULT '005-212-468',
    default_venue TEXT DEFAULT 'Davao City',
    mother_title_number TEXT DEFAULT 'T-14913 & 14914',
    mother_area_words TEXT DEFAULT 'ONE HUNDRED NINETY FOUR THOUSAND FOUR HUNDRED SIXTY SIX',
    mother_area_sqm TEXT DEFAULT '194,466',
    spa_doc_no TEXT DEFAULT '349',
    spa_page_no TEXT DEFAULT '70',
    spa_book_no TEXT DEFAULT '27',
    spa_series TEXT DEFAULT '2002',
    spa_notary TEXT DEFAULT 'ATTY. RODOLFTON S.J. DE LEON',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Seed baseline default row if missing
INSERT INTO public.deed_template_settings (
    key,
    vendor_name,
    vendor_representative,
    vendor_rep_title,
    vendor_rep_civil_status,
    vendor_rep_res_cert_no,
    vendor_rep_res_cert_date,
    vendor_rep_res_cert_place,
    vendor_tin,
    default_venue,
    mother_title_number,
    mother_area_words,
    mother_area_sqm,
    spa_doc_no,
    spa_page_no,
    spa_book_no,
    spa_series,
    spa_notary
)
VALUES (
    'default',
    'FIRST DAVAO MILLENNIUM PROPERTY VENTURES SERVICES, INC.',
    'JETRUDE A. GARCIA',
    'Executive Vice-President',
    'single',
    '01665165',
    'January 06, 2014',
    'IGACOS',
    '005-212-468',
    'Davao City',
    'T-14913 & 14914',
    'ONE HUNDRED NINETY FOUR THOUSAND FOUR HUNDRED SIXTY SIX',
    '194,466',
    '349',
    '70',
    '27',
    '2002',
    'ATTY. RODOLFTON S.J. DE LEON'
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.deed_template_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read deed_template_settings" ON public.deed_template_settings;
CREATE POLICY "Allow read deed_template_settings" ON public.deed_template_settings
    FOR SELECT TO authenticated
    USING (
        rbac.has_permission('legal.read', auth.uid())
        OR rbac.has_permission('properties.read', auth.uid())
        OR rbac.has_permission('system.read', auth.uid())
    );

DROP POLICY IF EXISTS "Allow update deed_template_settings" ON public.deed_template_settings;
CREATE POLICY "Allow update deed_template_settings" ON public.deed_template_settings
    FOR UPDATE TO authenticated
    USING (
        rbac.has_permission('legal.update', auth.uid())
        OR rbac.has_permission('system.update', auth.uid())
    )
    WITH CHECK (
        rbac.has_permission('legal.update', auth.uid())
        OR rbac.has_permission('system.update', auth.uid())
    );

DROP POLICY IF EXISTS "Allow insert deed_template_settings" ON public.deed_template_settings;
CREATE POLICY "Allow insert deed_template_settings" ON public.deed_template_settings
    FOR INSERT TO authenticated
    WITH CHECK (
        rbac.has_permission('legal.update', auth.uid())
        OR rbac.has_permission('system.update', auth.uid())
    );

NOTIFY pgrst, 'reload schema';
