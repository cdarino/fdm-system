import { z } from "zod";
import { uuidSchema, stripUndefined } from "@/lib/validations/client";

export const titleStatusSchema = z.enum(["Processing", "Ready for Release", "Released"]).or(z.string().min(1));

export const createLandTitleSchema = z.object({
  property_id: uuidSchema,
  client_id: uuidSchema,
  title_number: z.string().trim().max(100).optional().nullable(),
  status: titleStatusSchema.default("Processing"),
});

export const updateLandTitleSchema = z
  .object({
    title_number: z.string().trim().max(100).optional().nullable(),
    status: titleStatusSchema.optional(),
  })
  .transform(stripUndefined);

export const getLandTitlesParamsSchema = z
  .object({
    client_id: uuidSchema.optional(),
    property_id: uuidSchema.optional(),
    status: z.string().optional(),
    search: z.string().optional(),
    page: z.number().int().positive().optional().default(1),
    limit: z.number().int().positive().max(100).optional().default(10),
    sortBy: z.enum(["created_at", "updated_at", "title_number", "status"]).optional().default("created_at"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .optional();

export type CreateLandTitleFormData = z.infer<typeof createLandTitleSchema>;
export type UpdateLandTitleFormData = z.infer<typeof updateLandTitleSchema>;
