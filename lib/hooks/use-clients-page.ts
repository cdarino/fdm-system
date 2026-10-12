'use client';
import { notifyActivityUpdated } from '@/lib/activity-events';

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import {
  useListController,
  type ListControllerValue,
} from '@/lib/hooks/use-list-controller';
import { getClientRequirements } from '@/lib/utils/client-requirements';
import {
  createClient as createClientAction,
  updateClient as updateClientAction,
  deleteClient as deleteClientAction,
  archiveClient as archiveClientAction,
  unarchiveClient as unarchiveClientAction,
  getClientDocumentUrl as getClientDocumentUrlAction,
  getClientsWithMissingDocuments,
} from '@/lib/actions/clients';
import {
  searchDocumentText,
  getEntityIndex,
} from '@/lib/actions/search-index';
import type { DocumentSearchHit } from '@/lib/types/search';
import type { ActionResult } from '@/lib/actions/action-result';
import { useSession } from '@/lib/hooks/use-session';
import type {
  ClientListItem,
  ClientDocumentNotification,
  CreateClientInput,
  UpdateClientInput,
} from '@/lib/types/client';

export type ClientStatusFilter = 'all-records' | 'all' | 'Active' | 'Inactive' | 'Archived';
export type ClientSortKey = 'full_name' | 'created_at' | 'latest_activity';

export const CLIENT_STATUS_FILTERS: readonly ClientStatusFilter[] = [
  'all',
  'all-records',
  'Active',
  'Inactive',
  'Archived',
];

/** Status that takes a client out of the working list. Set by `archiveClient`. */
export const ARCHIVED_STATUS = 'Archived';

export type ClientFilters = {
  status: ClientStatusFilter;
  incompleteOnly: boolean;
};

export type ClientDialog =
  | { type: 'create' }
  | { type: 'edit'; client: ClientListItem }
  | { type: 'delete'; client: ClientListItem }
  | { type: 'archive'; client: ClientListItem }
  | null;

interface ClientsContextValue {
  controller: ListControllerValue<ClientListItem, ClientFilters, ClientSortKey>;
  activeDialog: ClientDialog;
  openDialog: (dialog: ClientDialog) => void;
  closeDialog: () => void;
  createClient: (input: CreateClientInput) => Promise<ActionResult<ClientListItem>>;
  updateClient: (clientId: string, input: UpdateClientInput) => Promise<ActionResult<ClientListItem>>;
  deleteClient: (clientId: string) => Promise<ActionResult<void>>;
  archiveClient: (clientId: string) => Promise<ActionResult<ClientListItem>>;
  restoreClient: (clientId: string) => Promise<ActionResult<ClientListItem>>;
  getDocumentUrl: (documentId: string) => Promise<string>;
  searchDocuments: (query: string) => Promise<DocumentSearchHit[]>;
  getDocumentText: (documentId: string) => Promise<string | null>;
  /** Clients whose required paperwork is incomplete. */
  missingDocumentAlerts: ClientDocumentNotification[];
  isSystemAdmin: boolean;
}

const ClientsContext = createContext<ClientsContextValue | null>(null);

export function useClients() {
  const ctx = useContext(ClientsContext);
  if (!ctx) throw new Error('useClients must be used within ClientsProvider');
  return ctx;
}

function isClientIncomplete(
  client: ClientListItem,
  missingDocClientIds: ReadonlySet<string>
): boolean {
  const requirements = getClientRequirements(client, []);
  return !requirements.profileComplete || missingDocClientIds.has(client.client_id);
}

export function ClientsProvider({
  children,
  initialClients = [],
}: {
  children: ReactNode;
  initialClients?: ClientListItem[];
}) {
  const { isSystemAdmin } = useSession();
  const router = useRouter();
  const requestedClient = useSearchParams().get('client');
  const [clients, setClients] = useState<ClientListItem[]>(initialClients);
  const [activeDialog, setActiveDialog] = useState<ClientDialog>(null);
  const [missingDocumentAlerts, setMissingDocumentAlerts] = useState<ClientDocumentNotification[]>([]);

  const missingDocClientIds = useMemo(
    () =>
      new Set(
        missingDocumentAlerts
          .filter((a) => a.missing_documents.length > 0)
          .map((a) => a.client_id)
      ),
    [missingDocumentAlerts]
  );

  // Preserve existing dashboard links while profiles live on their own page.
  useEffect(() => {
    if (requestedClient) router.replace(`/dashboard/clients/${encodeURIComponent(requestedClient)}`);
  }, [requestedClient, router]);

  const controller = useListController<ClientListItem, ClientFilters, ClientSortKey>({
    items: clients,
    search: {
      fields: (client) => [
        client.full_name,
        client.address,
        client.tin_number,
        ...client.contact_info.map((c) => c.value),
      ],
      placeholder: 'Search name, address, or contact',
      ariaLabel: 'Search clients',
    },
    filters: {
      status: {
        defaultValue: 'all',
        urlParam: 'status',
        parseUrlParam: (raw) =>
          CLIENT_STATUS_FILTERS.find((s) => s === raw),
        predicate: (client, statusFilter) => {
          if (statusFilter === 'all-records') return true;
          const isArchived = client.status === ARCHIVED_STATUS || Boolean(client.is_archived);
          if (statusFilter === 'Archived') return isArchived;
          if (isArchived) return false;
          if (
            statusFilter !== 'all' &&
            client.status.toLowerCase() !== statusFilter.toLowerCase()
          ) {
            return false;
          }
          return true;
        },
        ui: {
          variant: 'tabs',
          ariaLabel: 'Filter clients by status',
          items: [
            { value: 'all', label: 'Current' },
            { value: 'all-records', label: 'All records' },
            { value: 'Active', label: 'Active' },
            { value: 'Inactive', label: 'Inactive' },
            { value: 'Archived', label: 'Archived' },
          ],
        },
      },
      incompleteOnly: {
        defaultValue: false,
        urlParam: 'incomplete',
        predicate: (client, incompleteOnly) =>
          !incompleteOnly || isClientIncomplete(client, missingDocClientIds),
        ui: {
          variant: 'toggle',
          id: 'incomplete-only',
          label: 'Incomplete only',
          icon: createElement(ShieldAlert, { className: 'h-3.5 w-3.5' }),
          countPredicate: (client) => isClientIncomplete(client, missingDocClientIds),
          hidden: true,
        },
      },
    },
    sort: {
      defaultKey: 'full_name',
      defaultOrder: 'asc',
      options: {
        full_name: {
          label: 'Name',
          defaultOrder: 'asc',
          compare: (a, b) =>
            a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' }),
        },
        created_at: {
          label: 'Date Added',
          defaultOrder: 'desc',
          compare: (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        },
        latest_activity: {
          label: 'Latest Activity',
          defaultOrder: 'desc',
          compare: (a, b) => {
            const aTime = a.latest_activity?.time
              ? new Date(a.latest_activity.time).getTime()
              : 0;
            const bTime = b.latest_activity?.time
              ? new Date(b.latest_activity.time).getTime()
              : 0;
            return aTime - bTime;
          },
        },
      },
    },
    truncation: {
      mode: 'paged',
      pageSize: 20,
    },
    poolPredicate: (client, currentFilters) => {
      if (currentFilters.status === 'all-records') return true;
      const isArchived = client.status === ARCHIVED_STATUS || Boolean(client.is_archived);
      if (currentFilters.status === 'Archived') return isArchived;
      return !isArchived;
    },
  });

  const openDialog = useCallback((dialog: ClientDialog) => setActiveDialog(dialog), []);
  const closeDialog = useCallback(() => setActiveDialog(null), []);

  const createClient = useCallback(async (input: CreateClientInput): Promise<ActionResult<ClientListItem>> => {
    const result = await createClientAction(input);
    if (!result.success) {
      return result;
    }
    const created = result.data;
    const newListItem: ClientListItem = {
      ...created,
      contact_info: [],
      latest_activity: null,
    };
    setClients((prev) => [newListItem, ...prev]);
    notifyActivityUpdated();
    router.refresh();
    return { success: true, data: newListItem };
  }, [router]);

  const updateClient = useCallback(async (clientId: string, input: UpdateClientInput): Promise<ActionResult<ClientListItem>> => {
    const result = await updateClientAction(clientId, input);
    if (!result.success) {
      return result;
    }
    const updated = result.data;
    let updatedClientListItem: ClientListItem | undefined;
    setClients((prev) =>
      prev.map((c) => {
        if (c.client_id === clientId) {
          updatedClientListItem = { ...c, ...updated };
          return updatedClientListItem;
        }
        return c;
      })
    );
    notifyActivityUpdated();
    router.refresh();
    return { success: true, data: updatedClientListItem ?? { ...updated, contact_info: [], latest_activity: null } };
  }, [router]);

  const deleteClient = useCallback(async (clientId: string): Promise<ActionResult<void>> => {
    const result = await deleteClientAction(clientId);
    if (!result.success) {
      return result;
    }
    setClients((prev) => prev.filter((c) => c.client_id !== clientId));
    notifyActivityUpdated();
    router.refresh();
    return result;
  }, [router]);

  /**
   * Archive and restore both just move the client's status, so the row stays in
   * state and changes which tab it belongs to. Dropping it from the list
   * instead would leave the Archived tab empty until a refetch.
   */
  const archiveClient = useCallback(async (clientId: string): Promise<ActionResult<ClientListItem>> => {
    const result = await archiveClientAction(clientId);
    if (!result.success) {
      return result;
    }
    const updated = result.data;
    let updatedClientListItem: ClientListItem | undefined;
    setClients((prev) =>
      prev.map((c) => {
        if (c.client_id === clientId) {
          updatedClientListItem = { ...c, ...updated };
          return updatedClientListItem;
        }
        return c;
      })
    );
    notifyActivityUpdated();
    router.refresh();
    return { success: true, data: updatedClientListItem ?? { ...updated, contact_info: [], latest_activity: null } };
  }, [router]);

  const restoreClient = useCallback(async (clientId: string): Promise<ActionResult<ClientListItem>> => {
    const result = await unarchiveClientAction(clientId);
    if (!result.success) {
      return result;
    }
    const updated = result.data;
    let updatedClientListItem: ClientListItem | undefined;
    setClients((prev) =>
      prev.map((c) => {
        if (c.client_id === clientId) {
          updatedClientListItem = { ...c, ...updated };
          return updatedClientListItem;
        }
        return c;
      })
    );
    notifyActivityUpdated();
    router.refresh();
    return { success: true, data: updatedClientListItem ?? { ...updated, contact_info: [], latest_activity: null } };
  }, [router]);

  const getDocumentUrl = useCallback(async (documentId: string) => {
    return await getClientDocumentUrlAction(documentId);
  }, []);

  const searchDocuments = useCallback(async (query: string) => {
    return await searchDocumentText(query);
  }, []);

  /**
   * One query answers both surfaces: the warning marker on each affected client
   * row, and the dialog listing everyone who needs chasing. Checking per row
   * would be a query per client.
   */
  const refreshMissingDocumentAlerts = useCallback(async () => {
    try {
      setMissingDocumentAlerts(await getClientsWithMissingDocuments());
    } catch (err) {
      // A failed check must not take the clients page down with it; the markers
      // simply do not appear.
      console.error('Failed to load missing document alerts:', err);
    }
  }, []);

  useEffect(() => {
    void refreshMissingDocumentAlerts();
  }, [refreshMissingDocumentAlerts]);

  /** The full OCR text, as opposed to the excerpt a search result carries. */
  const getDocumentText = useCallback(async (documentId: string) => {
    const entry = await getEntityIndex('client_document', documentId);
    return entry?.content ?? null;
  }, []);

  return createElement(
    ClientsContext.Provider,
    {
      value: {
        controller,
        activeDialog,
        openDialog,
        closeDialog,
        createClient,
        updateClient,
        deleteClient,
        archiveClient,
        restoreClient,
        getDocumentUrl,
        searchDocuments,
        getDocumentText,
        missingDocumentAlerts,
        isSystemAdmin: Boolean(isSystemAdmin),
      },
    },
    children
  );
}
