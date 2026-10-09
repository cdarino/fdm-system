import type { PropertyLot } from './property';

/** Every kind of client document, in the order the upload menu lists them. */
export const DOC_TYPES = [
  'Valid ID',
  'Contract',
  'Deed of Sale',
  'SOA',
  'Payment History',
  'Certificate of Ownership',
  'Title Copy',
  'eCAR',
  'Other',
] as const;

export type DocType = (typeof DOC_TYPES)[number];

/** How each type reads on screen. The only contract FDM signs with buyers is the Contract to Sell. */
export const DOC_TYPE_LABEL: Record<DocType, string> = {
  'Valid ID': 'Valid ID',
  Contract: 'Contract to Sell',
  'Deed of Sale': 'Deed of Sale',
  SOA: 'Statement of Account (SOA)',
  'Payment History': 'Payment history',
  'Certificate of Ownership': 'Certificate of Ownership',
  'Title Copy': 'Copy of the title',
  eCAR: 'eCAR',
  Other: 'Other',
};

export const REQUIRED_CLIENT_DOCUMENTS: DocType[] = ['Valid ID', 'Contract', 'Deed of Sale'];

export interface Client {
  client_id: string;
  full_name: string;
  address: string | null;
  tin_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  is_archived?: boolean;
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
  /** The lot this document belongs to. Null means it applies to the client as a whole. */
  property_id?: string | null;
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
  properties?: ClientProperty[];
}

/** A lot on a client's profile, with where its sale stands. */
export interface ClientProperty extends PropertyLot {
  /** The client's active account for this lot, if any. */
  account_id?: string | null;
  /** When Billing cleared that account as fully paid. */
  cleared_at?: string | null;
  /** Whether Legal has created the land title for this lot. */
  has_title?: boolean;
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

export interface ClientInteractionInput {
  interaction_type: 'Call' | 'Meeting' | 'Email' | 'Note' | 'Follow-up' | 'Title Update' | string;
  notes: string;
}

export interface ClientDocumentChecklist {
  client_id: string;
  is_complete: boolean;
  present_documents: DocType[];
  missing_documents: DocType[];
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

