'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/hooks/use-session';
import { useStatusFilter } from '@/lib/hooks/use-status-filter';
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

export type StatusFilter = 'all' | PropertyStatus;

export type LotSortKey = 'lot' | 'area' | 'price' | 'client' | 'status';
export type SortDirection = 'asc' | 'desc';
/** `null` keeps the server order: newest lots first. */
export type LotSort = { key: LotSortKey; direction: SortDirection } | null;

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
  visibleLots: PropertyLotWithClient[];
  isLoading: boolean;
  error: string | null;
  activeDialog: PropertyDialog;
  search: string;
  setSearch: (query: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (status: StatusFilter) => void;
  sort: LotSort;
  /** Cycles a column through ascending, descending, then back to the default order. */
  toggleSort: (key: LotSortKey) => void;
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

const nameCollator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function compareLots(a: PropertyLotWithClient, b: PropertyLotWithClient, key: LotSortKey): number {
  switch (key) {
    case 'lot':
      return (
        nameCollator.compare(a.location, b.location) ||
        a.block_number - b.block_number ||
        a.lot_number - b.lot_number
      );
    case 'area':
      return a.area_size - b.area_size;
    case 'price':
      return totalPrice(a) - totalPrice(b);
    case 'client':
      return nameCollator.compare(a.client?.full_name ?? '', b.client?.full_name ?? '');
    case 'status':
      return nameCollator.compare(a.status, b.status);
  }
}

function sortLots(lots: PropertyLotWithClient[], sort: LotSort): PropertyLotWithClient[] {
  if (!sort) return lots;

  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...lots].sort((a, b) => {
    // Unassigned lots stay at the bottom whichever way clients are sorted.
    if (sort.key === 'client' && Boolean(a.client) !== Boolean(b.client)) {
      return a.client ? -1 : 1;
    }
    return compareLots(a, b, sort.key) * factor;
  });
}

function matchesSearch(lot: PropertyLotWithClient, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const fields = [
    lot.location,
    lotLabel(lot),
    String(lot.block_number),
    String(lot.lot_number),
    lot.client?.full_name ?? '',
  ].map((field) => field.toLowerCase());

  return words.every((word) => fields.some((field) => field.includes(word)));
}

export function PropertyLotsProvider({
  children,
  sites,
}: {
  children: ReactNode;
  sites: Site[];
}) {
  const { isSystemAdmin } = useSession();
  const router = useRouter();
  const [lots, setLots] = useState<PropertyLotWithClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<PropertyDialog>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useStatusFilter<StatusFilter>(['all', 'Open', 'Reserved', 'Sold', 'Forfeited'], 'all');

  const [sort, setSort] = useState<LotSort>(null);

  const toggleSort = useCallback((key: LotSortKey) => {
    setSort((current) => {
      if (current?.key !== key) return { key, direction: 'asc' };
      return current.direction === 'asc' ? { key, direction: 'desc' } : null;
    });
  }, []);

  const visibleLots = useMemo(() => {
    const filtered = lots.filter((lot) => {
      if (!matchesSearch(lot, search)) return false;
      if (statusFilter !== 'all' && lot.status !== statusFilter) return false;
      return true;
    });
    return sortLots(filtered, sort);
  }, [lots, search, statusFilter, sort]);

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
    visibleLots,
    isLoading,
    error,
    activeDialog,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sort,
    toggleSort,
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
