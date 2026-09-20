-- ==============================================================================
-- SEARCH INDEX  (r21 Scan and Categorize Documents)
--
-- Holds the text recovered from scanned paperwork by OCR, so a document can be
-- found by what is written inside it rather than only by its category and
-- filename. This is the `SearchIndex` class from the domain model.
--
-- Deliberately generic: `entity_type` + `entity_id` means land titles and their
-- supporting documents (MVP 2) index into the same table without a schema
-- change. Nothing here is specific to client documents.
--
-- There is no foreign key, because the referenced row lives in a different
-- table depending on `entity_type`. Rows are cleaned up by the action that
-- deletes the entity; see `deleteClientDocument`.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.search_index (
    index_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   UUID NOT NULL,
    entity_type TEXT NOT NULL,
    content     TEXT,
    keywords    TEXT,
    indexed_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- One index row per entity. The OCR result is upserted onto this.
    CONSTRAINT uq_search_index_entity UNIQUE (entity_type, entity_id)
);

-- Generated rather than maintained by a trigger, so it can never drift from the
-- text it describes. `keywords` is weighted above `content`: a category or a
-- lot number deliberately attached to a document is a stronger signal than a
-- word that happens to appear somewhere in a scanned page.
ALTER TABLE public.search_index
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(keywords, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'B')
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_search_index_vector
    ON public.search_index USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_search_index_entity
    ON public.search_index (entity_type, entity_id);

-- ==============================================================================
-- ROW LEVEL SECURITY
--
-- The index carries the full text of scanned IDs, contracts and deeds, so it is
-- read-gated exactly like the documents it describes. Writes require the same
-- permission as uploading the document that produced the text.
-- ==============================================================================

ALTER TABLE public.search_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read search_index" ON public.search_index;
CREATE POLICY "Allow read search_index" ON public.search_index
    FOR SELECT TO authenticated
    USING (rbac.has_permission('clients.read', auth.uid()));

DROP POLICY IF EXISTS "Allow insert search_index" ON public.search_index;
CREATE POLICY "Allow insert search_index" ON public.search_index
    FOR INSERT TO authenticated
    WITH CHECK (rbac.has_permission('clients.update', auth.uid()));

DROP POLICY IF EXISTS "Allow update search_index" ON public.search_index;
CREATE POLICY "Allow update search_index" ON public.search_index
    FOR UPDATE TO authenticated
    USING (rbac.has_permission('clients.update', auth.uid()))
    WITH CHECK (rbac.has_permission('clients.update', auth.uid()));

DROP POLICY IF EXISTS "Allow delete search_index" ON public.search_index;
CREATE POLICY "Allow delete search_index" ON public.search_index
    FOR DELETE TO authenticated
    USING (rbac.has_permission('clients.update', auth.uid()));

GRANT ALL ON TABLE public.search_index TO authenticated, service_role;
