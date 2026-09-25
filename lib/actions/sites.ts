"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/actions/auth-guard";
import { calculatePolygonAreaSqm } from "@/lib/geometry";
import {
  LOT_WITH_CLIENT_SELECT,
  mapLotWithAccount,
  type RawLotRow,
} from "@/lib/actions/properties";
import type {
  Site,
  SiteWithLots,
  SiteSubdivision,
  PropertyLot,
  PropertyLotWithClient,
  CreateSiteInput,
  CreateSubdivisionLotInput,
  DeleteSubdivisionLotInput,
} from "@/lib/types/property";

/** Every site, for the map's site picker. Boundaries included so a switch is instant. */
export async function getSites(): Promise<Site[]> {
  await requirePermission("properties.read");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("site")
    .select("*")
    .order("name", { ascending: true })
    .returns<Site[]>();

  if (error) {
    throw new Error(`Failed to fetch sites: ${error.message}`);
  }

  return data ?? [];
}

/**
 * One site with its pre-planned subdivisions and any registered property lots.
 *
 * Subdivisions are the canonical geometry source; lots are fetched separately
 * so the map can draw empty slots (subdivisions with no matching property) and
 * claimed slots (subdivisions that have a property_lot) side by side.
 */
export async function getSiteWithLots(siteId: string): Promise<SiteWithLots> {
  await requirePermission("properties.read");
  const supabase = await createClient();

  const { data: site, error: siteError } = await supabase
    .from("site")
    .select("*")
    .eq("site_id", siteId)
    .single<Site>();

  if (siteError || !site) {
    throw new Error(`Site not found: ${siteError?.message ?? "Unknown error"}`);
  }

  const [subdivisionsResult, lotsResult] = await Promise.all([
    supabase
      .from("site_subdivision")
      .select("*")
      .eq("site_id", siteId)
      .order("block_number", { ascending: true })
      .order("lot_number", { ascending: true })
      .returns<SiteSubdivision[]>(),
    supabase
      .from("property_lot")
      .select(LOT_WITH_CLIENT_SELECT)
      .eq("site_id", siteId)
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
}

/**
 * Subdivisions for a site that do not yet have a matching property_lot.
 * Used to populate the subdivision picker when creating a new property.
 */
export async function getUnclaimedSubdivisions(siteId: string): Promise<SiteSubdivision[]> {
  await requirePermission("properties.read");
  const supabase = await createClient();

  const [subdivisionsResult, lotsResult] = await Promise.all([
    supabase
      .from("site_subdivision")
      .select("subdivision_id, site_id, block_number, lot_number, boundary")
      .eq("site_id", siteId)
      .order("block_number", { ascending: true })
      .order("lot_number", { ascending: true })
      .returns<SiteSubdivision[]>(),
    supabase
      .from("property_lot")
      .select("block_number, lot_number")
      .eq("site_id", siteId)
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
}

/** All sites with their subdivisions and registered property lots. */
export async function getAllSitesWithLots(): Promise<SiteWithLots[]> {
  await requirePermission("properties.read");
  const supabase = await createClient();

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
  const lotsBySite = new Map<string, PropertyLotWithClient[]>();
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
}

export async function createSite(input: CreateSiteInput): Promise<Site> {
  await requirePermission("properties.create");
  const supabase = await createClient();

  const name = input.name.trim();
  if (!name) throw new Error("Site name is required");
  if (!Array.isArray(input.boundary) || input.boundary.length < 3) {
    throw new Error("Site boundary must have at least 3 points");
  }

  const { data, error } = await supabase
    .from("site")
    .insert({
      name,
      description: input.description?.trim() || null,
      boundary: input.boundary,
    })
    .select()
    .single<Site>();

  if (error || !data) {
    throw new Error(`Failed to create site: ${error?.message ?? "Unknown error"}`);
  }

  return data;
}

export async function deleteSite(siteId: string): Promise<void> {
  await requirePermission("properties.delete");
  const supabase = await createClient();

  // Ensure no sold or reserved lots prevent site deletion
  const { data: activeLots } = await supabase
    .from("property_lot")
    .select("property_id, status")
    .eq("site_id", siteId)
    .in("status", ["Reserved", "Sold"]);

  if (activeLots && activeLots.length > 0) {
    throw new Error("Cannot delete site with active reserved or sold lots.");
  }

  await supabase.from("property_lot").delete().eq("site_id", siteId);
  await supabase.from("site_subdivision").delete().eq("site_id", siteId);
  const { error } = await supabase.from("site").delete().eq("site_id", siteId);

  if (error) {
    throw new Error(`Failed to delete site: ${error.message}`);
  }
}

export async function createSubdivisionLot(
  input: CreateSubdivisionLotInput
): Promise<{ subdivision: SiteSubdivision; lot: PropertyLot | null }> {
  await requirePermission("properties.create");
  const supabase = await createClient();

  if (!input.site_id) throw new Error("Site ID is required");
  if (!input.block_number || input.block_number <= 0) throw new Error("Block number must be greater than 0");
  if (!input.lot_number || input.lot_number <= 0) throw new Error("Lot number must be greater than 0");
  if (!Array.isArray(input.boundary) || input.boundary.length < 3) {
    throw new Error("Lot boundary must have at least 3 points");
  }

  const { data: site, error: siteError } = await supabase
    .from("site")
    .select("site_id, name")
    .eq("site_id", input.site_id)
    .single<{ site_id: string; name: string }>();

  if (siteError || !site) {
    throw new Error(`Site not found: ${siteError?.message ?? "Unknown error"}`);
  }

  const { data: subData, error: subError } = await supabase
    .from("site_subdivision")
    .insert({
      site_id: input.site_id,
      block_number: input.block_number,
      lot_number: input.lot_number,
      boundary: input.boundary,
    })
    .select()
    .single<SiteSubdivision>();

  if (subError || !subData) {
    throw new Error(`Failed to create subdivision: ${subError?.message ?? "Unknown error"}`);
  }

  // Only create registered property_lot if explicitly requested; otherwise lot is available by default
  let lotData: PropertyLot | null = null;
  if (input.create_property_lot) {
    const computedArea = input.area_size && input.area_size > 0
      ? input.area_size
      : Math.max(10, Math.round(calculatePolygonAreaSqm(input.boundary) * 100) / 100);

    const pricePerSqm = input.price_per_sqm && input.price_per_sqm > 0
      ? input.price_per_sqm
      : 6500;

    const { data, error: lotError } = await supabase
      .from("property_lot")
      .upsert(
        {
          site_id: input.site_id,
          location: site.name,
          block_number: input.block_number,
          lot_number: input.lot_number,
          area_size: computedArea,
          price_per_sqm: pricePerSqm,
          status: "Open",
          boundary: input.boundary,
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
}


export async function deleteSubdivisionLot(input: DeleteSubdivisionLotInput): Promise<void> {
  await requirePermission("properties.delete");
  const supabase = await createClient();

  // Guard against deleting lots with active client contracts
  const { data: existingLot } = await supabase
    .from("property_lot")
    .select("property_id, status")
    .eq("site_id", input.site_id)
    .eq("block_number", input.block_number)
    .eq("lot_number", input.lot_number)
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
  if (input.subdivision_id) {
    query = query.eq("subdivision_id", input.subdivision_id);
  } else {
    query = query
      .eq("site_id", input.site_id)
      .eq("block_number", input.block_number)
      .eq("lot_number", input.lot_number);
  }

  const { error: subDelError } = await query;
  if (subDelError) {
    throw new Error(`Failed to delete subdivision: ${subDelError.message}`);
  }
}


