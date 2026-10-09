import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const CLIENT_DOCUMENTS_BUCKET = "client-documents";

export { MAX_DOCUMENT_BYTES, ALLOWED_DOCUMENT_TYPES } from "@/lib/validations/document";

export function getStorageClient(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing S3 storage configuration (S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)"
    );
  }

  // Path-style addressing and on-demand checksums ensure compatibility across Supabase S3 and Backblaze B2
  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

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
  const client = getStorageClient();
  const path = buildObjectPath(clientId, file.name);
  const body = Buffer.from(await file.arrayBuffer());

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: CLIENT_DOCUMENTS_BUCKET,
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
 *
 * The bucket is private, so there is no permanent public URL to store. A link
 * is minted per view and expires, which is what keeps a leaked URL from being
 * a lasting exposure of someone's ID or deed.
 */
export async function createClientDocumentUrl(
  path: string,
  expiresInSeconds = 60
): Promise<string> {
  const client = getStorageClient();

  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: CLIENT_DOCUMENTS_BUCKET, Key: path }),
      { expiresIn: expiresInSeconds }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "No URL returned";
    throw new Error(`Failed to open document: ${message}`);
  }
}

export async function removeClientDocumentObject(path: string): Promise<void> {
  const client = getStorageClient();

  try {
    await client.send(
      new DeleteObjectCommand({ Bucket: CLIENT_DOCUMENTS_BUCKET, Key: path })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new Error(`Failed to remove stored document: ${message}`);
  }
}
