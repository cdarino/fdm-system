"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createScope } from "@/lib/actions/action-handler";
import type { ActionResult } from "@/lib/actions/action-result";
import { uuidSchema } from "@/lib/validations/client";
import {
  recordTitleNoticeSchema,
  resolveTitleNoticeSchema,
  deleteTitleNoticeRtsSchema,
} from "@/lib/validations/title-notice";
import {
  removeClientDocumentObject,
  uploadClientDocumentObject,
} from "@/lib/storage/client-documents";
import type { FileAttachment, LandTitleNotice, TitleStatus } from "@/lib/types/title";

const noticeRead = createScope(["legal.read"]);
const noticeWrite = createScope(["legal.update"]);

type TitleRef = {
  title_id: string;
  client_id: string;
  property_id: string;
  status: TitleStatus;
};

async function loadTitle(supabase: SupabaseClient, titleId: string): Promise<TitleRef> {
  const { data, error } = await supabase
    .from("land_title")
    .select("title_id, client_id, property_id, status")
    .eq("title_id", titleId)
    .single<TitleRef>();

  if (error || !data) {
    throw new Error(`Land title not found: ${error?.message ?? "Unknown error"}`);
  }
  return data;
}

export async function getTitleNotices(titleId: string): Promise<LandTitleNotice[]> {
  return noticeRead.query({
    schema: uuidSchema,
    input: titleId,
    handler: async (validId, { supabase }) => {
      const { data, error } = await supabase
        .from("land_title_notice")
        .select("*, rts_attachment:rts_attachment_id(*)")
        .eq("title_id", validId)
        .order("notice_number", { ascending: true })
        .returns<LandTitleNotice[]>();

      if (error) {
        throw new Error(`Failed to load notices: ${error.message}`);
      }

      return data ?? [];
    },
  });
}

export async function recordTitleNotice(input: {
  titleId: string;
  notice_number: number;
}): Promise<ActionResult<LandTitleNotice>> {
  return noticeWrite.run({
    schema: recordTitleNoticeSchema,
    input,
    handler: async ({ titleId: validId, notice_number }, { supabase, userId }) => {
      const title = await loadTitle(supabase, validId);
      if (title.status !== "Ready for Claim" && title.status !== "Released") {
        throw new Error("Notice can only be recorded when title is Ready for Claim or Released.");
      }

      const existingNotices = await supabase
        .from("land_title_notice")
        .select("notice_number, status, rts_attachment_id")
        .eq("title_id", validId)
        .order("notice_number", { ascending: true })
        .returns<{ notice_number: number; status: string; rts_attachment_id: string | null }[]>();

      const notices = existingNotices.data ?? [];
      const notice1 = notices.find((n) => n.notice_number === 1);
      const notice2 = notices.find((n) => n.notice_number === 2);

      // Validate sequential notice escalation requirements
      if (notice_number === 2 && (!notice1 || notice1.status === "ongoing")) {
        throw new Error("Notice 2 requires 1st Notice resolution before dispatch.");
      }
      if (notice_number === 3 && (!notice2 || notice2.status === "ongoing")) {
        throw new Error("Final Notice requires 2nd Notice resolution before dispatch.");
      }

      const { data, error } = await supabase
        .from("land_title_notice")
        .insert({
          title_id: validId,
          notice_number,
          status: "ongoing",
          generated_by: userId,
        })
        .select("*, rts_attachment:rts_attachment_id(*)")
        .single<LandTitleNotice>();

      if (error || !data) {
        throw new Error(`Failed to record notice: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
}

export async function resolveTitleNotice(
  titleId: string,
  noticeNumber: number,
  formData: FormData
): Promise<ActionResult<LandTitleNotice>> {
  return noticeWrite.run({
    schema: resolveTitleNoticeSchema,
    input: {
      titleId,
      notice_number: noticeNumber,
      status: formData.get("status"),
      notes: formData.get("notes") ?? formData.get("rts_reason"),
      file: formData.get("file"),
    },
    handler: async (
      { titleId: validId, notice_number, status, notes, file },
      { supabase, userId }
    ) => {
      const title = await loadTitle(supabase, validId);

      const { data: noticeRecord, error: noticeFetchError } = await supabase
        .from("land_title_notice")
        .select("notice_id, rts_attachment_id")
        .eq("title_id", validId)
        .eq("notice_number", notice_number)
        .maybeSingle<{ notice_id: string; rts_attachment_id: string | null }>();

      if (noticeFetchError || !noticeRecord) {
        throw new Error("Notice must be started before updating status.");
      }

      // Upload file to client documents storage bucket
      const filePath = await uploadClientDocumentObject(title.client_id, file);
      const fileCategory = status === "received" ? "Notice Waybill" : "Return to Sender";

      // Record in centralized file_attachment table
      const { data: attachment, error: attachError } = await supabase
        .from("file_attachment")
        .insert({
          entity_type: "land_title",
          entity_id: validId,
          file_category: fileCategory,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          metadata: {
            notice_number,
            status,
            [status === "received" ? "tracking_notes" : "rts_reason"]: notes ?? null,
          },
          uploaded_by: userId,
        })
        .select()
        .single<FileAttachment>();

      if (attachError || !attachment) {
        await removeClientDocumentObject(filePath).catch((cleanupError) => {
          console.error(`Orphaned notice proof file ${filePath}:`, cleanupError);
        });
        throw new Error(`Failed to record attachment: ${attachError?.message ?? "Unknown error"}`);
      }

      // Link attachment to land_title_notice and record resolution status
      const { data: updatedNotice, error: updateError } = await supabase
        .from("land_title_notice")
        .update({
          status,
          status_updated_at: new Date().toISOString(),
          rts_attachment_id: attachment.attachment_id,
          rts_reason: status === "returned_to_sender" ? notes ?? null : null,
          tracking_number: status === "received" ? notes ?? null : null,
          updated_at: new Date().toISOString(),
        })
        .eq("notice_id", noticeRecord.notice_id)
        .select("*, rts_attachment:rts_attachment_id(*)")
        .single<LandTitleNotice>();

      if (updateError || !updatedNotice) {
        throw new Error(`Failed to link attachment to notice: ${updateError?.message ?? "Unknown error"}`);
      }

      // Purge previous attachment if replacing
      if (noticeRecord.rts_attachment_id) {
        const { data: oldAttach } = await supabase
          .from("file_attachment")
          .select("file_path")
          .eq("attachment_id", noticeRecord.rts_attachment_id)
          .single<{ file_path: string }>();

        await supabase
          .from("file_attachment")
          .delete()
          .eq("attachment_id", noticeRecord.rts_attachment_id);

        if (oldAttach?.file_path) {
          await removeClientDocumentObject(oldAttach.file_path).catch((purgeError) => {
            console.error(`Failed to purge old notice proof object:`, purgeError);
          });
        }
      }

      return updatedNotice;
    },
  });
}

export async function uploadTitleNoticeRts(
  titleId: string,
  noticeNumber: number,
  formData: FormData
): Promise<ActionResult<LandTitleNotice>> {
  if (!formData.has("status")) {
    formData.set("status", "returned_to_sender");
  }
  return resolveTitleNotice(titleId, noticeNumber, formData);
}

export async function getTitleNoticeRtsUrl(attachmentId: string): Promise<string> {
  return noticeRead.query({
    schema: uuidSchema,
    input: attachmentId,
    handler: async (validId, { supabase }) => {
      const { data, error } = await supabase
        .from("file_attachment")
        .select("attachment_id")
        .eq("attachment_id", validId)
        .single<{ attachment_id: string }>();

      if (error || !data) {
        throw new Error(`Proof attachment not found: ${error?.message ?? "Unknown error"}`);
      }

      return `/api/documents/${validId}`;
    },
  });
}

export const getNoticeProofUrl = getTitleNoticeRtsUrl;

export async function undoTitleNoticeStatus(
  titleId: string,
  noticeNumber: number
): Promise<ActionResult<void>> {
  return noticeWrite.run({
    schema: deleteTitleNoticeRtsSchema,
    input: { titleId, notice_number: noticeNumber },
    handler: async ({ titleId: validId, notice_number }, { supabase }) => {
      const { data: notices } = await supabase
        .from("land_title_notice")
        .select("notice_number, rts_attachment_id")
        .eq("title_id", validId)
        .order("notice_number", { ascending: true })
        .returns<{ notice_number: number; rts_attachment_id: string | null }[]>();

      const subsequentNotice = (notices ?? []).find(
        (n) => n.notice_number > notice_number
      );
      if (subsequentNotice) {
        throw new Error(
          `Cannot undo Notice ${noticeNumber} status because a subsequent notice has already been started.`
        );
      }

      const target = (notices ?? []).find((n) => n.notice_number === notice_number);
      if (!target) return;

      const attachmentId = target.rts_attachment_id;

      await supabase
        .from("land_title_notice")
        .update({
          status: "ongoing",
          status_updated_at: null,
          rts_attachment_id: null,
          rts_reason: null,
          tracking_number: null,
          updated_at: new Date().toISOString(),
        })
        .eq("title_id", validId)
        .eq("notice_number", notice_number);

      if (attachmentId) {
        const { data: attach } = await supabase
          .from("file_attachment")
          .select("file_path")
          .eq("attachment_id", attachmentId)
          .single<{ file_path: string }>();

        await supabase.from("file_attachment").delete().eq("attachment_id", attachmentId);

        if (attach?.file_path) {
          await removeClientDocumentObject(attach.file_path).catch((err) => {
            console.error(`Failed to purge deleted proof object:`, err);
          });
        }
      }
    },
  });
}

export const deleteTitleNoticeRts = undoTitleNoticeStatus;
