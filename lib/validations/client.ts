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

// Letters (including ñ and accented letters), spaces, and the punctuation that
// appears in names: "Ma. Teresa", "O'Neil", "Santos-Reyes", "dela Cruz, Jr.".
const PERSON_NAME_PATTERN = /^\p{L}[\p{L}\p{M} .,'-]*$/u;

export function personNameSchema(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(100, `${label} must be 100 characters or fewer`)
    .regex(
      PERSON_NAME_PATTERN,
      `${label} can only contain letters, spaces, periods, commas, apostrophes, and hyphens`
    );
}

export const CONTACT_TYPES = ["Phone", "Mobile", "Email", "Other"] as const;

const PHONE_CHARACTERS = /^\+?[\d\s()-]+$/;
const PH_MOBILE_DIGITS = /^(09|639)\d{9}$/;
// Mobile numbers, or landlines with their area code: (082) 221 1234, 02 8123 4567.
const PH_PHONE_DIGITS = /^(0|63)\d{9,10}$/;
const INTERNATIONAL_DIGITS = /^\d{8,15}$/;

function isValidPhone(value: string, mobileOnly: boolean): boolean {
  if (!PHONE_CHARACTERS.test(value)) return false;

  const digits = value.replace(/\D/g, "");
  // Numbers abroad (e.g. clients working overseas) are accepted in +<country code> form.
  if (value.startsWith("+") && !digits.startsWith("63")) {
    return INTERNATIONAL_DIGITS.test(digits);
  }

  return (mobileOnly ? PH_MOBILE_DIGITS : PH_PHONE_DIGITS).test(digits);
}

/**
 * Returns why a contact value is invalid for its type, or null when it is
 * valid. Shared by the server schemas and the contact editor so both show the
 * same message.
 */
export function getContactValueError(type: string, rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) return "Contact value is required";
  if (value.length > 200) return "Contact value must be 200 characters or fewer";

  switch (type) {
    case "Mobile":
      return isValidPhone(value, true)
        ? null
        : "Enter a valid mobile number, e.g. 0917 123 4567 or +63 917 123 4567";
    case "Phone":
      return isValidPhone(value, false)
        ? null
        : "Enter a valid phone number with area code, e.g. (082) 221 1234 or 0917 123 4567";
    case "Email":
      return z.email().safeParse(value).success
        ? null
        : "Enter a valid email address, e.g. name@example.com";
    default:
      return null;
  }
}

const contactTypeSchema = z.enum(CONTACT_TYPES, { error: "Choose a valid contact type" });

const contactInfoFields = z.object({
  type: contactTypeSchema,
  value: z.string().trim().min(1, "Contact value is required"),
  is_primary: z.boolean().optional().default(false),
});

function refineContactValue(
  data: { type?: string; value?: string },
  ctx: z.RefinementCtx
) {
  if (data.type === undefined || data.value === undefined) return;

  const message = getContactValueError(data.type, data.value);
  if (message) {
    ctx.addIssue({ code: "custom", path: ["value"], message });
  }
}

export const contactInfoInputSchema = contactInfoFields.superRefine(refineContactValue);

export const createContactInfoSchema = contactInfoFields
  .extend({ clientId: uuidSchema })
  .superRefine(refineContactValue);

// A value sent without its type is checked against the stored type in
// updateContactInfo, since only the server knows it.
export const updateContactInfoSchema = z
  .object({
    contactId: uuidSchema,
    type: contactTypeSchema.optional(),
    value: z.string().trim().min(1, "Contact value is required").optional(),
    is_primary: z.boolean().optional(),
  })
  .superRefine(refineContactValue)
  .transform(stripUndefined);

export const clientSchema = z.object({
  full_name: personNameSchema("Full name"),
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
    full_name: personNameSchema("Full name").optional(),
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
  limit: z.coerce.number().int().min(1).max(500).default(10),
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
