import { z } from "zod";

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

export const createClientSchema = clientSchema;

export const updateClientSchema = z.object({
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
});

export type ClientFormData = z.input<typeof clientSchema>;
export type CreateClientFormData = z.infer<typeof createClientSchema>;
export type UpdateClientFormData = z.infer<typeof updateClientSchema>;
