import { z } from "zod";
import { uuidSchema, stripUndefined } from "@/lib/validations/client";
import { TITLE_STATUSES } from "@/lib/types/title";

export const titleStatusSchema = z.enum(TITLE_STATUSES, { error: "Choose a valid title status" });

export const titleNumberSchema = z
  .string({ error: "Title number is required" })
  .trim()
  .min(1, "Title number is required")
  .max(100, "Title number must be 100 characters or fewer");

export const updatePropertyTitleNumberSchema = z.object({
  property_id: uuidSchema,
  title_number: titleNumberSchema,
});

export const createLandTitleSchema = z.object({
  property_id: uuidSchema,
  is_legacy_transferred: z.boolean().optional().default(false),
  status: titleStatusSchema.optional().default("Document Preparation"),
});

export const recordLandTitleReleaseSchema = z.object({
  title_id: uuidSchema,
  released_to_name: z.string().trim().min(2, "Recipient name is required"),
  released_to_id: z.string().trim().min(2, "Government ID number is required"),
  release_remarks: z.string().trim().optional().nullable(),
  release_attachment_id: uuidSchema.optional().nullable(),
});

export const updateLandTitleSchema = z
  .object({
    is_legacy_transferred: z.boolean().optional(),
    status: titleStatusSchema.optional(),
    clearance_started_at: z.string().datetime().nullable().optional(),
    released_to_name: z.string().trim().min(2).nullable().optional(),
    released_to_id: z.string().trim().min(2).nullable().optional(),
    release_remarks: z.string().trim().nullable().optional(),
    release_attachment_id: uuidSchema.nullable().optional(),
  })
  .transform(stripUndefined);

export const getLandTitlesParamsSchema = z
  .object({
    client_id: uuidSchema.optional(),
    property_id: uuidSchema.optional(),
    status: titleStatusSchema.optional(),
    search: z.string().optional(),
    page: z.number().int().positive().optional().default(1),
    limit: z.number().int().positive().max(500).optional().default(10),
    sortBy: z
      .enum(["created_at", "updated_at", "status"])
      .optional()
      .default("created_at"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .optional();

export type CreateLandTitleFormData = z.infer<typeof createLandTitleSchema>;
export type UpdateLandTitleFormData = z.infer<typeof updateLandTitleSchema>;
export type RecordLandTitleReleaseFormData = z.infer<typeof recordLandTitleReleaseSchema>;
