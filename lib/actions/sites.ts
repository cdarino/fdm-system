"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/actions/auth-guard";
import type { Site, SiteWithLots, PropertyLotWithClient } from "@/lib/types/property";

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
 * One site with the lots cut from it.
 *
 * Lots are fetched in a second query rather than as a nested select so the map
 * can keep drawing if a lot row is malformed, and so the ordering is explicit —
 * block then lot, which is how staff read a plan.
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

  const { data: lots, error: lotsError } = await supabase
    .from("property_lot")
    .select("*, client:client_id(client_id, full_name, status)")
    .eq("site_id", siteId)
    .order("block_number", { ascending: true })
    .order("lot_number", { ascending: true })
    .returns<PropertyLotWithClient[]>();

  if (lotsError) {
    throw new Error(`Failed to fetch lots for site: ${lotsError.message}`);
  }

  return { ...site, lots: lots ?? [] };
}
