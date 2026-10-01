"use server";

import { createScope } from "@/lib/actions/action-handler";
import type {
  SearchIndexEntry,
  IndexEntityInput,
  DocumentSearchHit,
} from "@/lib/types/search";
import {
  indexEntityInputSchema,
  entityKeySchema,
  searchDocumentQuerySchema,
} from "@/lib/validations/search";

interface RawIndexRow {
  entity_id: string;
  content: string | null;
  keywords: string | null;
}

const searchRead = createScope(["clients.read"]);
const searchWrite = searchRead.extend(["clients.update"]);

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

function countMatchedWords(row: RawIndexRow, words: string[]): number {
  const haystack = `${row.keywords ?? ""} ${row.content ?? ""}`.toLowerCase();
  return words.reduce((total, word) => (haystack.includes(word) ? total + 1 : total), 0);
}

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

export async function indexEntityText(
  input: IndexEntityInput
): Promise<SearchIndexEntry> {
  return searchWrite.execute({
    schema: indexEntityInputSchema,
    input,
    handler: async (validatedInput, { supabase }) => {
      const { data, error } = await supabase
        .from("search_index")
        .upsert(
          {
            entity_id: validatedInput.entity_id,
            entity_type: validatedInput.entity_type,
            content: validatedInput.content || null,
            keywords: validatedInput.keywords || null,
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
    },
  });
}

export async function getEntityIndex(
  entityType: string,
  entityId: string
): Promise<SearchIndexEntry | null> {
  return searchRead.query({
    schema: entityKeySchema,
    input: { entityType, entityId },
    handler: async ({ entityType: type, entityId: id }, { supabase }) => {
      const { data, error } = await supabase
        .from("search_index")
        .select("*")
        .eq("entity_type", type)
        .eq("entity_id", id)
        .maybeSingle<SearchIndexEntry>();

      if (error) {
        throw new Error(`Failed to read search index: ${error.message}`);
      }

      return data;
    },
  });
}

export async function deleteEntityIndex(
  entityType: string,
  entityId: string
): Promise<void> {
  return searchWrite.execute({
    schema: entityKeySchema,
    input: { entityType, entityId },
    handler: async ({ entityType: type, entityId: id }, { supabase }) => {
      const { error } = await supabase
        .from("search_index")
        .delete()
        .eq("entity_type", type)
        .eq("entity_id", id);

      if (error) {
        throw new Error(`Failed to remove search index entry: ${error.message}`);
      }
    },
  });
}

export async function searchDocumentText(
  query: string,
  limit = 20
): Promise<DocumentSearchHit[]> {
  return searchRead.query({
    schema: searchDocumentQuerySchema,
    input: { query, limit },
    handler: async ({ query: searchQuery, limit: searchLimit }, { supabase }) => {
      const words = toSearchWords(searchQuery);
      if (words.length === 0) return [];

      const anyWord = words.join(" or ");
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
          .limit(searchLimit * 3)
          .returns<RawIndexRow[]>(),
        supabase
          .from("search_index")
          .select("entity_id, content, keywords")
          .eq("entity_type", "client_document")
          .or(ilikeFilter)
          .limit(searchLimit * 3)
          .returns<RawIndexRow[]>(),
      ]);

      if (fullText.error && substring.error) {
        throw new Error(`Search failed: ${fullText.error.message}`);
      }

      const merged = new Map<string, RawIndexRow>();
      for (const row of [...(fullText.data ?? []), ...(substring.data ?? [])]) {
        if (!merged.has(row.entity_id)) merged.set(row.entity_id, row);
      }

      const matches = Array.from(merged.values())
        .map((row) => ({ row, score: countMatchedWords(row, words) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, searchLimit)
        .map(({ row }) => row);

      if (matches.length === 0) return [];

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
    },
  });
}
