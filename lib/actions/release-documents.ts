"use server";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createScope } from "@/lib/actions/action-handler";
import type { ActionResult } from "@/lib/actions/action-result";
import { uuidSchema } from "@/lib/validations/client";
import { documentFileSchema } from "@/lib/validations/document";
import {
  createClientDocumentUrl,
  removeClientDocumentObject,
  uploadClientDocumentObject,
} from "@/lib/storage/client-documents";
import { documentsForLot, getMissingReleaseDocuments } from "@/lib/utils/release-requirements";
import type { ClientDocument } from "@/lib/types/client";
import {
  RELEASE_DOCUMENT_TYPES,
  type ReleaseDocumentType,
  type TitleHolder,
} from "@/lib/types/title";

/**
 * The release packet is stored as the title client's documents, so everything
 * here reads and writes `client_document`. Legal can manage only the release
 * packet types (enforced again by the table's policies).
 */
const releaseRead = createScope(["legal.read"]);
const releaseWrite = createScope(["legal.update"]);

const releaseDocumentTypeSchema = z.enum(RELEASE_DOCUMENT_TYPES, {
  error: "Choose a release document type",
});

const uploadReleaseDocumentSchema = z.object({
  titleId: uuidSchema,
  document_type: releaseDocumentTypeSchema,
  file: documentFileSchema,
});

type TitleRef = { client_id: string; property_id: string; title_holder: TitleHolder | null };

async function loadTitle(supabase: SupabaseClient, titleId: string): Promise<TitleRef> {
  const { data, error } = await supabase
    .from("land_title")
    .select("client_id, property_id, title_holder")
    .eq("title_id", titleId)
    .single<TitleRef>();

  if (error || !data) {
    throw new Error(`Land title not found: ${error?.message ?? "Unknown error"}`);
  }
  return data;
}

/** Release types linked to the title's lot or to no lot, newest first. */
async function fetchReleaseDocuments(
  supabase: SupabaseClient,
  title: TitleRef
): Promise<ClientDocument[]> {
  const { data, error } = await supabase
    .from("client_document")
    .select("*")
    .eq("client_id", title.client_id)
    .in("document_type", [...RELEASE_DOCUMENT_TYPES])
    .order("uploaded_at", { ascending: false })
    .returns<ClientDocument[]>();

  if (error) {
    throw new Error(`Failed to fetch release documents: ${error.message}`);
  }

  return documentsForLot(data ?? [], title.property_id);
}

/** The client documents that make up a title's release packet. */
export async function getReleaseDocuments(titleId: string): Promise<ClientDocument[]> {
  return releaseRead.query({
    schema: uuidSchema,
    input: titleId,
    handler: async (validId, { supabase }) =>
      fetchReleaseDocuments(supabase, await loadTitle(supabase, validId)),
  });
}

/**
 * Uploads one release packet item as a client document linked to the title's
 * lot, so it also shows on the client's profile. An earlier file for the same
 * item and lot is replaced. A file with no lot is left alone, since it may
 * also serve the client's other lots.
 */
export async function uploadReleaseDocument(
  titleId: string,
  formData: FormData
): Promise<ActionResult<ClientDocument>> {
  return releaseWrite.run({
    schema: uploadReleaseDocumentSchema,
    input: {
      titleId,
      file: formData.get("file"),
      document_type: formData.get("document_type"),
    },
    handler: async ({ titleId: validId, document_type, file }, { supabase, userId }) => {
      const title = await loadTitle(supabase, validId);

      const { data: previous, error: previousError } = await supabase
        .from("client_document")
        .select("document_id, file_path")
        .eq("client_id", title.client_id)
        .eq("property_id", title.property_id)
        .eq("document_type", document_type)
        .returns<{ document_id: string; file_path: string }[]>();

      if (previousError) {
        throw new Error(`Failed to check existing documents: ${previousError.message}`);
      }

      const filePath = await uploadClientDocumentObject(title.client_id, file);

      const { data, error } = await supabase
        .from("client_document")
        .insert({
          client_id: title.client_id,
          property_id: title.property_id,
          document_type,
          file_path: filePath,
          uploaded_by: userId,
        })
        .select()
        .single<ClientDocument>();

      if (error || !data) {
        await removeClientDocumentObject(filePath).catch((cleanupError) => {
          console.error(`Orphaned object ${filePath} after failed insert:`, cleanupError);
        });
        throw new Error(`Failed to save release document: ${error?.message ?? "Unknown error"}`);
      }

      for (const old of previous ?? []) {
        const { error: deleteError } = await supabase
          .from("client_document")
          .delete()
          .eq("document_id", old.document_id);
        if (deleteError) {
          console.error(`Failed to remove replaced document ${old.document_id}:`, deleteError.message);
          continue;
        }
        await removeClientDocumentObject(old.file_path).catch((storageError) => {
          console.error(`Failed to remove replaced object ${old.file_path}:`, storageError);
        });
      }

      return data;
    },
  });
}

export async function getReleaseDocumentUrl(documentId: string): Promise<string> {
  return releaseRead.query({
    schema: uuidSchema,
    input: documentId,
    handler: async (validId, { supabase }) => {
      const { data, error } = await supabase
        .from("client_document")
        .select("file_path")
        .eq("document_id", validId)
        .single<{ file_path: string }>();

      if (error || !data) {
        throw new Error(`Document not found: ${error?.message ?? "Unknown error"}`);
      }

      return createClientDocumentUrl(data.file_path);
    },
  });
}

/**
 * Removes a release packet item. It is the client's document, so it also
 * disappears from the client's profile.
 */
export async function deleteReleaseDocument(documentId: string): Promise<ActionResult<void>> {
  return releaseWrite.run({
    schema: uuidSchema,
    input: documentId,
    handler: async (validId, { supabase }) => {
      const { data: existing, error: lookupError } = await supabase
        .from("client_document")
        .select("file_path, document_type")
        .eq("document_id", validId)
        .single<{ file_path: string; document_type: string }>();

      if (lookupError || !existing) {
        throw new Error(`Document not found: ${lookupError?.message ?? "Unknown error"}`);
      }
      if (!(RELEASE_DOCUMENT_TYPES as readonly string[]).includes(existing.document_type)) {
        throw new Error("Only release packet documents can be removed from the Legal page.");
      }

      const { error } = await supabase.from("client_document").delete().eq("document_id", validId);
      if (error) {
        throw new Error(`Failed to delete release document: ${error.message}`);
      }

      await removeClientDocumentObject(existing.file_path).catch((storageError) => {
        console.error(`Failed to remove storage object ${existing.file_path}:`, storageError);
      });
    },
  });
}

/**
 * The release documents a title is still missing. Route Title Release for
 * Approval (S3-13) calls this before letting a release reach Management.
 */
export async function getMissingReleaseDocumentsForTitle(
  titleId: string
): Promise<ReleaseDocumentType[]> {
  return releaseRead.query({
    schema: uuidSchema,
    input: titleId,
    handler: async (validId, { supabase }) => {
      const title = await loadTitle(supabase, validId);
      const documents = await fetchReleaseDocuments(supabase, title);
      return getMissingReleaseDocuments(
        title.title_holder,
        documents.map((d) => d.document_type)
      );
    },
  });
}
