"use server";

import { createScope } from "@/lib/actions/action-handler";
import type { ActionResult } from "@/lib/actions/action-result";
import { requireAnyPermission } from "@/lib/actions/auth-guard";
import { uuidSchema } from "@/lib/validations/client";
import { uploadAttachmentSchema } from "@/lib/validations/attachment";
import {
  removeClientDocumentObject,
  uploadClientDocumentObject,
} from "@/lib/storage/client-documents";
import type { FileAttachment } from "@/lib/types/title";

const attachmentBase = createScope();

export async function uploadAttachment(
  formData: FormData
): Promise<ActionResult<FileAttachment>> {
  return attachmentBase.run({
    schema: uploadAttachmentSchema,
    input: {
      entity_type: formData.get("entity_type"),
      entity_id: formData.get("entity_id"),
      file_category: formData.get("file_category"),
      file: formData.get("file"),
      metadata: formData.get("metadata")
        ? JSON.parse(String(formData.get("metadata")))
        : {},
    },
    handler: async (
      { entity_type, entity_id, file_category, file, metadata },
      { supabase, userId }
    ) => {
      await requireAnyPermission([
        "clients.update",
        "clients.create",
        "legal.update",
        "properties.update",
      ]);

      const filePath = await uploadClientDocumentObject(entity_id, file);

      const { data, error } = await supabase
        .from("file_attachment")
        .insert({
          entity_type,
          entity_id,
          // Client paperwork is linked by `client_id` so it joins from `client`.
          client_id: entity_type === "client" ? entity_id : null,
          file_category,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          metadata: metadata ?? {},
          uploaded_by: userId,
        })
        .select()
        .single<FileAttachment>();

      if (error || !data) {
        await removeClientDocumentObject(filePath).catch((cleanupError) => {
          console.error(`Orphaned object ${filePath} after insert failure:`, cleanupError);
        });
        throw new Error(`Failed to save attachment record: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
}

export async function getAttachmentUrl(attachmentId: string): Promise<string> {
  return attachmentBase.query({
    schema: uuidSchema,
    input: attachmentId,
    handler: async (validId, { supabase }) => {
      await requireAnyPermission([
        "clients.read",
        "legal.read",
        "properties.read",
      ]);

      const { data, error } = await supabase
        .from("file_attachment")
        .select("attachment_id")
        .eq("attachment_id", validId)
        .single<{ attachment_id: string }>();

      if (error || !data) {
        throw new Error(`Attachment not found: ${error?.message ?? "Unknown error"}`);
      }

      return `/api/documents/${validId}`;
    },
  });
}

export async function deleteAttachment(
  attachmentId: string
): Promise<ActionResult<void>> {
  return attachmentBase.run({
    schema: uuidSchema,
    input: attachmentId,
    handler: async (validId, { supabase }) => {
      await requireAnyPermission([
        "clients.update",
        "legal.update",
        "properties.update",
      ]);

      const { data: existing, error: fetchError } = await supabase
        .from("file_attachment")
        .select("file_path")
        .eq("attachment_id", validId)
        .single<{ file_path: string }>();

      if (fetchError || !existing) {
        throw new Error(`Attachment not found: ${fetchError?.message ?? "Unknown error"}`);
      }

      const { error: deleteError } = await supabase
        .from("file_attachment")
        .delete()
        .eq("attachment_id", validId);

      if (deleteError) {
        throw new Error(`Failed to delete attachment: ${deleteError.message}`);
      }

      await removeClientDocumentObject(existing.file_path).catch((storageError) => {
        console.error(`Failed to purge object ${existing.file_path}:`, storageError);
      });
    },
  });
}
