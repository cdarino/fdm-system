import type {
  PropertyLot,
  PropertyLotWithClient,
  LedgerAccountWithParties,
} from "@/lib/types/property";
import type { LandTitle } from "@/lib/types/title";

export interface RawPartyRow {
  account_id: string;
  client_id: string;
  role: string;
  ownership_percentage: number;
  is_primary: boolean;
  created_at: string;
  client: { client_id: string; full_name: string; status: string; address: string | null } | null;
}

export interface RawLedgerRow {
  account_id: string;
  property_id: string;
  status: "Active" | "Matured" | "Delinquent" | "Cancelled";
  total_contract_price: number;
  remaining_balance: number;
  created_at: string;
  updated_at: string;
  parties: RawPartyRow[];
}

export interface RawLandTitleRow {
  title_id: string;
  property_id: string;
  client_id: string;
  title_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  client?: { client_id: string; full_name: string; status: string; address: string | null } | null;
}

export interface RawLotRow extends PropertyLot {
  ledger_accounts?: RawLedgerRow[];
  land_title?: RawLandTitleRow[] | RawLandTitleRow | null;
}

export const LOT_WITH_CLIENT_SELECT = `
  *,
  ledger_accounts:ledger_account(
    account_id,
    property_id,
    status,
    total_contract_price,
    remaining_balance,
    created_at,
    updated_at,
    parties:account_party(
      account_id,
      client_id,
      role,
      ownership_percentage,
      is_primary,
      created_at,
      client:client_id(client_id, full_name, status, address)
    )
  ),
  land_title:land_title(
    title_id,
    property_id,
    client_id,
    title_number,
    status,
    created_at,
    updated_at,
    client:client_id(client_id, full_name, status, address)
  )
`;

export function mapLotWithAccount(lot: RawLotRow): PropertyLotWithClient {
  const activeAccount = lot.ledger_accounts?.find((a) => a.status === "Active") ?? null;
  const primaryParty = activeAccount?.parties?.find((p) => p.is_primary) ?? activeAccount?.parties?.[0] ?? null;

  const rawTitle = Array.isArray(lot.land_title) ? lot.land_title[0] : lot.land_title;
  const resolvedClient = primaryParty?.client ?? rawTitle?.client ?? null;
  const resolvedClientId = primaryParty?.client_id ?? rawTitle?.client_id ?? null;

  return {
    property_id: lot.property_id,
    site_id: lot.site_id ?? null,
    boundary: lot.boundary ?? null,
    location: lot.location,
    block_number: lot.block_number,
    lot_number: lot.lot_number,
    area_size: lot.area_size,
    price_per_sqm: lot.price_per_sqm,
    status: lot.status,
    created_at: lot.created_at,
    updated_at: lot.updated_at,
    is_archived: Boolean(lot.is_archived),
    archived_at: lot.archived_at ?? null,
    client: resolvedClient,
    client_id: resolvedClientId,
    active_account: activeAccount as LedgerAccountWithParties | null,
    title: (rawTitle as LandTitle) ?? null,
  };
}
