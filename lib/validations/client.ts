import { z } from "zod";

export function stripUndefined<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

export const contactInfoInputSchema = z.object({
  type: z.string().trim().min(1, "Contact type is required"),
  value: z.string().trim().min(1, "Contact value is required"),
  is_primary: z.boolean().optional().default(false),
});

export const createContactInfoSchema = contactInfoInputSchema;

export const updateContactInfoSchema = z
  .object({
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

export type ClientFormData = z.input<typeof clientSchema>;
export type CreateClientFormData = z.infer<typeof createClientSchema>;
export type UpdateClientFormData = z.infer<typeof updateClientSchema>;

