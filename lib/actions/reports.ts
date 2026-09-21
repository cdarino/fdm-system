"use server";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/actions/auth-guard";
import { REQUIRED_CLIENT_DOCUMENTS } from "@/lib/types/client";
import type { DocType, ClientLog, ContactInfo } from "@/lib/types/client";
import type { PropertyStatus } from "@/lib/types/property";
import type { ClientAssignedProperty, ClientReportData, PropertyReportData } from "@/lib/types/report";

interface QueryPartyRow {
  role?: string | null;
  ownership_percentage?: number | null;
  is_primary?: boolean | null;
  ledger_account?: {
    account_id: string;
    status: string;
    total_contract_price?: number | null;
    remaining_balance?: number | null;
    property_lot?: {
      property_id: string;
      location: string;
      block_number: number;
      lot_number: number;
      area_size: number;
      price_per_sqm: number;
      status: PropertyStatus;
    } | null;
  } | null;
}

interface RawPartyEntry {
  client_id: string;
  role: string;
  ownership_percentage: number;
  is_primary: boolean;
  client?: {
    client_id: string;
    full_name: string;
    tin_number: string | null;
    contact_info?: ContactInfo[];
  } | null;
}

interface RawLedgerEntry {
  account_id: string;
  status: string;
  total_contract_price: number;
  remaining_balance: number;
  parties?: RawPartyEntry[];
}

interface RawLotQueryResult {
  property_id: string;
  site_id: string | null;
  boundary: unknown;
  location: string;
  block_number: number;
  lot_number: number;
  area_size: number;
  price_per_sqm: number;
  status: PropertyStatus;
  created_at: string;
  updated_at: string;
  site?: { site_id: string; name: string; description: string | null } | null;
  ledger_accounts?: RawLedgerEntry[];
}

async function resolvePerformerNames(userIds: string[]): Promise<Map<string, string>> {
  const userMap = new Map<string, string>();
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return userMap;

  // Resolve user full names from RBAC / auth store
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc("get_user_names", { p_user_ids: uniqueIds });
  if (error) return userMap;

  for (const user of (data ?? []) as Array<{ id: string; full_name: string }>) {
    if (user.id && user.full_name) userMap.set(user.id, user.full_name);
  }
  return userMap;
}

export async function getClientReportData(clientId: string): Promise<ClientReportData> {
  await requirePermission("clients.read");
  const supabase = await createSupabaseServerClient();

  // Query client core profile with contacts, documents, and interaction audit logs
  const { data: client, error: clientErr } = await supabase
    .from("client")
    .select("*, contact_info(*), client_document(*), client_log(*)")
    .eq("client_id", clientId)
    .single();

  if (clientErr || !client) {
    throw new Error(`Client not found: ${clientErr?.message ?? "Unknown error"}`);
  }

  // Calculate document compliance status against mandatory checklists
  const documents = client.client_document ?? [];
  const presentDocs: DocType[] = Array.from(new Set(documents.map((d: { document_type: DocType }) => d.document_type)));
  const missingDocs = REQUIRED_CLIENT_DOCUMENTS.filter((req) => !presentDocs.includes(req));

  // Query assigned properties via active ledger accounts
  const { data: partyRows } = await supabase
    .from("account_party")
    .select(`
      role,
      ownership_percentage,
      is_primary,
      ledger_account!inner(
        account_id,
        status,
        total_contract_price,
        remaining_balance,
        property_lot!inner(*)
      )
    `)
    .eq("client_id", clientId)
    .returns<QueryPartyRow[]>();

  const assignedProperties: ClientAssignedProperty[] = (partyRows ?? [])
    .map((row) => {
      const ledger = row.ledger_account;
      const lot = ledger?.property_lot;
      if (!lot) return null;
      return {
        property_id: lot.property_id,
        location: lot.location,
        block_number: lot.block_number,
        lot_number: lot.lot_number,
        area_size: Number(lot.area_size),
        price_per_sqm: Number(lot.price_per_sqm),
        total_contract_price: Number(ledger.total_contract_price ?? 0),
        remaining_balance: Number(ledger.remaining_balance ?? 0),
        status: lot.status,
        role: row.role ?? "Principal Buyer",
        ownership_percentage: Number(row.ownership_percentage ?? 100),
      };
    })
    .filter((p): p is ClientAssignedProperty => Boolean(p));

  // Resolve performer display names for interaction activity logs
  const clientLogs: ClientLog[] = client.client_log ?? [];
  const performerIds = clientLogs
    .map((l) => l.performed_by)
    .filter((id): id is string => Boolean(id));
  const userNames = await resolvePerformerNames(performerIds);

  const logs = [...clientLogs]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .map((log) => ({
      ...log,
      performer_name: log.performed_by ? userNames.get(log.performed_by) ?? "Staff Member" : "System",
    }));

  // Aggregate portfolio totals across assigned lots
  const totalPortfolioValue = assignedProperties.reduce((acc, p) => acc + p.total_contract_price, 0);
  const totalRemainingBalance = assignedProperties.reduce((acc, p) => acc + p.remaining_balance, 0);
  const totalAreaSqm = assignedProperties.reduce((acc, p) => acc + p.area_size, 0);

  return {
    client: {
      client_id: client.client_id,
      full_name: client.full_name,
      address: client.address,
      tin_number: client.tin_number,
      status: client.status,
      created_at: client.created_at,
      updated_at: client.updated_at,
    },
    contacts: client.contact_info ?? [],
    documents,
    documentChecklist: {
      isComplete: missingDocs.length === 0,
      present: presentDocs,
      missing: missingDocs,
    },
    logs,
    properties: assignedProperties,
    financials: {
      totalPortfolioValue,
      totalRemainingBalance,
      totalAreaSqm,
      propertyCount: assignedProperties.length,
    },
  };
}

export async function getPropertyReportData(propertyId: string): Promise<PropertyReportData> {
  await requirePermission("properties.read");
  const supabase = await createSupabaseServerClient();

  // Query property lot with site and ledger accounts
  const { data: lot, error: lotErr } = await supabase
    .from("property_lot")
    .select(`
      *,
      site:site(site_id, name, description),
      ledger_accounts:ledger_account(
        account_id,
        status,
        total_contract_price,
        remaining_balance,
        parties:account_party(
          client_id,
          role,
          ownership_percentage,
          is_primary,
          client:client(
            client_id,
            full_name,
            tin_number,
            contact_info(*)
          )
        )
      )
    `)
    .eq("property_id", propertyId)
    .single<RawLotQueryResult>();

  if (lotErr || !lot) {
    throw new Error(`Property lot not found: ${lotErr?.message ?? "Unknown error"}`);
  }

  // Parse active ledger account and ownership parties
  const activeLedger = lot.ledger_accounts?.find((l) => l.status === "Active") ?? lot.ledger_accounts?.[0] ?? null;
  const tcp = Number(activeLedger?.total_contract_price ?? Number(lot.area_size) * Number(lot.price_per_sqm));
  const remaining = Number(activeLedger?.remaining_balance ?? tcp);
  const paid = Math.max(0, tcp - remaining);
  const completionRate = tcp > 0 ? (paid / tcp) * 100 : 0;

  const parties = (activeLedger?.parties ?? []).map((party) => ({
    client_id: party.client_id,
    full_name: party.client?.full_name ?? "Unassigned",
    tin_number: party.client?.tin_number ?? null,
    contacts: party.client?.contact_info ?? [],
    role: party.role ?? "Principal Buyer",
    ownership_percentage: Number(party.ownership_percentage ?? 100),
    is_primary: Boolean(party.is_primary),
  }));

  return {
    lot: {
      property_id: lot.property_id,
      site_id: lot.site_id ?? null,
      boundary: lot.boundary ?? null,
      location: lot.location,
      block_number: lot.block_number,
      lot_number: lot.lot_number,
      area_size: Number(lot.area_size),
      price_per_sqm: Number(lot.price_per_sqm),
      status: lot.status,
      created_at: lot.created_at,
      updated_at: lot.updated_at,
    },
    site_name: lot.site?.name ?? null,
    calculated_total_price: Number(lot.area_size) * Number(lot.price_per_sqm),
    active_account: activeLedger
      ? {
          account_id: activeLedger.account_id,
          status: activeLedger.status,
          total_contract_price: tcp,
          remaining_balance: remaining,
          paid_amount: paid,
          completion_rate: completionRate,
        }
      : null,
    parties,
  };
}

