import type { PropertyLot } from './property';

export type DocType = 'Valid ID' | 'Deed of Sale' | 'Contract' | 'eCAR' | 'Other';

export const REQUIRED_CLIENT_DOCUMENTS: DocType[] = ['Valid ID', 'Contract', 'Deed of Sale'];

export interface Client {
  client_id: string;
  full_name: string;
  address: string | null;
  tin_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ContactInfo {
  contact_id: string;
  client_id: string;
  type: string;
  value: string;
  is_primary: boolean;
  last_updated: string;
}

export interface ClientDocument {
  document_id: string;
  client_id: string;
  document_type: DocType;
  file_path: string;
  uploaded_at: string;
  uploaded_by: string | null;
}

export interface ClientLog {
  log_id: string;
  client_id: string;
  event_type: string;
  description: string | null;
  time: string;
  performed_by: string | null;
}

export interface ClientWithDetails extends Client {
  contact_info: ContactInfo[];
  client_document: ClientDocument[];
  client_log: ClientLog[];
  properties?: PropertyLot[];
}

export interface ClientActivitySummary {
  description: string | null;
  time: string;
  performer_name: string;
}

export interface ClientListItem extends Client {
  contact_info: ContactInfo[];
  latest_activity: ClientActivitySummary | null;
}

export interface CreateContactInfoInput {
  type: string;
  value: string;
  is_primary?: boolean;
}

export interface UpdateContactInfoInput {
  type?: string;
  value?: string;
  is_primary?: boolean;
}

export interface CreateClientInput {
  full_name: string;
  address?: string | null;
  tin_number?: string | null;
  status?: string;
  contacts?: CreateContactInfoInput[];
}

export interface UpdateClientInput {
  full_name?: string;
  address?: string | null;
  tin_number?: string | null;
  status?: string;
}

export interface CreateClientDocumentInput {
  document_type: DocType;
  file_path: string;
}

export interface CreateClientLogInput {
  event_type: string;
  description?: string | null;
}

export interface ClientDocumentNotification {
  client_id: string;
  full_name: string;
  missing_documents: DocType[];
  contact?: { type: string; value: string } | null;
}

export interface GetClientsParams {
  search?: string;
  status?: string;
  area?: string;
  includeArchived?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'full_name' | 'created_at' | 'status' | 'address';
  sortOrder?: 'asc' | 'desc';
}

export type { PaginatedResult } from '@/lib/pagination';

