import { z } from "zod";

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
  status: z.enum(["Open", "Reserved", "Sold", "Forfeited"] as const).optional(),
});

export const updateLotSchema = z.object({
  status: z.enum(["Open", "Reserved", "Sold", "Forfeited"] as const).optional(),
  price_per_sqm: z
    .number({ error: "Price is required" })
    .positive("Must be greater than 0")
    .optional(),
  area_size: z
    .number({ error: "Area is required" })
    .positive("Must be greater than 0")
    .optional(),
});

export type CreatePropertyLotFormData = z.infer<typeof createPropertyLotSchema>;
export type UpdateLotFormData = z.infer<typeof updateLotSchema>;
