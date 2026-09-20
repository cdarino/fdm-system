'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getPropertyLots, createPropertyLot, updatePropertyLot } from '@/lib/actions/properties';
import type {
  PropertyLotWithClient,
  PropertyStatus,
  CreatePropertyLotInput,
  Site,
} from '@/lib/types/property';

export type StatusFilter = 'all' | PropertyStatus;

export type PropertyDialog = { type: 'create' } | null;

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
  openDialog: (dialog: PropertyDialog) => void;
  closeDialog: () => void;
  createLot: (input: CreatePropertyLotInput) => Promise<void>;
  updateLotStatus: (propertyId: string, status: PropertyStatus) => Promise<void>;
  sites: Site[];
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

export function PropertyLotsProvider({ children, sites }: { children: ReactNode; sites: Site[] }) {
  const router = useRouter();
  const [lots, setLots] = useState<PropertyLotWithClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<PropertyDialog>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const visibleLots = useMemo(() => {
    return lots.filter((lot) => {
      if (!matchesSearch(lot, search)) return false;
      if (statusFilter !== 'all' && lot.status !== statusFilter) return false;
      return true;
    });
  }, [lots, search, statusFilter]);

  useEffect(() => {
    getPropertyLots({ limit: 200, sortBy: 'created_at', sortOrder: 'desc' })
      .then((result) => setLots(result.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load property lots'))
      .finally(() => setIsLoading(false));
  }, []);

  const openDialog = useCallback((dialog: PropertyDialog) => setActiveDialog(dialog), []);
  const closeDialog = useCallback(() => setActiveDialog(null), []);

  const createLot = useCallback(
    async (input: CreatePropertyLotInput): Promise<void> => {
      const created = await createPropertyLot(input);
      setLots((prev) => [{ ...created, client: null }, ...prev]);
      router.refresh();
    },
    [router],
  );

  const updateLotStatus = useCallback(
    async (propertyId: string, status: PropertyStatus): Promise<void> => {
      const updated = await updatePropertyLot(propertyId, { status });
      setLots((prev) =>
        prev.map((lot) => (lot.property_id === propertyId ? { ...lot, ...updated } : lot)),
      );
      router.refresh();
    },
    [router],
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
    openDialog,
    closeDialog,
    createLot,
    updateLotStatus,
    sites,
  };

  return createElement(PropertyLotsContext.Provider, { value }, children);
}
