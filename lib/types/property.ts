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

export interface PropertyLot {
  property_id: string;
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
  client: Pick<Client, 'client_id' | 'full_name' | 'status'> | null;
  client_id?: string | null;
  active_account?: LedgerAccountWithParties | null;
}

export interface CreatePropertyLotInput {
  location: string;
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
