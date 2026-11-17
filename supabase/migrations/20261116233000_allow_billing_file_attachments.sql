-- Allow billing staff to manage client clearance attachments (SOA, Payment History)
DROP POLICY IF EXISTS "Allow insert file_attachment" ON public.file_attachment;
CREATE POLICY "Allow insert file_attachment" ON public.file_attachment
    FOR INSERT TO authenticated
    WITH CHECK (
        (entity_type = 'client'
            AND (rbac.has_permission('clients.update', auth.uid())
                 OR rbac.has_permission('clients.create', auth.uid())
                 OR rbac.has_permission('billing.update', auth.uid())
                 OR rbac.has_permission('billing.create', auth.uid())))
        OR (entity_type IN ('land_title', 'land_title_notice')
            AND (rbac.has_permission('legal.update', auth.uid())
                 OR rbac.has_permission('legal.create', auth.uid())))
        OR (entity_type = 'property'
            AND rbac.has_permission('properties.update', auth.uid()))
    );

DROP POLICY IF EXISTS "Allow update file_attachment" ON public.file_attachment;
CREATE POLICY "Allow update file_attachment" ON public.file_attachment
    FOR UPDATE TO authenticated
    USING (
        (entity_type = 'client'
            AND (rbac.has_permission('clients.update', auth.uid())
                 OR rbac.has_permission('billing.update', auth.uid())))
        OR (entity_type IN ('land_title', 'land_title_notice')
            AND rbac.has_permission('legal.update', auth.uid()))
        OR (entity_type = 'property'
            AND rbac.has_permission('properties.update', auth.uid()))
    )
    WITH CHECK (
        (entity_type = 'client'
            AND (rbac.has_permission('clients.update', auth.uid())
                 OR rbac.has_permission('billing.update', auth.uid())))
        OR (entity_type IN ('land_title', 'land_title_notice')
            AND rbac.has_permission('legal.update', auth.uid()))
        OR (entity_type = 'property'
            AND rbac.has_permission('properties.update', auth.uid()))
    );

DROP POLICY IF EXISTS "Allow delete file_attachment" ON public.file_attachment;
CREATE POLICY "Allow delete file_attachment" ON public.file_attachment
    FOR DELETE TO authenticated
    USING (
        (entity_type = 'client'
            AND (rbac.has_permission('clients.update', auth.uid())
                 OR rbac.has_permission('clients.delete', auth.uid())
                 OR rbac.has_permission('billing.update', auth.uid())
                 OR rbac.has_permission('billing.delete', auth.uid())))
        OR (entity_type IN ('land_title', 'land_title_notice')
            AND (rbac.has_permission('legal.update', auth.uid())
                 OR rbac.has_permission('legal.delete', auth.uid())))
        OR (entity_type = 'property'
            AND (rbac.has_permission('properties.update', auth.uid())
                 OR rbac.has_permission('properties.delete', auth.uid())))
    );
