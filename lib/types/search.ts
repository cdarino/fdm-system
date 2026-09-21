/**
 * The `SearchIndex` from the domain model: extracted text for any entity,
 * keyed by type so land titles (MVP 2) can index into the same table.
 */
export type IndexableEntity = 'client_document' | 'land_title';

export interface SearchIndexEntry {
  index_id: string;
  entity_id: string;
  entity_type: string;
  content: string | null;
  keywords: string | null;
  indexed_at: string;
}

export interface IndexEntityInput {
  entity_id: string;
  entity_type: IndexableEntity;
  content?: string | null;
  keywords?: string | null;
}

export interface DocumentSearchHit {
  document_id: string;
  client_id: string;
  client_name: string;
  document_type: string;
  file_path: string;
  /** Text around the match, so a result shows why it was returned. */
  excerpt: string | null;
}

/** Where a document is in the OCR pipeline, tracked in the browser only. */
export type OcrStatus = 'idle' | 'running' | 'done' | 'failed';
