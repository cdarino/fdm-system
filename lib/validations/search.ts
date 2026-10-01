import { z } from "zod";
import { uuidSchema } from "@/lib/validations/client";

export const indexEntityInputSchema = z.object({
  entity_id: uuidSchema,
  entity_type: z.string().trim().min(1, "Entity type is required"),
  content: z.string().trim().nullable().optional(),
  keywords: z.string().trim().nullable().optional(),
});

export const entityKeySchema = z.object({
  entityType: z.string().trim().min(1, "Entity type is required"),
  entityId: uuidSchema,
});

export const searchDocumentQuerySchema = z.object({
  query: z.string().trim(),
  limit: z.number().int().positive().optional().default(20),
});
