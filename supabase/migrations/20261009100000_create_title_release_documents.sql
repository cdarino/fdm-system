-- ==============================================================================
-- TITLE RELEASE DOCUMENTS AS CLIENT DOCUMENTS (Sprint 3, S3-11)
--
-- The release packet Legal attaches before Management reviews a title (SOA,
-- payment history, Certificate of Ownership, Contract to Sell, Deed of Sale and
-- a copy of the title) is stored as ordinary client documents. A file uploaded
-- on the client's profile and one uploaded from the Legal page are then the
-- same document and show in both places.
--
--   1. New document types for the release packet
--   2. An optional lot link, since a client with two lots has two contracts.
--      A document with no lot applies to the client as a whole.
--   3. Legal staff can read client documents and manage the release packet
--      types, but not other paperwork such as valid IDs.
-- ==============================================================================

-- 1. Document types. 'Contract' is already in use on the live database but no
-- migration added it, so a fresh or local database was missing it.
ALTER TYPE public.doc_type_enum ADD VALUE IF NOT EXISTS 'Contract';
ALTER TYPE public.doc_type_enum ADD VALUE IF NOT EXISTS 'SOA';
ALTER TYPE public.doc_type_enum ADD VALUE IF NOT EXISTS 'Payment History';
ALTER TYPE public.doc_type_enum ADD VALUE IF NOT EXISTS 'Certificate of Ownership';
ALTER TYPE public.doc_type_enum ADD VALUE IF NOT EXISTS 'Title Copy';

-- 2. Lot link
ALTER TABLE public.client_document
    ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.property_lot(property_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_document_property_id ON public.client_document (property_id);

-- 3. Access. New enum values cannot be used in the same transaction that adds
-- them, so the policies compare the type as text.
DROP POLICY IF EXISTS "Allow read client_document" ON public.client_document;
CREATE POLICY "Allow read client_document" ON public.client_document
    FOR SELECT TO authenticated
    USING (
        rbac.has_permission('clients.read', auth.uid())
        OR rbac.has_permission('legal.read', auth.uid())
    );

DROP POLICY IF EXISTS "Allow insert client_document" ON public.client_document;
CREATE POLICY "Allow insert client_document" ON public.client_document
    FOR INSERT TO authenticated
    WITH CHECK (
        rbac.has_permission('clients.update', auth.uid())
        OR rbac.has_permission('clients.create', auth.uid())
        OR (
            rbac.has_permission('legal.update', auth.uid())
            AND document_type::text IN (
                'SOA', 'Payment History', 'Certificate of Ownership',
                'Contract', 'Deed of Sale', 'Title Copy'
            )
        )
    );

DROP POLICY IF EXISTS "Allow update client_document" ON public.client_document;
CREATE POLICY "Allow update client_document" ON public.client_document
    FOR UPDATE TO authenticated
    USING (rbac.has_permission('clients.update', auth.uid()))
    WITH CHECK (rbac.has_permission('clients.update', auth.uid()));

DROP POLICY IF EXISTS "Allow delete client_document" ON public.client_document;
CREATE POLICY "Allow delete client_document" ON public.client_document
    FOR DELETE TO authenticated
    USING (
        rbac.has_permission('clients.update', auth.uid())
        OR (
            rbac.has_permission('legal.update', auth.uid())
            AND document_type::text IN (
                'SOA', 'Payment History', 'Certificate of Ownership',
                'Contract', 'Deed of Sale', 'Title Copy'
            )
        )
    );

-- The bucket cannot see a file's document type, so Legal gets the same file
-- access it has on the rows it is allowed to manage.
DROP POLICY IF EXISTS "Allow read client documents" ON storage.objects;
CREATE POLICY "Allow read client documents" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'client-documents'
        AND (
            rbac.has_permission('clients.read', auth.uid())
            OR rbac.has_permission('legal.read', auth.uid())
        )
    );

DROP POLICY IF EXISTS "Allow insert client documents" ON storage.objects;
CREATE POLICY "Allow insert client documents" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'client-documents'
        AND (
            rbac.has_permission('clients.update', auth.uid())
            OR rbac.has_permission('clients.create', auth.uid())
            OR rbac.has_permission('legal.update', auth.uid())
        )
    );

DROP POLICY IF EXISTS "Allow delete client documents" ON storage.objects;
CREATE POLICY "Allow delete client documents" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'client-documents'
        AND (
            rbac.has_permission('clients.update', auth.uid())
            OR rbac.has_permission('legal.update', auth.uid())
        )
    );

NOTIFY pgrst, 'reload schema';
