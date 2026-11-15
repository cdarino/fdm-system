-- Adds UPDATE policy for billing_notice_event so authenticated staff with billing.update permission can edit recorded notices
DROP POLICY IF EXISTS "billing_notice_event_update" ON public.billing_notice_event;
CREATE POLICY "billing_notice_event_update" ON public.billing_notice_event
    FOR UPDATE TO authenticated
    USING (rbac.has_permission('billing.update', auth.uid()))
    WITH CHECK (rbac.has_permission('billing.update', auth.uid()));

NOTIFY pgrst, 'reload schema';
