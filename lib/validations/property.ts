import { z } from "zod";
import { stripUndefined, uuidSchema } from "@/lib/validations/client";
import { titleRecordFormSchema } from "@/lib/validations/title";

export const propertyStatusEnum = z.enum(["Open", "Reserved", "Sold", "Forfeited"] as const);

export const boundaryPointSchema = z.tuple([z.number(), z.number()]);
export const polygonBoundarySchema = z
  .array(boundaryPointSchema)
  .min(3, "Boundary must have at least 3 points");

// Upper bounds keep values inside the database columns (area NUMERIC(10,2),
// price NUMERIC(12,2), contract price NUMERIC(15,2)), so out-of-range input
// gets a form message instead of a database error.
export const LOT_LIMITS = {
  blockOrLotNumber: 9999,
  areaSqm: 1_000_000,
  pricePerSqm: 1_000_000,
  contractPrice: 1_000_000_000_000,
} as const;

const LIMIT_FORMAT = new Intl.NumberFormat("en-PH");

function hasAtMostTwoDecimals(value: number) {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

function blockOrLotNumberSchema(label: string) {
  return z
    .number({ error: `${label} is required` })
    .int("Must be a whole number")
    .positive("Must be greater than 0")
    .max(LOT_LIMITS.blockOrLotNumber, `Must be ${LIMIT_FORMAT.format(LOT_LIMITS.blockOrLotNumber)} or less`);
}

function amountSchema(label: string, max: number) {
  return z
    .number({ error: `${label} is required` })
    .positive("Must be greater than 0")
    .max(max, `Must be ${LIMIT_FORMAT.format(max)} or less`)
    .refine(hasAtMostTwoDecimals, "Use at most 2 decimal places");
}

const areaSchema = amountSchema("Area", LOT_LIMITS.areaSqm);
const pricePerSqmSchema = amountSchema("Price per sqm", LOT_LIMITS.pricePerSqm);
const contractPriceSchema = amountSchema("Contract price", LOT_LIMITS.contractPrice);

export const createPropertyLotSchema = z.object({
  site_id: z.string().min(1, "Please select a site").optional(),
  location: z.string().trim().min(1, "Location is required").optional(),
  block_number: blockOrLotNumberSchema("Block number"),
  lot_number: blockOrLotNumberSchema("Lot number"),
  area_size: areaSchema,
  price_per_sqm: pricePerSqmSchema,
  status: propertyStatusEnum.optional(),
});

export const updateLotSchema = z.object({
  price_per_sqm: pricePerSqmSchema.optional(),
  area_size: areaSchema.optional(),
});

export const getPropertyLotsParamsSchema = z
  .object({
    page: z.number().int().positive().optional().default(1),
    limit: z.number().int().positive().optional().default(10),
    search: z
      .string()
      .trim()
      .transform((val) => val.replace(/[,()]/g, ""))
      .optional(),
    status: propertyStatusEnum.optional(),
    client_id: uuidSchema.optional(),
    location: z
      .string()
      .trim()
      .transform((val) => val.replace(/[,()]/g, ""))
      .optional(),
    block_number: z.number().int().positive().optional(),
    lot_number: z.number().int().positive().optional(),
    sortBy: z
      .enum(["created_at", "location", "block_number", "lot_number", "price_per_sqm", "area_size", "status"])
      .optional()
      .default("created_at"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .optional();

export const updatePropertyLotActionSchema = z
  .object({
    propertyId: uuidSchema,
    location: z.string().trim().min(1).optional(),
    block_number: blockOrLotNumberSchema("Block number").optional(),
    lot_number: blockOrLotNumberSchema("Lot number").optional(),
    area_size: areaSchema.optional(),
    price_per_sqm: pricePerSqmSchema.optional(),
  })
  .transform(stripUndefined);

export const assignPropertyClientActionSchema = z.object({
  propertyId: uuidSchema,
  clientId: uuidSchema.nullable(),
  status: propertyStatusEnum.optional(),
  total_contract_price: contractPriceSchema.optional(),
});

export const assignPartyInputSchema = z.object({
  client_id: uuidSchema,
  role: z.string().trim().optional(),
  ownership_percentage: z.number().min(0).max(100).optional(),
  is_primary: z.boolean().optional(),
});

export const assignPropertyPartiesActionSchema = z.object({
  propertyId: uuidSchema,
  parties: z.array(assignPartyInputSchema).min(1, "At least one party must be specified"),
  status: propertyStatusEnum.optional(),
  total_contract_price: contractPriceSchema.optional(),
});

export const addAccountPartyActionSchema = z.object({
  accountId: uuidSchema,
  client_id: uuidSchema,
  role: z.string().trim().optional().default("Co-Owner"),
  ownership_percentage: z.number().min(0).max(100).optional().default(0),
  is_primary: z.boolean().optional().default(false),
});

export const removeAccountPartyActionSchema = z.object({
  accountId: uuidSchema,
  clientId: uuidSchema,
});

export const createSiteSchema = z.object({
  name: z.string().trim().min(1, "Site name is required"),
  description: z.string().trim().nullable().optional(),
  boundary: polygonBoundarySchema,
});

export const createSubdivisionLotSchema = z.object({
  site_id: uuidSchema,
  block_number: blockOrLotNumberSchema("Block number"),
  lot_number: blockOrLotNumberSchema("Lot number"),
  boundary: polygonBoundarySchema,
  create_property_lot: z.boolean().optional(),
  area_size: areaSchema.optional(),
  price_per_sqm: pricePerSqmSchema.optional(),
});

export const deleteSubdivisionLotSchema = z.object({
  site_id: uuidSchema,
  block_number: z.number().int().positive(),
  lot_number: z.number().int().positive(),
  subdivision_id: uuidSchema.optional(),
});

export const openSubdivisionForSaleSchema = z.object({
  site_id: uuidSchema,
  block_number: blockOrLotNumberSchema("Block number"),
  lot_number: blockOrLotNumberSchema("Lot number"),
  area_size: areaSchema,
  price_per_sqm: pricePerSqmSchema,
});

export const assignPropertyFullyPaidActionSchema = z.object({
  propertyId: uuidSchema,
  clientId: uuidSchema,
  // Legacy accounts whose title was already processed come with it.
  existing_title: titleRecordFormSchema.optional(),
});

export const createAndAssignPropertyFromSubdivisionSchema = z.object({
  site_id: uuidSchema,
  block_number: blockOrLotNumberSchema("Block number"),
  lot_number: blockOrLotNumberSchema("Lot number"),
  area_size: areaSchema,
  price_per_sqm: pricePerSqmSchema,
  client_id: uuidSchema,
  ownership_type: z.enum(["installment", "fully_paid"]),
  total_contract_price: contractPriceSchema.optional(),
  remaining_balance: z.number().min(0).max(LOT_LIMITS.contractPrice).optional(),
});

export type CreatePropertyLotFormData = z.infer<typeof createPropertyLotSchema>;
export type UpdateLotFormData = z.infer<typeof updateLotSchema>;
export type OpenSubdivisionForSaleFormData = z.infer<typeof openSubdivisionForSaleSchema>;
export type CreateAndAssignPropertyFromSubdivisionFormData = z.infer<typeof createAndAssignPropertyFromSubdivisionSchema>;
