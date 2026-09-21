-- ==============================================================================
-- CLIENT DOCUMENTS STORAGE BUCKET  (r20 Upload Client Documents)
--
-- Backs public.client_document, whose `file_path` column has until now been a
-- plain string pointing at nothing. One object in this bucket per document row.
--
-- The bucket is PRIVATE. These are valid IDs, deeds of sale and contracts, so
-- reads go through short-lived signed URLs rather than a public URL that stays
-- guessable forever. Do not flip `public` to true.
--
-- Path convention, mirrored by lib/storage/:
--   {client_id}/{uuid}-{sanitized-filename}
-- The client_id prefix lets a later policy narrow access per client without
-- moving any object; the uuid prefix stops two uploads of "id.jpg" colliding.
--
-- Access is gated by the same rbac permissions as the metadata table, so a role
-- can never hold the row and the file at different levels:
--   read   -> clients.read      (matches "Allow read client_document")
--   write  -> clients.update / clients.create
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'client-documents',
    'client-documents',
    FALSE,
    10485760, -- 10 MB; keep in step with serverActions.bodySizeLimit in next.config.ts
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- ROW LEVEL SECURITY ON storage.objects
--
-- RLS is already enabled on storage.objects by Supabase, so this only adds
-- policies. Every one is scoped to this bucket and leaves other buckets alone.
-- ==============================================================================

DROP POLICY IF EXISTS "Allow read client documents" ON storage.objects;
CREATE POLICY "Allow read client documents" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'client-documents'
        AND rbac.has_permission('clients.read', auth.uid())
    );

DROP POLICY IF EXISTS "Allow insert client documents" ON storage.objects;
CREATE POLICY "Allow insert client documents" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'client-documents'
        AND (
            rbac.has_permission('clients.update', auth.uid())
            OR rbac.has_permission('clients.create', auth.uid())
        )
    );

DROP POLICY IF EXISTS "Allow update client documents" ON storage.objects;
CREATE POLICY "Allow update client documents" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'client-documents'
        AND rbac.has_permission('clients.update', auth.uid())
    )
    WITH CHECK (
        bucket_id = 'client-documents'
        AND rbac.has_permission('clients.update', auth.uid())
    );

DROP POLICY IF EXISTS "Allow delete client documents" ON storage.objects;
CREATE POLICY "Allow delete client documents" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'client-documents'
        AND rbac.has_permission('clients.update', auth.uid())
    );
