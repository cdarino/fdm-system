"use server";

import { createScope } from "@/lib/actions/action-handler";
import type { ActionResult } from "@/lib/actions/action-result";
import { uuidSchema } from "@/lib/validations/client";
import {
  createSiteSchema,
  createSubdivisionLotSchema,
  deleteSubdivisionLotSchema,
} from "@/lib/validations/property";
import { calculatePolygonAreaSqm } from "@/lib/geometry";
import {
  LOT_WITH_CLIENT_SELECT,
  mapLotWithAccount,
  type RawLotRow,
} from "@/lib/property-lots";
import type {
  Site,
  SiteWithLots,
  SiteSubdivision,
  PropertyLot,
  CreateSiteInput,
  CreateSubdivisionLotInput,
  DeleteSubdivisionLotInput,
} from "@/lib/types/property";

const property = createScope(["properties.read"]);
const propertyCreate = property.extend(["properties.create"]);
const propertyDelete = property.extend(["properties.delete"]);

export async function getSites(): Promise<Site[]> {
  return property.query(async ({ supabase }) => {
    const { data, error } = await supabase
      .from("site")
      .select("*")
      .order("name", { ascending: true })
      .returns<Site[]>();

    if (error) {
      throw new Error(`Failed to fetch sites: ${error.message}`);
    }

    return data ?? [];
  });
}

export async function getSiteWithLots(siteId: string): Promise<SiteWithLots> {
  return property.query({
    schema: uuidSchema,
    input: siteId,
    handler: async (validSiteId, { supabase }) => {
      const { data: site, error: siteError } = await supabase
        .from("site")
        .select("*")
        .eq("site_id", validSiteId)
        .single<Site>();

      if (siteError || !site) {
        throw new Error(`Site not found: ${siteError?.message ?? "Unknown error"}`);
      }

      const [subdivisionsResult, lotsResult] = await Promise.all([
        supabase
          .from("site_subdivision")
          .select("*")
          .eq("site_id", validSiteId)
          .order("block_number", { ascending: true })
          .order("lot_number", { ascending: true })
          .returns<SiteSubdivision[]>(),
        supabase
          .from("property_lot")
          .select(LOT_WITH_CLIENT_SELECT)
          .eq("site_id", validSiteId)
          .order("block_number", { ascending: true })
          .order("lot_number", { ascending: true })
          .returns<RawLotRow[]>(),
      ]);

      if (subdivisionsResult.error) {
        throw new Error(`Failed to fetch subdivisions: ${subdivisionsResult.error.message}`);
      }
      if (lotsResult.error) {
        throw new Error(`Failed to fetch lots for site: ${lotsResult.error.message}`);
      }

      return {
        ...site,
        subdivisions: subdivisionsResult.data ?? [],
        lots: (lotsResult.data ?? []).map(mapLotWithAccount),
      };
    },
  });
}

export async function getUnclaimedSubdivisions(siteId: string): Promise<SiteSubdivision[]> {
  return property.query({
    schema: uuidSchema,
    input: siteId,
    handler: async (validSiteId, { supabase }) => {
      const [subdivisionsResult, lotsResult] = await Promise.all([
        supabase
          .from("site_subdivision")
          .select("subdivision_id, site_id, block_number, lot_number, boundary")
          .eq("site_id", validSiteId)
          .order("block_number", { ascending: true })
          .order("lot_number", { ascending: true })
          .returns<SiteSubdivision[]>(),
        supabase
          .from("property_lot")
          .select("block_number, lot_number")
          .eq("site_id", validSiteId)
          .returns<{ block_number: number; lot_number: number }[]>(),
      ]);

      if (subdivisionsResult.error) {
        throw new Error(`Failed to fetch subdivisions: ${subdivisionsResult.error.message}`);
      }

      const claimedKeys = new Set(
        (lotsResult.data ?? []).map((l) => `${l.block_number}-${l.lot_number}`)
      );

      return (subdivisionsResult.data ?? []).filter(
        (s) => !claimedKeys.has(`${s.block_number}-${s.lot_number}`)
      );
    },
  });
}

export async function getAllSitesWithLots(): Promise<SiteWithLots[]> {
  return property.query(async ({ supabase }) => {
    const [sitesResult, subdivisionsResult, lotsResult] = await Promise.all([
      supabase
        .from("site")
        .select("*")
        .order("name", { ascending: true })
        .returns<Site[]>(),
      supabase
        .from("site_subdivision")
        .select("*")
        .order("block_number", { ascending: true })
        .order("lot_number", { ascending: true })
        .returns<SiteSubdivision[]>(),
      supabase
        .from("property_lot")
        .select(LOT_WITH_CLIENT_SELECT)
        .order("block_number", { ascending: true })
        .order("lot_number", { ascending: true })
        .returns<RawLotRow[]>(),
    ]);

    if (sitesResult.error) {
      throw new Error(`Failed to fetch sites: ${sitesResult.error.message}`);
    }
    if (subdivisionsResult.error) {
      throw new Error(`Failed to fetch subdivisions: ${subdivisionsResult.error.message}`);
    }
    if (lotsResult.error) {
      throw new Error(`Failed to fetch lots: ${lotsResult.error.message}`);
    }

    const subdivisionsBySite = new Map<string, SiteSubdivision[]>();
    for (const sub of subdivisionsResult.data ?? []) {
      const list = subdivisionsBySite.get(sub.site_id) ?? [];
      list.push(sub);
      subdivisionsBySite.set(sub.site_id, list);
    }

    const lots = (lotsResult.data ?? []).map(mapLotWithAccount);
    const lotsBySite = new Map<string, typeof lots>();
    for (const lot of lots) {
      if (!lot.site_id) continue;
      const list = lotsBySite.get(lot.site_id) ?? [];
      list.push(lot);
      lotsBySite.set(lot.site_id, list);
    }

    return (sitesResult.data ?? []).map((site) => ({
      ...site,
      subdivisions: subdivisionsBySite.get(site.site_id) ?? [],
      lots: lotsBySite.get(site.site_id) ?? [],
    }));
  });
}

export async function createSite(input: CreateSiteInput): Promise<ActionResult<Site>> {
  return propertyCreate.run({
    schema: createSiteSchema,
    input,
    handler: async (validatedInput, { supabase }) => {
      const { data, error } = await supabase
        .from("site")
        .insert({
          name: validatedInput.name,
          description: validatedInput.description || null,
          boundary: validatedInput.boundary,
        })
        .select()
        .single<Site>();

      if (error || !data) {
        throw new Error(`Failed to create site: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
}

export async function deleteSite(siteId: string): Promise<ActionResult<void>> {
  return propertyDelete.run({
    schema: uuidSchema,
    input: siteId,
    handler: async (validSiteId, { supabase }) => {
      // Ensure no sold or reserved lots prevent site deletion
      const { data: activeLots } = await supabase
        .from("property_lot")
        .select("property_id, status")
        .eq("site_id", validSiteId)
        .in("status", ["Reserved", "Sold"]);

      if (activeLots && activeLots.length > 0) {
        throw new Error("Cannot delete site with active reserved or sold lots.");
      }

      await supabase.from("property_lot").delete().eq("site_id", validSiteId);
      await supabase.from("site_subdivision").delete().eq("site_id", validSiteId);
      const { error } = await supabase.from("site").delete().eq("site_id", validSiteId);

      if (error) {
        throw new Error(`Failed to delete site: ${error.message}`);
      }
    },
  });
}

export async function createSubdivisionLot(
  input: CreateSubdivisionLotInput
): Promise<ActionResult<{ subdivision: SiteSubdivision; lot: PropertyLot | null }>> {
  return propertyCreate.run({
    schema: createSubdivisionLotSchema,
    input,
    handler: async (validatedInput, { supabase }) => {
      const { data: site, error: siteError } = await supabase
        .from("site")
        .select("site_id, name")
        .eq("site_id", validatedInput.site_id)
        .single<{ site_id: string; name: string }>();

      if (siteError || !site) {
        throw new Error(`Site not found: ${siteError?.message ?? "Unknown error"}`);
      }

      const { data: subData, error: subError } = await supabase
        .from("site_subdivision")
        .insert({
          site_id: validatedInput.site_id,
          block_number: validatedInput.block_number,
          lot_number: validatedInput.lot_number,
          boundary: validatedInput.boundary,
        })
        .select()
        .single<SiteSubdivision>();

      if (subError || !subData) {
        throw new Error(`Failed to create subdivision: ${subError?.message ?? "Unknown error"}`);
      }

      // Only create registered property_lot if explicitly requested
      let lotData: PropertyLot | null = null;
      if (validatedInput.create_property_lot) {
        const computedArea = validatedInput.area_size && validatedInput.area_size > 0
          ? validatedInput.area_size
          : Math.max(10, Math.round(calculatePolygonAreaSqm(validatedInput.boundary) * 100) / 100);

        const pricePerSqm = validatedInput.price_per_sqm && validatedInput.price_per_sqm > 0
          ? validatedInput.price_per_sqm
          : 6500;

        const { data, error: lotError } = await supabase
          .from("property_lot")
          .upsert(
            {
              site_id: validatedInput.site_id,
              location: site.name,
              block_number: validatedInput.block_number,
              lot_number: validatedInput.lot_number,
              area_size: computedArea,
              price_per_sqm: pricePerSqm,
              status: "Open",
              boundary: validatedInput.boundary,
            },
            { onConflict: "location,block_number,lot_number" }
          )
          .select()
          .single<PropertyLot>();

        if (lotError || !data) {
          await supabase.from("site_subdivision").delete().eq("subdivision_id", subData.subdivision_id);
          throw new Error(`Failed to create property lot: ${lotError?.message ?? "Unknown error"}`);
        }
        lotData = data;
      }

      return { subdivision: subData, lot: lotData };
    },
  });
}

export async function deleteSubdivisionLot(input: DeleteSubdivisionLotInput): Promise<ActionResult<void>> {
  return propertyDelete.run({
    schema: deleteSubdivisionLotSchema,
    input,
    handler: async (validatedData, { supabase }) => {
      // Guard against deleting lots with active client contracts
      const { data: existingLot } = await supabase
        .from("property_lot")
        .select("property_id, status")
        .eq("site_id", validatedData.site_id)
        .eq("block_number", validatedData.block_number)
        .eq("lot_number", validatedData.lot_number)
        .maybeSingle<{ property_id: string; status: string }>();

      if (existingLot) {
        if (existingLot.status !== "Open") {
          throw new Error(`Cannot delete plot: Lot is currently ${existingLot.status.toLowerCase()}.`);
        }

        const { data: activeLedger } = await supabase
          .from("ledger_account")
          .select("account_id")
          .eq("property_id", existingLot.property_id)
          .eq("status", "Active")
          .maybeSingle();

        if (activeLedger) {
          throw new Error("Cannot delete plot: Lot has an active ledger account.");
        }

        await supabase
          .from("property_lot")
          .delete()
          .eq("property_id", existingLot.property_id);
      }

      let query = supabase.from("site_subdivision").delete();
      if (validatedData.subdivision_id) {
        query = query.eq("subdivision_id", validatedData.subdivision_id);
      } else {
        query = query
          .eq("site_id", validatedData.site_id)
          .eq("block_number", validatedData.block_number)
          .eq("lot_number", validatedData.lot_number);
      }

      const { error: subDelError } = await query;
      if (subDelError) {
        throw new Error(`Failed to delete subdivision: ${subDelError.message}`);
      }
    },
  });
}
