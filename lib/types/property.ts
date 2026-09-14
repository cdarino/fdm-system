import type { Client } from './client';

export type PropertyStatus = 'Open' | 'Reserved' | 'Sold' | 'Forfeited';

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
  client_id: string | null;
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
  client: Pick<Client, 'client_id' | 'full_name' | 'status'> | null;
}

/** A site plus every lot cut from it, which is all the map needs to draw. */
export interface SiteWithLots extends Site {
  lots: PropertyLotWithClient[];
}

export interface CreatePropertyLotInput {
  location: string;
  site_id?: string | null;
  block_number: number;
  lot_number: number;
  area_size: number;
  price_per_sqm: number;
  status?: PropertyStatus;
  client_id?: string | null;
}

export interface UpdatePropertyLotInput {
  location?: string;
  block_number?: number;
  lot_number?: number;
  area_size?: number;
  price_per_sqm?: number;
  status?: PropertyStatus;
  client_id?: string | null;
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

