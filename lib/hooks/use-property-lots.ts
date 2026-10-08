'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Archive } from 'lucide-react';
import { useSession } from '@/lib/hooks/use-session';
import {
  useListController,
  type ListControllerValue,
} from '@/lib/hooks/use-list-controller';
import {
  getPropertyLots,
  createPropertyLot,
  updatePropertyLot,
  assignPropertyClient,
  archivePropertyLot,
  unarchivePropertyLot,
  deletePropertyLot,
} from '@/lib/actions/properties';
import type { ActionResult } from '@/lib/actions/action-result';
import type {
  PropertyLot,
  PropertyLotWithClient,
  PropertyStatus,
  CreatePropertyLotInput,
  UpdatePropertyLotInput,
  Site,
} from '@/lib/types/property';
import { STATUSES } from '@/lib/status-colors';

export type StatusFilter = 'all' | PropertyStatus;
export type PropertySortKey = 'block_lot' | 'contract_price' | 'area_size' | 'created_at';

export const PROPERTY_STATUS_FILTERS: readonly StatusFilter[] = [
  'all',
  'Open',
  'Reserved',
  'Sold',
  'Forfeited',
];

export type PropertyFilters = {
  status: StatusFilter;
  siteId: string | null;
  showArchived: boolean;
};

export type PropertyDialog =
  | { type: 'create' }
  | { type: 'assign'; lot: PropertyLotWithClient }
  | null;

/**
 * Sole owner of the property-lot server actions, mirroring `use-admin-users`.
 * Components under `components/dashboard-properties/` consume this instead of importing
 * from `lib/actions/` directly.
 */
interface PropertyLotsContextValue {
  lots: PropertyLotWithClient[];
  controller: ListControllerValue<PropertyLotWithClient, PropertyFilters, PropertySortKey>;
  isLoading: boolean;
  error: string | null;
  activeDialog: PropertyDialog;
  openDialog: (dialog: PropertyDialog) => void;
  closeDialog: () => void;
  createLot: (input: CreatePropertyLotInput) => Promise<ActionResult<PropertyLot>>;
  updateLot: (propertyId: string, input: UpdatePropertyLotInput) => Promise<ActionResult<PropertyLot>>;
  assignClient: (propertyId: string, clientId: string | null, status?: PropertyStatus) => Promise<ActionResult<PropertyLotWithClient>>;
  unassignClient: (propertyId: string) => Promise<ActionResult<PropertyLotWithClient>>;
  archiveLot: (propertyId: string) => Promise<ActionResult<PropertyLot>>;
  unarchiveLot: (propertyId: string) => Promise<ActionResult<PropertyLot>>;
  deleteLot: (propertyId: string) => Promise<ActionResult<void>>;
  sites: Site[];
  isSystemAdmin: boolean;
}

const PropertyLotsContext = createContext<PropertyLotsContextValue | null>(null);

export function usePropertyLots() {
  const ctx = useContext(PropertyLotsContext);
  if (!ctx) throw new Error('usePropertyLots must be used within PropertyLotsProvider');
  return ctx;
}

/** Lot identity as staff say it out loud: "Block 3 Lot 12". */
export function lotLabel(lot: PropertyLotWithClient): string {
  return `Block ${lot.block_number} Lot ${lot.lot_number}`;
}

export function totalPrice(lot: PropertyLotWithClient): number {
  return lot.area_size * lot.price_per_sqm;
}

function matchesSite(lot: PropertyLotWithClient, siteId: string | null, sites: Site[]): boolean {
  if (!siteId) return true;
  if (lot.site_id === siteId) return true;
  const targetSite = sites.find((s) => s.site_id === siteId);
  return Boolean(targetSite && lot.location === targetSite.name);
}

export function PropertyLotsProvider({
  children,
  sites,
  truncationMode = 'paged',
  onSiteFilterChange,
}: {
  children: ReactNode;
  sites: Site[];
  truncationMode?: 'paged' | 'cap';
  onSiteFilterChange?: (siteId: string | null) => void;
}) {
  const { isSystemAdmin } = useSession();
  const router = useRouter();
  const [lots, setLots] = useState<PropertyLotWithClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<PropertyDialog>(null);

  const controller = useListController<PropertyLotWithClient, PropertyFilters, PropertySortKey>({
    items: lots,
    search: {
      fields: (lot) => [
        lot.location,
        lotLabel(lot),
        lot.block_number,
        lot.lot_number,
        lot.client?.full_name,
      ],
      placeholder: 'Search location, block or lot',
      ariaLabel: 'Search property lots',
    },
    filters: {
      status: {
        defaultValue: 'all',
        urlParam: 'status',
        parseUrlParam: (raw) => PROPERTY_STATUS_FILTERS.find((s) => s === raw),
        predicate: (lot, statusFilter) =>
          statusFilter === 'all' || lot.status === statusFilter,
        ui: {
          variant: 'tabs',
          ariaLabel: 'Filter by status',
          sectionLabel: 'Status',
          items: [
            { value: 'all', label: 'All' },
            ...STATUSES.map((status) => ({ value: status, label: status })),
          ],
        },
      },
      siteId: {
        defaultValue: null,
        urlParam: 'site',
        parseUrlParam: (raw) => raw || null,
        onChange: onSiteFilterChange,
        predicate: (lot, siteId) => matchesSite(lot, siteId, sites),
        ui: {
          variant: 'single-select',
          id: 'site',
          label: 'Site',
          allLabel: 'All sites',
          hidden: sites.length === 0,
          options: sites
            .filter((s) => !s.is_archived)
            .map((s) => ({
              value: s.site_id,
              label: s.name,
            })),
        },
      },
      showArchived: {
        defaultValue: false,
        urlParam: 'archived',
        predicate: (lot, showArchived) => (showArchived ? true : !lot.is_archived),
        ui: {
          variant: 'toggle',
          id: 'show-archived',
          label: 'Show archived',
          compactLabel: 'Archived',
          icon: createElement(Archive, { className: 'h-3.5 w-3.5' }),
          countPredicate: (lot) => Boolean(lot.is_archived),
          hidden: true,
        },
      },
    },
    sort: {
      defaultKey: 'created_at',
      defaultOrder: 'desc',
      options: {
        block_lot: {
          label: 'Block & Lot',
          defaultOrder: 'asc',
          compare: (a, b) =>
            a.block_number - b.block_number || a.lot_number - b.lot_number,
        },
        contract_price: {
          label: 'Contract Price',
          defaultOrder: 'desc',
          compare: (a, b) => totalPrice(a) - totalPrice(b),
        },
        area_size: {
          label: 'Area Size',
          defaultOrder: 'desc',
          compare: (a, b) => a.area_size - b.area_size,
        },
        created_at: {
          label: 'Date Added',
          defaultOrder: 'desc',
          compare: (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        },
      },
    },
    truncation: {
      mode: truncationMode,
      pageSize: 20,
      stepSize: 20,
    },
    poolPredicate: (lot, currentFilters) =>
      currentFilters.showArchived ? true : !lot.is_archived,
  });

  useEffect(() => {
    getPropertyLots({ limit: 200, sortBy: 'created_at', sortOrder: 'desc' })
      .then((result) => setLots(result.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load property lots'))
      .finally(() => setIsLoading(false));
  }, []);

  const openDialog = useCallback((dialog: PropertyDialog) => setActiveDialog(dialog), []);
  const closeDialog = useCallback(() => setActiveDialog(null), []);

  const createLot = useCallback(
    async (input: CreatePropertyLotInput): Promise<ActionResult<PropertyLot>> => {
      const result = await createPropertyLot(input);
      if (!result.success) return result;
      const created = result.data;
      setLots((prev) => [{ ...created, client: null }, ...prev]);
      router.refresh();
      return result;
    },
    [router],
  );

  const updateLot = useCallback(
    async (propertyId: string, input: UpdatePropertyLotInput): Promise<ActionResult<PropertyLot>> => {
      const result = await updatePropertyLot(propertyId, input);
      if (!result.success) return result;
      const updated = result.data;
      setLots((prev) =>
        prev.map((lot) => (lot.property_id === propertyId ? { ...lot, ...updated } : lot)),
      );
      router.refresh();
      return result;
    },
    [router],
  );

  const assignClient = useCallback(
    async (propertyId: string, clientId: string | null, status?: PropertyStatus): Promise<ActionResult<PropertyLotWithClient>> => {
      const result = await assignPropertyClient(propertyId, clientId, status);
      if (!result.success) return result;
      const updated = result.data;
      setLots((prev) =>
        prev.map((lot) => (lot.property_id === propertyId ? updated : lot)),
      );
      router.refresh();
      return result;
    },
    [router],
  );

  /**
   * Unassigning cancels the ledger account rather than deleting it, so the
   * payment history of a withdrawn sale survives. The lot returns to Open.
   */
  const unassignClient = useCallback(
    async (propertyId: string): Promise<ActionResult<PropertyLotWithClient>> => {
      const result = await assignPropertyClient(propertyId, null);
      if (!result.success) return result;
      const updated = result.data;
      setLots((prev) => prev.map((lot) => (lot.property_id === propertyId ? updated : lot)));
      router.refresh();
      return result;
    },
    [router],
  );

  const archiveLot = useCallback(
    async (propertyId: string): Promise<ActionResult<PropertyLot>> => {
      const result = await archivePropertyLot(propertyId);
      if (!result.success) return result;
      const updated = result.data;
      setLots((prev) =>
        prev.map((lot) =>
          lot.property_id === propertyId
            ? { ...lot, is_archived: true, archived_at: updated.archived_at }
            : lot
        )
      );
      router.refresh();
      return result;
    },
    [router]
  );

  const unarchiveLot = useCallback(
    async (propertyId: string): Promise<ActionResult<PropertyLot>> => {
      const result = await unarchivePropertyLot(propertyId);
      if (!result.success) return result;
      setLots((prev) =>
        prev.map((lot) =>
          lot.property_id === propertyId
            ? { ...lot, is_archived: false, archived_at: null }
            : lot
        )
      );
      router.refresh();
      return result;
    },
    [router]
  );

  const deleteLot = useCallback(
    async (propertyId: string): Promise<ActionResult<void>> => {
      const result = await deletePropertyLot(propertyId);
      if (!result.success) return result;
      setLots((prev) => prev.filter((lot) => lot.property_id !== propertyId));
      router.refresh();
      return result;
    },
    [router]
  );

  const value: PropertyLotsContextValue = {
    lots,
    controller,
    isLoading,
    error,
    activeDialog,
    openDialog,
    closeDialog,
    createLot,
    updateLot,
    assignClient,
    unassignClient,
    archiveLot,
    unarchiveLot,
    deleteLot,
    sites,
    isSystemAdmin,
  };

  return createElement(PropertyLotsContext.Provider, { value }, children);
}
