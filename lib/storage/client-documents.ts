import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Object storage for client paperwork, backing `client_document.file_path`.
 *
 * Every call goes through the request-scoped (cookie-bound) Supabase client, so
 * the policies added in 20260920200000 are enforced as the signed-in user. Do
 * not swap in the admin client here: it bypasses RLS and would silently undo
 * the permission gating on the bucket.
 */

export const CLIENT_DOCUMENTS_BUCKET = "client-documents";

/** Matches the bucket's own limits, declared in the migration. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

/**
 * `{client_id}/{uuid}-{sanitized-filename}`.
 *
 * The client prefix keeps one client's files together and lets a later policy
 * narrow access per client without moving any object. The uuid makes collisions
 * impossible, so two uploads named "id.jpg" cannot overwrite each other. The
 * name is stripped of anything that could be read as a path segment.
 */
function buildObjectPath(clientId: string, fileName: string): string {
  const cleaned = fileName
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(-100);

  return `${clientId}/${crypto.randomUUID()}-${cleaned || "document"}`;
}

export async function uploadClientDocumentObject(
  clientId: string,
  file: File
): Promise<string> {
  const supabase = await createClient();
  const path = buildObjectPath(clientId, file.name);

  const { error } = await supabase.storage
    .from(CLIENT_DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new Error(`Failed to upload document: ${error.message}`);
  }

  return path;
}

/**
 * Short-lived URL for viewing or downloading one document.
 *
 * The bucket is private, so there is no permanent public URL to store. A link
 * is minted per view and expires, which is what keeps a leaked URL from being
 * a lasting exposure of someone's ID or deed.
 */
export async function createClientDocumentUrl(
  path: string,
  expiresInSeconds = 60
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(CLIENT_DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to open document: ${error?.message ?? "No URL returned"}`);
  }

  return data.signedUrl;
}

export async function removeClientDocumentObject(path: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.storage
    .from(CLIENT_DOCUMENTS_BUCKET)
    .remove([path]);

  if (error) {
    throw new Error(`Failed to remove stored document: ${error.message}`);
  }
}
