'use client';

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateClient as updateClientAction,
  addContactInfo as addContactInfoAction,
  updateContactInfo as updateContactInfoAction,
  deleteContactInfo as deleteContactInfoAction,
  createClientLog as createClientLogAction,
  uploadClientDocument as uploadClientDocumentAction,
  deleteClientDocument as deleteClientDocumentAction,
  getClientDocumentUrl as getClientDocumentUrlAction,
} from '@/lib/actions/clients';
import type {
  Client,
  ClientWithDetails,
  ContactInfo,
  ClientLog,
  ClientDocument,
  CreateClientLogInput,
} from '@/lib/types/client';

/**
 * Sole owner of client-detail state and mutations for `/dashboard/clients/[id]`,
 * mirroring `use-admin-users` and `use-property-lots`.
 * Components under the client detail view consume this instead of prop-drilling
 * `client` / `setClient` or importing from `lib/actions/clients` directly.
 */
export interface ClientDetailContextValue {
  client: ClientWithDetails;
  updateAddress: (address: string) => Promise<Client>;
  updateTin: (tinNumber: string) => Promise<Client>;
  addContact: (type: string, value: string) => Promise<ContactInfo | null>;
  updateContact: (contactId: string, type: string, value: string) => Promise<ContactInfo | null>;
  deleteContact: (contactId: string) => Promise<void>;
  setPrimaryContact: (contactId: string) => Promise<void>;
  addActivity: (input: CreateClientLogInput) => Promise<ClientLog>;
  uploadDocument: (formData: FormData) => Promise<ClientDocument>;
  deleteDocument: (documentId: string) => Promise<void>;
  getDocumentUrl: (documentId: string) => Promise<string>;
}

const ClientDetailContext = createContext<ClientDetailContextValue | null>(null);

export function useClientDetail() {
  const ctx = useContext(ClientDetailContext);
  if (!ctx) throw new Error('useClientDetail must be used within ClientDetailProvider');
  return ctx;
}

export function ClientDetailProvider({
  initialClient,
  children,
}: {
  initialClient: ClientWithDetails;
  children: ReactNode;
}) {
  const router = useRouter();
  const [client, setClient] = useState<ClientWithDetails>(initialClient);

  // Sync state when server re-renders with new props
  useEffect(() => {
    setClient(initialClient);
  }, [initialClient]);

  const updateAddress = useCallback(
    async (address: string): Promise<Client> => {
      const trimmed = address.trim() || null;
      const result = await updateClientAction(client.client_id, { address: trimmed });
      if (!result.success) throw new Error(result.error);

      setClient((prev) => ({ ...prev, address: result.data.address }));
      router.refresh();
      return result.data;
    },
    [client.client_id, router]
  );

  const updateTin = useCallback(
    async (tinNumber: string): Promise<Client> => {
      const trimmed = tinNumber.trim() || null;
      const result = await updateClientAction(client.client_id, { tin_number: trimmed });
      if (!result.success) throw new Error(result.error);

      setClient((prev) => ({ ...prev, tin_number: result.data.tin_number }));
      router.refresh();
      return result.data;
    },
    [client.client_id, router]
  );

  const addContact = useCallback(
    async (type: string, value: string): Promise<ContactInfo | null> => {
      const trimmed = value.trim();
      if (!trimmed) return null;

      const result = await addContactInfoAction(client.client_id, {
        type,
        value: trimmed,
        is_primary: client.contact_info.length === 0,
      });
      if (!result.success) throw new Error(result.error);

      setClient((prev) => ({
        ...prev,
        contact_info: [result.data, ...prev.contact_info],
      }));
      router.refresh();
      return result.data;
    },
    [client.client_id, client.contact_info.length, router]
  );

  const updateContact = useCallback(
    async (contactId: string, type: string, value: string): Promise<ContactInfo | null> => {
      const trimmed = value.trim();
      if (!trimmed) return null;

      const result = await updateContactInfoAction(contactId, { type, value: trimmed });
      if (!result.success) throw new Error(result.error);

      setClient((prev) => ({
        ...prev,
        contact_info: prev.contact_info.map((c) =>
          c.contact_id === contactId
            ? { ...c, type: result.data.type, value: result.data.value }
            : c
        ),
      }));
      router.refresh();
      return result.data;
    },
    [router]
  );

  const deleteContact = useCallback(
    async (contactId: string): Promise<void> => {
      const result = await deleteContactInfoAction(contactId);
      if (!result.success) throw new Error(result.error);

      setClient((prev) => ({
        ...prev,
        contact_info: prev.contact_info.filter((c) => c.contact_id !== contactId),
      }));
      router.refresh();
    },
    [router]
  );

  const setPrimaryContact = useCallback(
    async (contactId: string): Promise<void> => {
      const result = await updateContactInfoAction(contactId, { is_primary: true });
      if (!result.success) throw new Error(result.error);

      setClient((prev) => ({
        ...prev,
        contact_info: prev.contact_info.map((c) => ({
          ...c,
          is_primary: c.contact_id === contactId,
        })),
      }));
      router.refresh();
    },
    [router]
  );

  const addActivity = useCallback(
    async (input: CreateClientLogInput): Promise<ClientLog> => {
      const created = await createClientLogAction(client.client_id, input);
      setClient((prev) => ({
        ...prev,
        client_log: [created, ...prev.client_log],
      }));
      router.refresh();
      return created;
    },
    [client.client_id, router]
  );

  const uploadDocument = useCallback(
    async (formData: FormData): Promise<ClientDocument> => {
      const result = await uploadClientDocumentAction(client.client_id, formData);
      if (!result.success) throw new Error(result.error);

      setClient((prev) => ({
        ...prev,
        client_document: [result.data, ...prev.client_document],
      }));
      router.refresh();
      return result.data;
    },
    [client.client_id, router]
  );

  const deleteDocument = useCallback(
    async (documentId: string): Promise<void> => {
      const result = await deleteClientDocumentAction(documentId);
      if (!result.success) throw new Error(result.error);

      setClient((prev) => ({
        ...prev,
        client_document: prev.client_document.filter((d) => d.document_id !== documentId),
      }));
      router.refresh();
    },
    [router]
  );

  const getDocumentUrl = useCallback(async (documentId: string): Promise<string> => {
    return await getClientDocumentUrlAction(documentId);
  }, []);

  const value: ClientDetailContextValue = {
    client,
    updateAddress,
    updateTin,
    addContact,
    updateContact,
    deleteContact,
    setPrimaryContact,
    addActivity,
    uploadDocument,
    deleteDocument,
    getDocumentUrl,
  };

  return createElement(ClientDetailContext.Provider, { value }, children);
}

