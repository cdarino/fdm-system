import { z } from "zod";

export function stripUndefined<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

export const uuidSchema = z.string().uuid("Invalid UUID format");

export const docTypeSchema = z.enum([
  "Valid ID",
  "Deed of Sale",
  "Contract",
  "eCAR",
  "Other",
]);

export const contactInfoInputSchema = z.object({
  type: z.string().trim().min(1, "Contact type is required"),
  value: z.string().trim().min(1, "Contact value is required"),
  is_primary: z.boolean().optional().default(false),
});

export const createContactInfoSchema = contactInfoInputSchema.extend({
  clientId: uuidSchema,
});

export const updateContactInfoSchema = z
  .object({
    contactId: uuidSchema,
    type: z.string().trim().min(1, "Contact type is required").optional(),
    value: z.string().trim().min(1, "Contact value is required").optional(),
    is_primary: z.boolean().optional(),
  })
  .transform(stripUndefined);

export const clientSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required"),
  address: z.string().trim().nullable().optional(),
  tin_number: z
    .string()
    .trim()
    .refine(
      (val) => !val || /^\d{3}-\d{3}-\d{3}$/.test(val),
      "TIN must follow the format XXX-XXX-XXX with numbers only"
    )
    .nullable()
    .optional(),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

export const createClientSchema = clientSchema.extend({
  contacts: z.array(contactInfoInputSchema).optional(),
});

export const updateClientSchema = z
  .object({
    clientId: uuidSchema,
    full_name: z.string().trim().min(1, "Full name is required").optional(),
    address: z.string().trim().nullable().optional(),
    tin_number: z
      .string()
      .trim()
      .refine(
        (val) => !val || /^\d{3}-\d{3}-\d{3}$/.test(val),
        "TIN must follow the format XXX-XXX-XXX with numbers only"
      )
      .nullable()
      .optional(),
    status: z.enum(["Active", "Inactive", "Archived"]).optional(),
  })
  .transform(stripUndefined);

export const getClientsParamsSchema = z.object({
  search: z
    .string()
    .trim()
    .transform((val) => val.replace(/[,()]/g, ""))
    .optional(),
  status: z.enum(["Active", "Inactive", "Archived"]).optional(),
  area: z.string().trim().optional(),
  includeArchived: z.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z
    .enum(["full_name", "created_at", "status", "address"])
    .default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const createClientDocumentSchema = z.object({
  clientId: uuidSchema,
  document_type: docTypeSchema,
  file_path: z.string().trim().min(1, "File path is required"),
});

export const getClientDocumentsParamsSchema = z.object({
  clientId: uuidSchema,
  category: docTypeSchema.optional(),
});

export const clientInteractionSchema = z.object({
  clientId: uuidSchema,
  interaction_type: z.string().trim().min(1, "Interaction type is required"),
  notes: z.string().trim().min(1, "Notes are required"),
});

export const createClientLogSchema = z.object({
  clientId: uuidSchema,
  event_type: z.string().trim().min(1, "Event type is required"),
  description: z.string().trim().nullable().optional(),
});

export type ClientFormData = z.input<typeof clientSchema>;
export type CreateClientFormData = z.infer<typeof createClientSchema>;
export type UpdateClientFormData = z.infer<typeof updateClientSchema>;
export type GetClientsParamsInput = z.input<typeof getClientsParamsSchema>;
