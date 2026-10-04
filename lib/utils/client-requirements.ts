import { REQUIRED_CLIENT_DOCUMENTS, type Client, type ClientDocument, type DocType } from '@/lib/types/client';

export interface ClientRequirements {
  /** Whether profile fields (full_name, address, tin_number) are all present */
  profileComplete: boolean;
  /** Whether all required documents are uploaded */
  documentsComplete: boolean;
  /** Whether client meets all requirements (profile + documents) */
  isComplete: boolean;
  /** List of missing profile fields */
  missingProfile: string[];
  /** List of missing required document types */
  missingDocuments: DocType[];
}

/**
 * Check if a client's profile is complete.
 * A complete profile requires: full_name, address, and tin_number.
 */
export function isProfileComplete(client: Pick<Client, 'full_name' | 'address' | 'tin_number'>): boolean {
  return Boolean(
    client.full_name?.trim() &&
    client.address?.trim() &&
    client.tin_number?.trim()
  );
}

/**
 * Get list of missing profile fields for a client.
 */
export function getMissingProfileFields(client: Pick<Client, 'full_name' | 'address' | 'tin_number'>): string[] {
  const missing: string[] = [];
  
  if (!client.full_name?.trim()) {
    missing.push('Full name');
  }
  if (!client.address?.trim()) {
    missing.push('Address');
  }
  if (!client.tin_number?.trim()) {
    missing.push('TIN number');
  }
  
  return missing;
}

/**
 * Check if a client has all required documents uploaded.
 */
export function hasRequiredDocuments(documents: ClientDocument[]): boolean {
  const presentTypes = new Set(documents.map((doc) => doc.document_type));
  return REQUIRED_CLIENT_DOCUMENTS.every((required) => presentTypes.has(required));
}

/**
 * Get list of missing required document types.
 */
export function getMissingDocuments(documents: ClientDocument[]): DocType[] {
  const presentTypes = new Set(documents.map((doc) => doc.document_type));
  return REQUIRED_CLIENT_DOCUMENTS.filter((required) => !presentTypes.has(required));
}

/**
 * Comprehensive check of whether a client meets all requirements
 * to be assigned to a property (profile complete + required documents uploaded).
 */
export function isClientComplete(
  client: Pick<Client, 'full_name' | 'address' | 'tin_number'>,
  documents: ClientDocument[]
): boolean {
  return isProfileComplete(client) && hasRequiredDocuments(documents);
}

/**
 * Get detailed requirements status for a client.
 * Returns breakdown of what's complete and what's missing.
 */
export function getClientRequirements(
  client: Pick<Client, 'full_name' | 'address' | 'tin_number'>,
  documents: ClientDocument[]
): ClientRequirements {
  const profileComplete = isProfileComplete(client);
  const documentsComplete = hasRequiredDocuments(documents);
  const missingProfile = getMissingProfileFields(client);
  const missingDocuments = getMissingDocuments(documents);

  return {
    profileComplete,
    documentsComplete,
    isComplete: profileComplete && documentsComplete,
    missingProfile,
    missingDocuments,
  };
}

/**
 * Format requirements for display (e.g., in error messages or alerts).
 */
export function formatMissingRequirements(requirements: ClientRequirements): string {
  const missing: string[] = [];
  
  if (requirements.missingProfile.length > 0) {
    missing.push(...requirements.missingProfile);
  }
  
  if (requirements.missingDocuments.length > 0) {
    missing.push(...requirements.missingDocuments);
  }
  
  return missing.join(', ');
}
