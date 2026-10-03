import { z } from "zod";
import { stripUndefined, uuidSchema } from "@/lib/validations/client";

export const propertyStatusEnum = z.enum(["Open", "Reserved", "Sold", "Forfeited"] as const);

export const boundaryPointSchema = z.tuple([z.number(), z.number()]);
export const polygonBoundarySchema = z
  .array(boundaryPointSchema)
  .min(3, "Boundary must have at least 3 points");

export const createPropertyLotSchema = z.object({
  site_id: z.string().min(1, "Please select a site").optional(),
  location: z.string().trim().min(1, "Location is required").optional(),
  block_number: z
    .number({ error: "Block number is required" })
    .int("Must be a whole number")
    .positive("Must be greater than 0"),
  lot_number: z
    .number({ error: "Lot number is required" })
    .int("Must be a whole number")
    .positive("Must be greater than 0"),
  area_size: z
    .number({ error: "Area is required" })
    .positive("Must be greater than 0"),
  price_per_sqm: z
    .number({ error: "Price is required" })
    .positive("Must be greater than 0"),
  status: propertyStatusEnum.optional(),
});

export const updateLotSchema = z.object({
  price_per_sqm: z
    .number({ error: "Price is required" })
    .positive("Must be greater than 0")
    .optional(),
  area_size: z
    .number({ error: "Area is required" })
    .positive("Must be greater than 0")
    .optional(),
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
    block_number: z.number().int().positive().optional(),
    lot_number: z.number().int().positive().optional(),
    area_size: z.number().positive().optional(),
    price_per_sqm: z.number().positive().optional(),
  })
  .transform(stripUndefined);

export const assignPropertyClientActionSchema = z.object({
  propertyId: uuidSchema,
  clientId: uuidSchema.nullable(),
  status: propertyStatusEnum.optional(),
  total_contract_price: z.number().positive().optional(),
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
  total_contract_price: z.number().positive().optional(),
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
  block_number: z.number().int().positive("Block number must be greater than 0"),
  lot_number: z.number().int().positive("Lot number must be greater than 0"),
  boundary: polygonBoundarySchema,
  create_property_lot: z.boolean().optional(),
  area_size: z.number().positive().optional(),
  price_per_sqm: z.number().positive().optional(),
});

export const deleteSubdivisionLotSchema = z.object({
  site_id: uuidSchema,
  block_number: z.number().int().positive(),
  lot_number: z.number().int().positive(),
  subdivision_id: uuidSchema.optional(),
});

export const openSubdivisionForSaleSchema = z.object({
  site_id: uuidSchema,
  block_number: z.number().int().positive(),
  lot_number: z.number().int().positive(),
  area_size: z.number().positive("Area is required"),
  price_per_sqm: z.number().positive("Price per sqm is required"),
});

export const assignPropertyFullyPaidActionSchema = z.object({
  propertyId: uuidSchema,
  clientId: uuidSchema,
  title_number: z.string().trim().max(100).optional().nullable(),
});

export const createAndAssignPropertyFromSubdivisionSchema = z.object({
  site_id: uuidSchema,
  block_number: z.number().int().positive(),
  lot_number: z.number().int().positive(),
  area_size: z.number().positive("Area is required"),
  price_per_sqm: z.number().positive("Price per sqm is required"),
  client_id: uuidSchema,
  ownership_type: z.enum(["installment", "fully_paid"]),
  total_contract_price: z.number().positive().optional(),
  remaining_balance: z.number().min(0).optional(),
  title_number: z.string().trim().max(100).optional().nullable(),
});

export type CreatePropertyLotFormData = z.infer<typeof createPropertyLotSchema>;
export type UpdateLotFormData = z.infer<typeof updateLotSchema>;
export type OpenSubdivisionForSaleFormData = z.infer<typeof openSubdivisionForSaleSchema>;
export type CreateAndAssignPropertyFromSubdivisionFormData = z.infer<typeof createAndAssignPropertyFromSubdivisionSchema>;
