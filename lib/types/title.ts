import type { ClientDocument, DocType } from '@/lib/types/client';

/** The internal release steps, in order. A new title starts at the first one. */
export const TITLE_STATUSES = [
  'Cleared by Billing',
  'Document Preparation',
  'For Review',
  'For Signature',
  'Clearance Period',
  'Ready for Claim',
  'Released',
] as const;

export type TitleStatus = (typeof TITLE_STATUSES)[number];

export interface LandTitle {
  title_id: string;
  property_id: string;
  client_id: string;
  status: TitleStatus;
  is_legacy_transferred: boolean;
  clearance_started_at?: string | null;
  released_at?: string | null;
  released_to_name?: string | null;
  released_to_id?: string | null;
  release_remarks?: string | null;
  release_attachment_id?: string | null;
  release_attachment?: FileAttachment | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: {
    client_id: string;
    full_name: string;
    status: string;
    address: string | null;
    civil_status?: string | null;
    spouse_name?: string | null;
    tin_number?: string | null;
    /** The client's documents, used for the release packet progress on title lists. */
    documents?: Pick<ClientDocument, 'document_type' | 'property_id'>[];
  } | null;
  property?: {
    property_id: string;
    location: string;
    block_number: number;
    lot_number: number;
    title_number?: string | null;
    area_size?: number | null;
    price_per_sqm?: number | null;
  } | null;
  history?: LandTitleStatusHistory[];
  notices?: LandTitleNotice[];
}

export interface FileAttachment {
  attachment_id: string;
  entity_type: string;
  entity_id: string;
  file_category: string;
  file_path: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  metadata: Record<string, unknown>;
  uploaded_at: string;
  uploaded_by: string | null;
}

export type LandTitleNoticeStatus = 'ongoing' | 'received' | 'returned_to_sender';

export interface LandTitleNotice {
  notice_id: string;
  title_id: string;
  notice_number: 1 | 2 | 3;
  status: LandTitleNoticeStatus;
  status_updated_at?: string | null;
  tracking_number?: string | null;
  generated_at: string;
  generated_by: string | null;
  rts_attachment_id: string | null;
  rts_attachment?: FileAttachment | null;
  rts_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface LandTitleStatusHistory {
  history_id: string;
  title_id: string;
  status: TitleStatus;
  changed_at: string;
  changed_by: string | null;
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
    title_number?: string | null;
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
  is_legacy_transferred?: boolean;
  status?: TitleStatus;
}

export interface UpdateLandTitleInput {
  is_legacy_transferred?: boolean;
  status?: TitleStatus;
  clearance_started_at?: string | null;
  released_to_name?: string | null;
  released_to_id?: string | null;
  release_remarks?: string | null;
  release_attachment_id?: string | null;
}

export interface RecordLandTitleReleaseInput {
  title_id: string;
  released_to_name: string;
  released_to_id: string;
  release_remarks?: string | null;
  release_attachment_id?: string | null;
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

export type StorageFeeStatus = 'not_applicable' | 'within_grace' | 'overdue';

export interface StorageFeeCalculation {
  isApplicable: boolean;
  status: StorageFeeStatus;
  monthlyRate: number;
  readyForClaimDate: Date | null;
  gracePeriodEndDate: Date | null;
  evaluationDate: Date;
  daysRemainingInGrace: number;
  monthsOverdue: number;
  accruedFee: number;
  isOverdue: boolean;
  isFrozen: boolean;
}
