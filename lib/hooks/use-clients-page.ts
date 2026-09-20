'use client';

import { createContext, createElement, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  getClients,
  getClientById,
  createClient as createClientAction,
  updateClient as updateClientAction,
  deleteClient as deleteClientAction,
  archiveClient as archiveClientAction,
  unarchiveClient as unarchiveClientAction,
  addContactInfo as addContactInfoAction,
  updateContactInfo as updateContactInfoAction,
  deleteContactInfo as deleteContactInfoAction,
  createClientLog as createClientLogAction,
  uploadClientDocument as uploadClientDocumentAction,
  deleteClientDocument as deleteClientDocumentAction,
  getClientDocumentUrl as getClientDocumentUrlAction,
} from '@/lib/actions/clients';
import type {
  ClientListItem,
  ClientWithDetails,
  ContactInfo,
  ClientLog,
  ClientDocument,
  CreateClientInput,
  UpdateClientInput,
  CreateContactInfoInput,
  CreateClientLogInput,
} from '@/lib/types/client';

export type ClientStatusFilter = 'all' | 'Active' | 'Inactive' | 'Archived';

/** Status that takes a client out of the working list. Set by `archiveClient`. */
export const ARCHIVED_STATUS = 'Archived';

export type ClientDialog =
  | { type: 'create' }
  | { type: 'edit'; client: ClientListItem }
  | { type: 'delete'; client: ClientListItem }
  | { type: 'archive'; client: ClientListItem }
  | { type: 'details'; client: ClientListItem }
  | null;

interface ClientsContextValue {
  clients: ClientListItem[];
  visibleClients: ClientListItem[];
  isLoading: boolean;
  error: string | null;
  search: string;
  setSearch: (query: string) => void;
  statusFilter: ClientStatusFilter;
  setStatusFilter: (status: ClientStatusFilter) => void;
  activeDialog: ClientDialog;
  openDialog: (dialog: ClientDialog) => void;
  closeDialog: () => void;
  createClient: (input: CreateClientInput) => Promise<void>;
  updateClient: (clientId: string, input: UpdateClientInput) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;
  archiveClient: (clientId: string) => Promise<void>;
  restoreClient: (clientId: string) => Promise<void>;
  getClientDetails: (clientId: string) => Promise<ClientWithDetails>;
  addContact: (clientId: string, input: CreateContactInfoInput) => Promise<ContactInfo>;
  deleteContact: (clientId: string, contactId: string) => Promise<void>;
  setPrimaryContact: (clientId: string, contactId: string) => Promise<void>;
  addLog: (clientId: string, input: CreateClientLogInput) => Promise<ClientLog>;
  uploadDocument: (clientId: string, formData: FormData) => Promise<ClientDocument>;
  deleteDocument: (documentId: string) => Promise<void>;
  getDocumentUrl: (documentId: string) => Promise<string>;
  refreshClients: () => Promise<void>;
}

const ClientsContext = createContext<ClientsContextValue | null>(null);

export function useClients() {
  const ctx = useContext(ClientsContext);
  if (!ctx) throw new Error('useClients must be used within ClientsProvider');
  return ctx;
}

function matchesSearch(client: ClientListItem, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const contactValues = client.contact_info.map((c) => c.value);
  const fields = [
    client.full_name,
    client.address ?? '',
    client.tin_number ?? '',
    ...contactValues,
  ].map((field) => field.toLowerCase());

  return words.every((word) => fields.some((field) => field.includes(word)));
}

export function ClientsProvider({
  children,
  initialClients = [],
}: {
  children: ReactNode;
  initialClients?: ClientListItem[];
}) {
  const router = useRouter();
  const [clients, setClients] = useState<ClientListItem[]>(initialClients);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<ClientDialog>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatusFilter>('all');

  /**
   * Archived clients are held in the same list but shown only under their own
   * tab. Every other tab, "All" included, hides them, so archiving takes a
   * client out of the working view without hiding the record from the page.
   */
  const visibleClients = useMemo(() => {
    return clients.filter((client) => {
      const isArchived = client.status === ARCHIVED_STATUS;

      if (statusFilter === 'Archived') {
        if (!isArchived) return false;
      } else {
        if (isArchived) return false;
        if (statusFilter !== 'all' && client.status.toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      return matchesSearch(client, search);
    });
  }, [clients, search, statusFilter]);

  const openDialog = useCallback((dialog: ClientDialog) => setActiveDialog(dialog), []);
  const closeDialog = useCallback(() => setActiveDialog(null), []);

  const refreshClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // `includeArchived` fetches both sets in one query; `visibleClients`
      // decides which of them the current tab shows.
      const result = await getClients({
        limit: 200,
        sortBy: 'full_name',
        sortOrder: 'asc',
        includeArchived: true,
      });
      setClients(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createClient = useCallback(async (input: CreateClientInput) => {
    const created = await createClientAction(input);
    const newListItem: ClientListItem = {
      ...created,
      contact_info: [],
      latest_activity: null,
    };
    setClients((prev) => [newListItem, ...prev]);
    router.refresh();
  }, [router]);

  const updateClient = useCallback(async (clientId: string, input: UpdateClientInput) => {
    const updated = await updateClientAction(clientId, input);
    setClients((prev) =>
      prev.map((c) => (c.client_id === clientId ? { ...c, ...updated } : c))
    );
    router.refresh();
  }, [router]);

  const deleteClient = useCallback(async (clientId: string) => {
    await deleteClientAction(clientId);
    setClients((prev) => prev.filter((c) => c.client_id !== clientId));
    router.refresh();
  }, [router]);

  /**
   * Archive and restore both just move the client's status, so the row stays in
   * state and changes which tab it belongs to. Dropping it from the list
   * instead would leave the Archived tab empty until a refetch.
   */
  const archiveClient = useCallback(async (clientId: string) => {
    const updated = await archiveClientAction(clientId);
    setClients((prev) =>
      prev.map((c) => (c.client_id === clientId ? { ...c, ...updated } : c))
    );
    router.refresh();
  }, [router]);

  const restoreClient = useCallback(async (clientId: string) => {
    const updated = await unarchiveClientAction(clientId);
    setClients((prev) =>
      prev.map((c) => (c.client_id === clientId ? { ...c, ...updated } : c))
    );
    router.refresh();
  }, [router]);

  const getClientDetails = useCallback(async (clientId: string) => {
    return await getClientById(clientId);
  }, []);

  const addContact = useCallback(async (clientId: string, input: CreateContactInfoInput) => {
    const created = await addContactInfoAction(clientId, input);
    setClients((prev) =>
      prev.map((c) => {
        if (c.client_id !== clientId) return c;
        return {
          ...c,
          contact_info: [created, ...c.contact_info],
        };
      })
    );
    return created;
  }, []);

  const deleteContact = useCallback(async (clientId: string, contactId: string) => {
    await deleteContactInfoAction(contactId);
    setClients((prev) =>
      prev.map((c) => {
        if (c.client_id !== clientId) return c;
        return {
          ...c,
          contact_info: c.contact_info.filter((item) => item.contact_id !== contactId),
        };
      })
    );
  }, []);

  const setPrimaryContact = useCallback(async (clientId: string, contactId: string) => {
    await updateContactInfoAction(contactId, { is_primary: true });
    setClients((prev) =>
      prev.map((c) => {
        if (c.client_id !== clientId) return c;
        return {
          ...c,
          contact_info: c.contact_info.map((item) => ({
            ...item,
            is_primary: item.contact_id === contactId,
          })),
        };
      })
    );
  }, []);

  const addLog = useCallback(async (clientId: string, input: CreateClientLogInput) => {
    const created = await createClientLogAction(clientId, input);
    setClients((prev) =>
      prev.map((c) => {
        if (c.client_id !== clientId) return c;
        return {
          ...c,
          latest_activity: {
            description: created.description,
            time: created.time,
            performer_name: 'You',
          },
        };
      })
    );
    return created;
  }, []);

  /**
   * Documents live on the detail view rather than the list row, so these do not
   * touch `clients` state. The modal owns the loaded document list and updates
   * it from what these return.
   */
  const uploadDocument = useCallback(async (clientId: string, formData: FormData) => {
    return await uploadClientDocumentAction(clientId, formData);
  }, []);

  const deleteDocument = useCallback(async (documentId: string) => {
    await deleteClientDocumentAction(documentId);
  }, []);

  const getDocumentUrl = useCallback(async (documentId: string) => {
    return await getClientDocumentUrlAction(documentId);
  }, []);

  return createElement(
    ClientsContext.Provider,
    {
      value: {
        clients,
        visibleClients,
        isLoading,
        error,
        search,
        setSearch,
        statusFilter,
        setStatusFilter,
        activeDialog,
        openDialog,
        closeDialog,
        createClient,
        updateClient,
        deleteClient,
        archiveClient,
        restoreClient,
        getClientDetails,
        addContact,
        deleteContact,
        setPrimaryContact,
        addLog,
        uploadDocument,
        deleteDocument,
        getDocumentUrl,
        refreshClients,
      },
    },
    children
  );
}
