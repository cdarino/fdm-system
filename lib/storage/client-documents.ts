import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageBucket, getStorageClient } from "./s3";

export { getStorageBucket, getStorageClient };

/** Folder prefix inside the shared bucket for client documents. */
export const CLIENT_DOCUMENTS_FOLDER = "clients";

export { MAX_DOCUMENT_BYTES, ALLOWED_DOCUMENT_TYPES } from "@/lib/validations/document";

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

  return `${CLIENT_DOCUMENTS_FOLDER}/${clientId}/${crypto.randomUUID()}-${cleaned || "document"}`;
}

export async function uploadClientDocumentObject(
  clientId: string,
  file: File
): Promise<string> {
  const client = getStorageClient();
  const bucket = getStorageBucket();
  const path = buildObjectPath(clientId, file.name);
  const body = Buffer.from(await file.arrayBuffer());

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: body,
        ContentType: file.type,
        ContentLength: body.byteLength,
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new Error(`Failed to upload document: ${message}`);
  }

  return path;
}

/**
 * Short-lived URL for viewing or downloading one document.
 */
export async function createClientDocumentUrl(
  path: string,
  expiresInSeconds = 60,
  options?: { contentDisposition?: string; contentType?: string }
): Promise<string> {
  const client = getStorageClient();
  const bucket = getStorageBucket();

  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: path,
        ResponseContentDisposition: options?.contentDisposition,
        ResponseContentType: options?.contentType,
      }),
      { expiresIn: expiresInSeconds }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "No URL returned";
    throw new Error(`Failed to open document: ${message}`);
  }
}

export async function removeClientDocumentObject(path: string): Promise<void> {
  const client = getStorageClient();
  const bucket = getStorageBucket();

  try {
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: path })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new Error(`Failed to remove stored document: ${message}`);
  }
}
