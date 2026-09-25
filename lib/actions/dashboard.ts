"use server";

import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions";
import { getUserInfo } from "@/lib/user";

/**
 * A stat is `null` when the signed-in user may not see it, and the dashboard
 * omits that tile entirely.
 *
 * This matters because RLS returns an empty set rather than an error to a user
 * without the permission — so a billing_staff member would be shown a confident
 * "0 Property Lots" rather than nothing at all. Checking the permission up
 * front is the difference between withholding a figure and misreporting it.
 */
export interface DashboardStats {
  propertyLots: number | null;
  availableLots: number | null;
  clients: number | null;
}

const EMPTY: DashboardStats = { propertyLots: null, availableLots: null, clients: null };

export async function getDashboardStats(): Promise<DashboardStats> {
  const user = await getUserInfo();
  if (!user) return EMPTY;

  const [canReadProperties, canReadClients] = await Promise.all([
    hasPermission("properties.read", user.id),
    hasPermission("clients.read", user.id),
  ]);

  const supabase = await createClient();

  // `head: true` asks for the count only — no rows cross the wire.
  const [lotsResult, openResult, clientsResult] = await Promise.all([
    canReadProperties
      ? supabase.from("property_lot").select("*", { count: "exact", head: true })
      : null,
    canReadProperties
      ? supabase.from("property_lot").select("*", { count: "exact", head: true }).eq("status", "Open")
      : null,
    canReadClients
      ? supabase.from("client").select("*", { count: "exact", head: true })
      : null,
  ]);

  // A failed count is reported as "unavailable" rather than as zero: a tile
  // reading 0 is a claim about the data, and a broken query is not evidence
  // for it.
  function resolve(
    result: { count: number | null; error: { message: string } | null } | null,
    label: string,
  ): number | null {
    if (!result) return null;
    if (result.error) {
      console.error(`Dashboard stat "${label}" failed:`, result.error.message);
      return null;
    }
    return result.count ?? 0;
  }

  return {
    propertyLots: resolve(lotsResult, "property lots"),
    availableLots: resolve(openResult, "available lots"),
    clients: resolve(clientsResult, "clients"),
  };
}
