"use server";

import { createScope } from "@/lib/actions/action-handler";
import { hasPermission } from "@/lib/permissions";

export interface DashboardStats {
  propertyLots: number | null;
  availableLots: number | null;
  clients: number | null;
}

const EMPTY: DashboardStats = { propertyLots: null, availableLots: null, clients: null };
const dashboardScope = createScope([]);

export async function getDashboardStats(): Promise<DashboardStats> {
  return dashboardScope.query(async ({ supabase, userId }) => {
    if (!userId) return EMPTY;

    const [canReadProperties, canReadClients] = await Promise.all([
      hasPermission("properties.read", userId),
      hasPermission("clients.read", userId),
    ]);

    // head: true asks for the count only
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

    function resolve(
      result: { count: number | null; error: { message: string } | null } | null,
      label: string
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
  });
}
