-- Batch resolves user display names from auth.users metadata or email.

CREATE OR REPLACE FUNCTION public.get_user_names(p_user_ids UUID[])
RETURNS TABLE (
    id UUID,
    full_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
    SELECT
        u.id,
        COALESCE(
            NULLIF(TRIM(CONCAT(
                u.raw_user_meta_data->>'first_name', ' ',
                u.raw_user_meta_data->>'last_name'
            )), ''),
            u.email,
            'System'
        ) AS full_name
    FROM auth.users u
    WHERE u.id = ANY(p_user_ids);
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_names(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_names(UUID[]) TO authenticated, service_role;

