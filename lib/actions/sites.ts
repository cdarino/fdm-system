"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/actions/auth-guard";
import type { Site, SiteWithLots, SiteSubdivision, PropertyLotWithClient } from "@/lib/types/property";

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
      .select("*, client:client_id(client_id, full_name, status)")
      .eq("site_id", siteId)
      .order("block_number", { ascending: true })
      .order("lot_number", { ascending: true })
      .returns<PropertyLotWithClient[]>(),
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
    lots: lotsResult.data ?? [],
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
