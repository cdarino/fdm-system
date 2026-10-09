import { z } from "zod";

/** Matches the storage buckets' own limits, declared in their migrations. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

/** The `accept` attribute for file inputs that feed these buckets. */
export const DOCUMENT_FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png";

/** An uploaded scan: a non-empty PDF, JPEG or PNG of at most 10MB. */
export const documentFileSchema = z
  .custom<File>((val) => val instanceof File && val.size > 0, "No file was provided.")
  .refine((file) => file.size <= MAX_DOCUMENT_BYTES, "File is larger than the 10MB limit.")
  .refine(
    (file) => ALLOWED_DOCUMENT_TYPES.includes(file.type as (typeof ALLOWED_DOCUMENT_TYPES)[number]),
    "Only PDF, JPEG and PNG files are accepted."
  );
