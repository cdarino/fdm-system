import { z } from "zod";
import { uuidSchema, stripUndefined } from "@/lib/validations/client";
import { TITLE_STATUSES } from "@/lib/types/title";

export const titleStatusSchema = z.enum(TITLE_STATUSES, { error: "Choose a valid title status" });

export const titleHolderSchema = z.enum(["client", "fdm"], {
  error: "Choose whose name the title is in",
});

const titleNumberSchema = z
  .string({ error: "Title number is required" })
  .trim()
  .min(1, "Title number is required")
  .max(100, "Title number must be 100 characters or fewer");

/** The fields Legal fills in, shared by the create and edit forms. */
export const titleRecordFormSchema = z.object({
  title_holder: titleHolderSchema,
  title_number: titleNumberSchema,
});

/** Legal creates a title for a lot whose account Billing has cleared. */
export const createLandTitleSchema = titleRecordFormSchema.extend({
  property_id: uuidSchema,
});

export const updateLandTitleSchema = z
  .object({
    title_number: titleNumberSchema.optional(),
    title_holder: titleHolderSchema.optional(),
    status: titleStatusSchema.optional(),
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
      .enum(["created_at", "updated_at", "title_number", "status"])
      .optional()
      .default("created_at"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .optional();

export type TitleRecordFormData = z.infer<typeof titleRecordFormSchema>;
export type CreateLandTitleFormData = z.infer<typeof createLandTitleSchema>;
export type UpdateLandTitleFormData = z.infer<typeof updateLandTitleSchema>;
