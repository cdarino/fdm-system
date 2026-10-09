import type { ClientDocument, DocType } from '@/lib/types/client';

/** The internal release steps, in order. A new title starts at the first one. */
export const TITLE_STATUSES = [
  'Cleared by Billing',
  'Legal Processing',
  'Legal Review',
  'Management Approval',
  '30-Day Clearance',
  'Ready for Claim',
  'Released',
] as const;

export type TitleStatus = (typeof TITLE_STATUSES)[number];

/** Whose name the title is in. A Deed of Sale is only needed for 'fdm'. */
export type TitleHolder = 'client' | 'fdm';

export const TITLE_HOLDER_LABEL: Record<TitleHolder, string> = {
  client: "Client's name",
  fdm: "FDM's name",
};

export interface LandTitle {
  title_id: string;
  property_id: string;
  client_id: string;
  title_number: string | null;
  status: TitleStatus;
  /** Null only on titles created before Sprint 3. */
  title_holder: TitleHolder | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: {
    client_id: string;
    full_name: string;
    status: string;
    address: string | null;
    /** The client's documents, used for the release packet progress on title lists. */
    documents?: Pick<ClientDocument, 'document_type' | 'property_id'>[];
  } | null;
  property?: {
    property_id: string;
    location: string;
    block_number: number;
    lot_number: number;
  } | null;
}

/** An account Billing has cleared that Legal has not created a title for yet. */
export interface AccountAwaitingTitle {
  account_id: string;
  cleared_at: string;
  property: {
    property_id: string;
    location: string;
    block_number: number;
    lot_number: number;
  };
  /** The principal buyer. The title is linked to this client. */
  client: {
    client_id: string;
    full_name: string;
  } | null;
  /** Anyone else on the account, such as a spouse buying together. */
  co_buyers: string[];
}

/** What Legal enters when creating the title for a cleared account. */
export interface CreateLandTitleInput {
  property_id: string;
  title_holder: TitleHolder;
  title_number: string;
}

export interface UpdateLandTitleInput {
  title_number?: string | null;
  title_holder?: TitleHolder;
  status?: TitleStatus;
}

/**
 * The release packet, in checklist order. These are client document types, so
 * a file uploaded on the client's profile and one uploaded from the Legal page
 * are the same document. There is no e-CAR.
 */
export const RELEASE_DOCUMENT_TYPES = [
  'SOA',
  'Payment History',
  'Certificate of Ownership',
  'Contract',
  'Deed of Sale',
  'Title Copy',
] as const satisfies readonly DocType[];

export type ReleaseDocumentType = (typeof RELEASE_DOCUMENT_TYPES)[number];
