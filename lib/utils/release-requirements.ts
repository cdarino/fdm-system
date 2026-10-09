import {
  RELEASE_DOCUMENT_TYPES,
  type ReleaseDocumentType,
  type TitleHolder,
} from '@/lib/types/title';

/**
 * The documents a title's release packet needs. The Deed of Sale is only
 * needed while the title is still in FDM's name. A title from before Sprint 3
 * has no recorded holder, so it is treated like FDM's and the Deed of Sale is
 * not skipped by accident.
 */
export function getRequiredReleaseDocuments(holder: TitleHolder | null): ReleaseDocumentType[] {
  return RELEASE_DOCUMENT_TYPES.filter((type) => type !== 'Deed of Sale' || holder !== 'client');
}

/** Required documents that have not been uploaded yet, in checklist order. */
export function getMissingReleaseDocuments(
  holder: TitleHolder | null,
  uploadedTypes: Iterable<string>
): ReleaseDocumentType[] {
  const uploaded = new Set(uploadedTypes);
  return getRequiredReleaseDocuments(holder).filter((type) => !uploaded.has(type));
}

/**
 * Whether the packet is complete enough to go to Management. Route Title
 * Release for Approval (S3-13) uses this to stop an incomplete release.
 */
export function isReleasePacketComplete(
  holder: TitleHolder | null,
  uploadedTypes: Iterable<string>
): boolean {
  return getMissingReleaseDocuments(holder, uploadedTypes).length === 0;
}

/**
 * Which of a client's documents count toward one lot's release packet: those
 * linked to that lot, and those linked to no lot (uploaded for the client as a
 * whole, which includes every document from before lots could be chosen).
 */
export function documentsForLot<T extends { property_id?: string | null }>(
  documents: T[],
  propertyId: string
): T[] {
  return documents.filter((doc) => !doc.property_id || doc.property_id === propertyId);
}
