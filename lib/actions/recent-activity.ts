"use server";

import { createScope } from "@/lib/actions/action-handler";
import { hasPermission } from "@/lib/permissions";

export interface RecentActivityItem {
  id: string;
  kind: "client" | "title";
  label: string;
  detail: string;
  timestamp: string;
  actor: string;
  href: string;
}

interface UserNameRow {
  id: string;
  full_name: string;
}

interface ClientActivityRow {
  log_id: string;
  event_type: string;
  description: string | null;
  time: string;
  performed_by: string | null;
  client: { client_id: string; full_name: string } | null;
}

interface TitleActivityRow {
  history_id: string;
  status: string;
  changed_at: string;
  changed_by: string | null;
  title: {
    title_id: string;
    client: { full_name: string } | null;
    property: { location: string; block_number: number; lot_number: number } | null;
  } | null;
}

const recentActivityScope = createScope([]);

export async function getRecentActivity(): Promise<RecentActivityItem[]> {
  return recentActivityScope.query(async ({ supabase, userId }) => {
    if (!userId) return [];

    const [canReadClients, canReadTitles] = await Promise.all([
      hasPermission("clients.read", userId),
      hasPermission("legal.read", userId),
    ]);

    const [clientResult, titleResult] = await Promise.all([
      canReadClients
        ? supabase
            .from("client_log")
            .select("log_id, event_type, description, time, performed_by, client:client_id(client_id, full_name)")
            .order("time", { ascending: false })
            .limit(8)
            .returns<ClientActivityRow[]>()
        : Promise.resolve({ data: [], error: null }),
      canReadTitles
        ? supabase
            .from("land_title_status_history")
            .select("history_id, status, changed_at, changed_by, title:land_title!inner(title_id, client:client_id(full_name), property:property_id(location, block_number, lot_number))")
            .order("changed_at", { ascending: false })
            .limit(8)
            .returns<TitleActivityRow[]>()
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (clientResult.error) {
      console.error("Recent client activity failed:", clientResult.error.message);
    }
    if (titleResult.error) {
      console.error("Recent title activity failed:", titleResult.error.message);
    }

    const clientRows = (clientResult.data ?? []) as ClientActivityRow[];
    const titleRows = (titleResult.data ?? []) as TitleActivityRow[];

    const actorIds = [
      ...clientRows.map((row) => row.performed_by),
      ...titleRows.map((row) => row.changed_by),
    ].filter((id): id is string => Boolean(id));
    const namesResult = actorIds.length
      ? await supabase.rpc("get_user_names", { p_user_ids: [...new Set(actorIds)] })
      : { data: [], error: null };
    const names = new Map(
      ((namesResult.data ?? []) as UserNameRow[]).map((row) => [row.id, row.full_name]),
    );

    const clientItems: RecentActivityItem[] = clientRows.flatMap((row) => {
      const client = row.client;
      if (!client) return [];
      return [{
        id: row.log_id,
        kind: "client",
        label: row.event_type,
        detail: `${client.full_name}${row.description ? ` · ${row.description}` : ""}`,
        timestamp: row.time,
        actor: row.performed_by ? names.get(row.performed_by) ?? "Staff member" : "System",
        href: `/dashboard/clients?client=${encodeURIComponent(client.client_id)}`,
      }];
    });

    const titleItems: RecentActivityItem[] = titleRows.flatMap((row) => {
        const title = row.title;
        if (!title) return [];
        const property = title.property;
        const lotLabel = property
          ? `${property.location} · B${property.block_number} L${property.lot_number}`
          : "Title record";
        const statusTab =
          row.status === "Cleared by Billing" ? "intake" :
          row.status === "Document Preparation" ? "preparation" :
          row.status === "For Review" ? "review" :
          row.status === "For Signature" ? "signature" :
          row.status === "Clearance Period" ? "clearance" :
          row.status === "Ready for Claim" ? "ready" : "released";
        return [{
          id: row.history_id,
          kind: "title",
          label: `Title ${row.status}`,
          detail: `${title.client?.full_name ?? "Client account"} · ${lotLabel}`,
          timestamp: row.changed_at,
          actor: row.changed_by ? names.get(row.changed_by) ?? "Staff member" : "System",
          href: `/dashboard/legal?status=${statusTab}`,
        }];
      });

    return [...clientItems, ...titleItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  });
}
