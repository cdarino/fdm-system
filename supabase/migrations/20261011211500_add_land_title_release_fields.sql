-- Add release tracking fields to land_title
ALTER TABLE public.land_title
  ADD COLUMN IF NOT EXISTS released_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_to_name        TEXT,
  ADD COLUMN IF NOT EXISTS released_to_id          TEXT,
  ADD COLUMN IF NOT EXISTS release_remarks         TEXT,
  ADD COLUMN IF NOT EXISTS release_attachment_id   UUID REFERENCES public.file_attachment(attachment_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_land_title_release_attachment_id
  ON public.land_title (release_attachment_id);

NOTIFY pgrst, 'reload schema';
