import { REQUIRED_CLIENT_DOCUMENTS, type DocType } from '@/lib/types/client';

export interface ReviewableClient {
  client_id: string;
  full_name: string;
  contact_info: { value: string }[];
  client_document: { document_type: DocType }[];
}

export interface ClientFollowUp {
  clientId: string;
  name: string;
  missingDocuments: DocType[];
  missingContact: boolean;
}

/** Presence checks only: an existing contact is not proof it is current. */
export function reviewClientRecord(client: ReviewableClient): ClientFollowUp {
  const present = new Set(client.client_document.map(doc => doc.document_type));
  return {
    clientId: client.client_id,
    name: client.full_name,
    missingDocuments: REQUIRED_CLIENT_DOCUMENTS.filter(type => !present.has(type)),
    missingContact: !client.contact_info.some(contact => contact.value.trim().length > 0),
  };
}
