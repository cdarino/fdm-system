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
  forfeitPropertyLot,
  reopenPropertyLotForSale,
} from '@/lib/actions/properties';
import type { ActionResult } from '@/lib/actions/action-result';
import type {
  PropertyLot,
  PropertyLotWithClient,
  PropertyStatus,
  CreatePropertyLotInput,
  UpdatePropertyLotInput,
  ProjectArea,
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
  projectAreaId: string | null;
  showArchived: boolean;
};

/** Prefill carried by a `create` dialog opened from the map, so the values survive until the modal reads them. */
export type CreateLotPrefill = {
  project_area_id?: string;
  block_number?: number;
  lot_number?: number;
  area_size?: number;
  price_per_sqm?: number;
  title_number?: string;
};

export type PropertyDialog =
  | { type: 'create'; prefill?: CreateLotPrefill }
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
  forfeitLot: (propertyId: string, reason?: string) => Promise<ActionResult<PropertyLotWithClient>>;
  reopenLot: (propertyId: string, allowEarlyReopen?: boolean) => Promise<ActionResult<PropertyLotWithClient>>;
  projectAreas: ProjectArea[];
  isSystemAdmin: boolean;
}

const PropertyLotsContext = createContext<PropertyLotsContextValue | null>(null);

export function usePropertyLots() {
  const ctx = useContext(PropertyLotsContext);
  if (!ctx) throw new Error('usePropertyLots must be used within PropertyLotsProvider');
  return ctx;
}

export function useOptionalPropertyLots() {
  return useContext(PropertyLotsContext);
}

/** Lot identity as staff say it out loud: "Block 3 Lot 12". */
export function lotLabel(lot: PropertyLotWithClient): string {
  return `Block ${lot.block_number} Lot ${lot.lot_number}`;
}

export function totalPrice(lot: PropertyLotWithClient): number {
  return lot.area_size * lot.price_per_sqm;
}

function matchesProjectArea(lot: PropertyLotWithClient, projectAreaId: string | null, projectAreas: ProjectArea[]): boolean {
  if (!projectAreaId) return true;
  if (lot.project_area_id === projectAreaId) return true;
  const targetProjectArea = projectAreas.find((s) => s.project_area_id === projectAreaId);
  return Boolean(targetProjectArea && lot.location === targetProjectArea.name);
}

export function PropertyLotsProvider({
  children,
  projectAreas,
  truncationMode = 'paged',
  onProjectAreaFilterChange,
}: {
  children: ReactNode;
  projectAreas: ProjectArea[];
  truncationMode?: 'paged' | 'cap';
  onProjectAreaFilterChange?: (projectAreaId: string | null) => void;
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
        lot.title_number,
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
      projectAreaId: {
        defaultValue: null,
        urlParam: 'projectArea',
        parseUrlParam: (raw) => raw || null,
        onChange: onProjectAreaFilterChange,
        predicate: (lot, projectAreaId) => matchesProjectArea(lot, projectAreaId, projectAreas),
        ui: {
          variant: 'single-select',
          id: 'projectArea',
          label: 'Project Area',
          allLabel: 'All project areas',
          hidden: projectAreas.length === 0,
          options: projectAreas
            .filter((s) => !s.is_archived)
            .map((s) => ({
              value: s.project_area_id,
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

  // Re-sync lots whenever server-fetched projectAreas refresh (e.g. after router.refresh()).
  useEffect(() => {
    let isCancelled = false;
    getPropertyLots({ limit: 200, sortBy: 'created_at', sortOrder: 'desc' })
      .then((result) => {
        if (!isCancelled) {
          setLots(result.data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load property lots');
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [projectAreas]);

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

  const forfeitLot = useCallback(
    async (propertyId: string, reason?: string): Promise<ActionResult<PropertyLotWithClient>> => {
      const result = await forfeitPropertyLot({ propertyId, reason });
      if (!result.success) return result;
      const updated = result.data;
      setLots((prev) =>
        prev.some((lot) => lot.property_id === propertyId)
          ? prev.map((lot) => (lot.property_id === propertyId ? updated : lot))
          : [updated, ...prev]
      );
      router.refresh();
      return result;
    },
    [router]
  );

  const reopenLot = useCallback(
    async (propertyId: string, allowEarlyReopen?: boolean): Promise<ActionResult<PropertyLotWithClient>> => {
      const result = await reopenPropertyLotForSale({ propertyId, allowEarlyReopen });
      if (!result.success) return result;
      const updated = result.data;
      setLots((prev) =>
        prev.some((lot) => lot.property_id === propertyId)
          ? prev.map((lot) => (lot.property_id === propertyId ? updated : lot))
          : [updated, ...prev]
      );
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
    forfeitLot,
    reopenLot,
    projectAreas,
    isSystemAdmin,
  };

  return createElement(PropertyLotsContext.Provider, { value }, children);
}
