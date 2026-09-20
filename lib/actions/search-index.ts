"use server";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/actions/auth-guard";
import type {
  SearchIndexEntry,
  IndexEntityInput,
  DocumentSearchHit,
} from "@/lib/types/search";

/**
 * Stores the text OCR recovered from a scanned entity.
 *
 * Upserted on (entity_type, entity_id), so re-running OCR over the same
 * document replaces the old text instead of accumulating copies.
 */
export async function indexEntityText(
  input: IndexEntityInput
): Promise<SearchIndexEntry> {
  await requirePermission("clients.update");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("search_index")
    .upsert(
      {
        entity_id: input.entity_id,
        entity_type: input.entity_type,
        content: input.content?.trim() || null,
        keywords: input.keywords?.trim() || null,
        indexed_at: new Date().toISOString(),
      },
      { onConflict: "entity_type,entity_id" }
    )
    .select()
    .single<SearchIndexEntry>();

  if (error || !data) {
    throw new Error(`Failed to index document text: ${error?.message ?? "Unknown error"}`);
  }

  return data;
}

export async function getEntityIndex(
  entityType: string,
  entityId: string
): Promise<SearchIndexEntry | null> {
  await requirePermission("clients.read");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("search_index")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle<SearchIndexEntry>();

  if (error) {
    throw new Error(`Failed to read search index: ${error.message}`);
  }

  return data;
}

export async function deleteEntityIndex(
  entityType: string,
  entityId: string
): Promise<void> {
  await requirePermission("clients.update");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("search_index")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (error) {
    throw new Error(`Failed to remove search index entry: ${error.message}`);
  }
}

/**
 * Full-text search across scanned document contents.
 *
 * Matching is deliberately forgiving. A document whose filename was sanitised
 * to `deed_of_sale_sample.pdf` has to be findable by typing "deed of sale",
 * and a search for four words should not come back empty because one of them
 * is missing. So the words are searched with OR rather than AND, and results
 * are ranked by how many of them a document actually matched.
 *
 * Two passes run because full-text search alone is not enough here:
 *  - Full-text catches word variants, so "sales" finds "sale".
 *  - ILIKE catches what the text parser glues together, such as `sample` inside
 *    `sample.pdf` or an underscore-joined filename, which tokenise as one word
 *    and are therefore invisible to a plain word query.
 */
export async function searchDocumentText(
  query: string,
  limit = 20
): Promise<DocumentSearchHit[]> {
  await requirePermission("clients.read");

  const words = toSearchWords(query);
  if (words.length === 0) return [];

  const supabase = await createSupabaseServerClient();

  // `or` is websearch syntax, so this asks for any word rather than all of them.
  const anyWord = words.join(" or ");

  // PostgREST parses `or=(...)` itself, so a comma or parenthesis inside a
  // value would break out of the filter. Those are already stripped by
  // `toSearchWords`, and `%` is escaped so it cannot widen the pattern.
  const ilikeFilter = words
    .flatMap((word) => {
      const safe = word.replace(/%/g, "\\%");
      return [`content.ilike.*${safe}*`, `keywords.ilike.*${safe}*`];
    })
    .join(",");

  const [fullText, substring] = await Promise.all([
    supabase
      .from("search_index")
      .select("entity_id, content, keywords")
      .eq("entity_type", "client_document")
      .textSearch("search_vector", anyWord, { type: "websearch" })
      .limit(limit * 3)
      .returns<RawIndexRow[]>(),
    supabase
      .from("search_index")
      .select("entity_id, content, keywords")
      .eq("entity_type", "client_document")
      .or(ilikeFilter)
      .limit(limit * 3)
      .returns<RawIndexRow[]>(),
  ]);

  if (fullText.error && substring.error) {
    throw new Error(`Search failed: ${fullText.error.message}`);
  }

  // One pass failing is survivable: the other still returns results, which is
  // better than showing nothing because of a malformed query.
  const merged = new Map<string, RawIndexRow>();
  for (const row of [...(fullText.data ?? []), ...(substring.data ?? [])]) {
    if (!merged.has(row.entity_id)) merged.set(row.entity_id, row);
  }

  const matches = Array.from(merged.values())
    .map((row) => ({ row, score: countMatchedWords(row, words) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row }) => row);

  if (matches.length === 0) return [];

  // Second hop for the document and client each hit belongs to. The index is
  // deliberately free of foreign keys, so this cannot be a join.
  const { data: documents, error: docError } = await supabase
    .from("client_document")
    .select("document_id, client_id, document_type, file_path, client(full_name)")
    .in(
      "document_id",
      matches.map((m) => m.entity_id)
    )
    .returns<
      Array<{
        document_id: string;
        client_id: string;
        document_type: string;
        file_path: string;
        client: { full_name: string } | null;
      }>
    >();

  if (docError) {
    throw new Error(`Failed to resolve search results: ${docError.message}`);
  }

  const contentById = new Map(matches.map((m) => [m.entity_id, m.content]));
  const documentById = new Map((documents ?? []).map((doc) => [doc.document_id, doc]));

  // Driven from `matches`, not from `documents`: the rows come back in whatever
  // order the database returns them, and the ranking is the point.
  return matches
    .map((match) => documentById.get(match.entity_id))
    .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
    .map((doc) => ({
      document_id: doc.document_id,
      client_id: doc.client_id,
      client_name: doc.client?.full_name ?? "Unknown client",
      document_type: doc.document_type,
      file_path: doc.file_path,
      excerpt: buildExcerpt(contentById.get(doc.document_id) ?? null, words),
    }));
}

interface RawIndexRow {
  entity_id: string;
  content: string | null;
  keywords: string | null;
}

/**
 * Splits input into plain words a search can work with.
 *
 * Underscores, hyphens and dots are treated as spaces, because a file saved as
 * `deed_of_sale_sample.pdf` is a person typing "deed of sale sample". Commas
 * and parentheses are dropped since PostgREST reads them as filter syntax.
 * Single characters are dropped as too noisy to be worth an OR branch.
 */
function toSearchWords(input: string): string[] {
  return Array.from(
    new Set(
      input
        .toLowerCase()
        .replace(/[_\-.]+/g, " ")
        .replace(/[(),*"']/g, " ")
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 1)
    )
  );
}

/** How many of the searched words a row actually contains, used for ranking. */
function countMatchedWords(row: RawIndexRow, words: string[]): number {
  const haystack = `${row.keywords ?? ""} ${row.content ?? ""}`.toLowerCase();
  return words.reduce((total, word) => (haystack.includes(word) ? total + 1 : total), 0);
}

/**
 * A window of text around the first match, so a hit shows why it matched.
 *
 * Every searched word is tried, not just the first: with OR matching the
 * document may well have matched on the last word typed, and an excerpt drawn
 * from elsewhere would not explain the result.
 */
function buildExcerpt(content: string | null, words: string[]): string | null {
  if (!content) return null;

  const haystack = content.toLowerCase();
  const position = words
    .map((word) => haystack.indexOf(word))
    .filter((index) => index !== -1)
    .sort((a, b) => a - b)[0] ?? -1;

  if (position === -1) return content.slice(0, 160).trim();

  const start = Math.max(0, position - 60);
  const excerpt = content.slice(start, start + 200).trim();

  return `${start > 0 ? "…" : ""}${excerpt}${start + 200 < content.length ? "…" : ""}`;
}
