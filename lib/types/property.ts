import type { Client } from './client';

export type PropertyStatus = 'Open' | 'Reserved' | 'Sold' | 'Forfeited';
export type AccountStatus = 'Active' | 'Matured' | 'Delinquent' | 'Cancelled';

export interface AccountParty {
  account_id: string;
  client_id: string;
  role: string;
  ownership_percentage: number;
  is_primary: boolean;
  created_at: string;
  client?: Pick<Client, 'client_id' | 'full_name' | 'status' | 'tin_number'> | null;
}

export interface LedgerAccount {
  account_id: string;
  property_id: string;
  status: AccountStatus;
  total_contract_price: number;
  remaining_balance: number;
  created_at: string;
  updated_at: string;
}

export interface LedgerAccountWithParties extends LedgerAccount {
  parties: AccountParty[];
}

/**
 * Site geometry comes back from JSONB as `unknown` — the database CHECK only
 * proves it is an array of length >= 3, not that its elements are vertex
 * pairs. Run it through `parseRing()` in lib/geometry.ts before use.
 */
export interface Site {
  site_id: string;
  name: string;
  description: string | null;
  boundary: unknown;
  created_at: string;
  updated_at: string;
}

export interface PropertyLot {
  property_id: string;
  site_id: string | null;
  /** Local-space ring, or null for lots that have not been drawn yet. */
  boundary: unknown;
  location: string;
  block_number: number;
  lot_number: number;
  area_size: number;
  price_per_sqm: number;
  status: PropertyStatus;
  created_at: string;
  updated_at: string;
}

export interface PropertyLotWithClient extends PropertyLot {
  client: Pick<Client, 'client_id' | 'full_name' | 'status' | 'address'> | null;
  client_id?: string | null;
  active_account?: LedgerAccountWithParties | null;
}

/** A pre-planned lot division on a site, drawn from the plat before any property is created. */
export interface SiteSubdivision {
  subdivision_id: string;
  site_id: string;
  block_number: number;
  lot_number: number;
  boundary: unknown;
}

/** A site with its pre-planned subdivisions and any registered property lots. */
export interface SiteWithLots extends Site {
  subdivisions: SiteSubdivision[];
  lots: PropertyLotWithClient[];
}

export interface CreatePropertyLotInput {
  location: string;
  /** Required via the UI — every lot must link to a pre-existing site. Optional here for direct action callers (e.g. tests). */
  site_id?: string | null;
  block_number: number;
  lot_number: number;
  area_size: number;
  price_per_sqm: number;
  status?: PropertyStatus;
}

export interface UpdatePropertyLotInput {
  location?: string;
  block_number?: number;
  lot_number?: number;
  area_size?: number;
  price_per_sqm?: number;
  status?: PropertyStatus;
}

export interface AssignPartyInput {
  client_id: string;
  role?: string;
  ownership_percentage?: number;
  is_primary?: boolean;
}

export interface AssignPropertyOptions {
  total_contract_price?: number;
  status?: PropertyStatus;
}

export interface GetPropertyLotsParams {
  search?: string;
  status?: PropertyStatus;
  client_id?: string;
  location?: string;
  block_number?: number;
  lot_number?: number;
  page?: number;
  limit?: number;
  sortBy?: 'location' | 'block_number' | 'lot_number' | 'status' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}
