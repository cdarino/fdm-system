-- Migration: Add spouse_contact to public.client
ALTER TABLE public.client
    ADD COLUMN IF NOT EXISTS spouse_contact TEXT[] NULL DEFAULT '{}'::TEXT[];

COMMENT ON COLUMN public.client.spouse_contact IS 'Contact information for spouse. Required when civil_status is Married.';
