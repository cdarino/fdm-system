import {
  DOC_TYPE_LABEL,
  REQUIRED_CLIENT_DOCUMENTS,
  type Client,
  type ClientDocument,
  type DocType,
  type CivilStatus,
  type Gender,
} from '@/lib/types/client';

export type ClientProfileRequirementsInput = Pick<Client, 'full_name' | 'address' | 'tin_number'> & {
  civil_status?: CivilStatus | null;
  spouse_name?: string | null;
  spouse_contact?: string[] | null;
  gender?: Gender | null;
  contact_info?: Array<{ value?: string | null }>;
};

export interface ClientRequirements {
  profileComplete: boolean;
  documentsComplete: boolean;
  isComplete: boolean;
  missingProfile: string[];
  missingDocuments: DocType[];
}

export function isProfileComplete(client: ClientProfileRequirementsInput): boolean {
  const hasSpouseContact =
    client.spouse_contact !== undefined
      ? Boolean(client.spouse_contact && client.spouse_contact.some((c) => Boolean(c?.trim())))
      : true;
  const isSpouseValid =
    client.civil_status === 'Married'
      ? Boolean(client.spouse_name?.trim()) && hasSpouseContact
      : true;

  return Boolean(
    client.full_name?.trim() &&
    client.address?.trim() &&
    client.tin_number?.trim() &&
    client.civil_status &&
    client.gender &&
    isSpouseValid &&
    client.contact_info?.some((c) => Boolean(c.value?.trim()))
  );
}

export function getMissingProfileFields(client: ClientProfileRequirementsInput): string[] {
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
  if (!client.civil_status) {
    missing.push('Civil status');
  } else if (client.civil_status === 'Married') {
    if (!client.spouse_name?.trim()) {
      missing.push('Spouse name');
    }
    if (
      client.spouse_contact !== undefined &&
      (!client.spouse_contact || !client.spouse_contact.some((c) => Boolean(c?.trim())))
    ) {
      missing.push('Spouse contact');
    }
  }
  if (!client.gender) {
    missing.push('Gender');
  }
  if (!client.contact_info?.some((c) => Boolean(c.value?.trim()))) {
    missing.push('Contact information');
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

export function isClientComplete(
  client: ClientProfileRequirementsInput,
  documents: ClientDocument[]
): boolean {
  return isProfileComplete(client) && hasRequiredDocuments(documents);
}

export function getClientRequirements(
  client: ClientProfileRequirementsInput,
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
    missing.push(...requirements.missingDocuments.map((type) => DOC_TYPE_LABEL[type]));
  }
  
  return missing.join(', ');
}
