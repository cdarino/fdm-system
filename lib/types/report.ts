import type { Client, ContactInfo, ClientDocument, ClientLog, DocType } from './client';
import type { PropertyLot, PropertyStatus } from './property';

export interface ClientAssignedProperty {
  property_id: string;
  location: string;
  block_number: number;
  lot_number: number;
  area_size: number;
  price_per_sqm: number;
  total_contract_price: number;
  remaining_balance: number;
  status: PropertyStatus;
  role: string;
  ownership_percentage: number;
}

export interface ClientReportData {
  client: Client;
  contacts: ContactInfo[];
  documents: ClientDocument[];
  documentChecklist: {
    isComplete: boolean;
    present: DocType[];
    missing: DocType[];
  };
  logs: (ClientLog & { performer_name?: string })[];
  properties: ClientAssignedProperty[];
  financials: {
    totalPortfolioValue: number;
    totalRemainingBalance: number;
    totalAreaSqm: number;
    propertyCount: number;
  };
}

export interface PropertyReportData {
  lot: PropertyLot;
  site_name: string | null;
  calculated_total_price: number;
  active_account: {
    account_id: string;
    status: string;
    total_contract_price: number;
    remaining_balance: number;
    paid_amount: number;
    completion_rate: number;
  } | null;
  parties: {
    client_id: string;
    full_name: string;
    tin_number: string | null;
    contacts: { type: string; value: string; is_primary: boolean }[];
    role: string;
    ownership_percentage: number;
    is_primary: boolean;
  }[];
}

