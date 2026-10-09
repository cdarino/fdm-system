'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  FilterToolbar,
  ListShowMoreButton,
} from '@/components/ui/filter-toolbar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  X,
  LandPlot,
  SearchX,
  PanelLeftClose,
  LayoutList,
  LayoutGrid,
  Table2,
  User,
} from 'lucide-react';
import { CreatePropertyLotModal } from './property-lot-create-modal';
import { PropertyLotDetailView } from './property-lot-detail-view';
import { PropertyRowsSkeleton } from '@/components/dashboard-layout/page-skeletons';
import {
  PropertyLotsProvider,
  usePropertyLots,
  lotLabel,
  totalPrice,
} from '@/lib/hooks/use-property-lots';
import type { PropertyLotWithClient, PropertyStatus, Site } from '@/lib/types/property';
import { PROPERTY_STATUS_VARIANT } from '@/lib/status-colors';
import { Badge } from '@/components/ui/badge';
import { IconBox } from '@/components/ui/icon-box';
import { cn } from '@/lib/utils';

const DIALOG_EXIT_MS = 200;

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const AREA = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 });

const STATUS_AVATAR: Record<PropertyStatus, { border: string; bg: string; text: string }> = {
  Open: {
    border: 'border-success',
    bg: 'bg-[color-mix(in_srgb,var(--success)_12%,white)]',
    text: 'text-success',
  },
  Reserved: {
    border: 'border-primary',
    bg: 'bg-sidebar-accent',
    text: 'text-accent-blue-foreground',
  },
  Sold: {
    border: 'border-row-accent',
    bg: 'bg-row-active',
    text: 'text-accent-gold-foreground',
  },
  Forfeited: {
    border: 'border-destructive',
    bg: 'bg-[color-mix(in_srgb,var(--destructive)_10%,white)]',
    text: 'text-destructive',
  },
};

const STATUS_TEXT: Record<PropertyStatus, string> = {
  Open: 'text-success',
  Reserved: 'text-accent-blue-foreground',
  Sold: 'text-accent-gold-foreground',
  Forfeited: 'text-destructive',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function StatusPill({ status }: { status: PropertyStatus }) {
  return (
    <Badge variant={PROPERTY_STATUS_VARIANT[status]} shape="pill" dot>
      {status}
    </Badge>
  );
}

function AvatarPlaceholder({ lot }: { lot: PropertyLotWithClient }) {
  const style = STATUS_AVATAR[lot.status];
  const initials = lot.client ? getInitials(lot.client.full_name) : null;

  return (
    <div
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 text-[10px] font-semibold tracking-tight',
        style.border,
        style.bg,
        style.text
      )}
      aria-label={lot.client ? `Client initials for ${lot.client.full_name}` : 'Unassigned client'}
    >
      {initials ? (
        <span>{initials}</span>
      ) : (
        <User className="h-3.5 w-3.5 opacity-70" />
      )}
    </div>
  );
}

function LotRowItem({
  lot,
  onSelect,
  onHover,
}: {
  lot: PropertyLotWithClient;
  onSelect?: () => void;
  onHover?: (hovering: boolean) => void;
}) {
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className="group flex flex-col gap-1.5 px-4 py-2.5 transition-colors hover:bg-row-hover cursor-pointer"
    >
      {/* Top row: Left identity, Right client & status */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Plot Icon + Lot & Location */}
        <div className="flex min-w-0 items-center gap-2.5">
          <IconBox size="sm" shape="square">
            <LandPlot className="h-3.5 w-3.5" />
          </IconBox>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">{lotLabel(lot)}</p>
            <p className="truncate text-xs text-muted-foreground">{lot.location}</p>
          </div>
        </div>

        {/* Right: Client name & Status + Avatar */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <p
              className={cn(
                'max-w-[150px] truncate text-sm leading-tight',
                lot.client ? 'font-medium text-foreground' : 'font-normal text-muted-foreground'
              )}
            >
              {lot.client ? lot.client.full_name : 'Unassigned'}
            </p>
            <p className={cn('text-xs font-medium', STATUS_TEXT[lot.status])}>
              {lot.status}
            </p>
          </div>
          <AvatarPlaceholder lot={lot} />
        </div>
      </div>

      {/* Bottom row: Pricing & Area */}
      <div className="flex items-center justify-between pt-0.5 text-xs text-muted-foreground">
        <div>
          <span className="font-semibold text-foreground">{PESO.format(totalPrice(lot))}</span>
          <span className="ml-1 text-[11px]">({PESO.format(lot.price_per_sqm)}/sqm)</span>
        </div>
        <span className="font-medium">{AREA.format(lot.area_size)} sqm</span>
      </div>
    </div>
  );
}

function EmptyState({
  controller,
  onCreate,
}: {
  controller: { isFiltered: boolean; clearAll: () => void };
  onCreate: () => void;
}) {
  const Icon = controller.isFiltered ? SearchX : LandPlot;
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-row-hover">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {controller.isFiltered ? 'No matching lots' : 'No property lots yet'}
        </p>
        <p className="max-w-xs text-xs text-muted-foreground">
          {controller.isFiltered
            ? 'Try a different search term or clear the filter.'
            : 'Add the first lot to start tracking lot availability.'}
        </p>
      </div>
      {controller.isFiltered ? (
        <Button
          variant="outline"
          size="sm"
          onClick={controller.clearAll}
          className="gap-1.5 border-border bg-card text-xs text-foreground hover:bg-row-hover hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear filters
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={onCreate}
          className="gap-1.5 bg-primary text-xs text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
        >
          <Plus className="h-3.5 w-3.5" />
          New Lot
        </Button>
      )}
    </div>
  );
}

export interface PropertyLotsSidebarProps {
  sites: Site[];
  onClose: () => void;
  selectedLot?: PropertyLotWithClient | null;
  onSelectLot?: (lot: PropertyLotWithClient | null) => void;
  onHoverLot?: (lotKey: string | null) => void;
  onSiteFilterChange?: (siteId: string | null) => void;
  createInitialValues?: {
    site_id?: string;
    block_number?: number;
    lot_number?: number;
    area_size?: number;
    price_per_sqm?: number;
  } | null;
  onClearCreateInitialValues?: () => void;
}

function PropertyLotsSidebarContent({
  sites,
  onClose,
  selectedLot,
  onSelectLot,
  onHoverLot,
  createInitialValues,
  onClearCreateInitialValues,
}: PropertyLotsSidebarProps) {
  const {
    lots,
    controller,
    isLoading,
    error,
    activeDialog,
    openDialog,
    closeDialog,
  } = usePropertyLots();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [renderedDialog, setRenderedDialog] = useState(activeDialog);
  const wasDialogOpenedRef = useRef(false);

  const activeSelectedLot = useMemo(() => {
    if (!selectedLot) return null;
    return (
      lots.find(
        (l) =>
          (selectedLot.property_id && l.property_id === selectedLot.property_id) ||
          (selectedLot.site_id &&
            l.site_id === selectedLot.site_id &&
            l.block_number === selectedLot.block_number &&
            l.lot_number === selectedLot.lot_number)
      ) ?? selectedLot
    );
  }, [lots, selectedLot]);

  // Close dialog when a lot is selected for inspection
  useEffect(() => {
    if (selectedLot && activeDialog) {
      closeDialog();
    }
  }, [selectedLot, activeDialog, closeDialog]);

  // Open create dialog when initial values are provided from map
  useEffect(() => {
    if (createInitialValues && !selectedLot) {
      wasDialogOpenedRef.current = true;
      openDialog({ type: 'create' });
    }
  }, [createInitialValues, selectedLot, openDialog]);

  // Clear initial values after create dialog dismisses
  useEffect(() => {
    if (wasDialogOpenedRef.current && !activeDialog) {
      wasDialogOpenedRef.current = false;
      onClearCreateInitialValues?.();
    }
  }, [activeDialog, onClearCreateInitialValues]);

  useEffect(() => {
    if (activeDialog) {
      setRenderedDialog(activeDialog);
      return;
    }
    const timer = setTimeout(() => setRenderedDialog(null), DIALOG_EXIT_MS);
    return () => clearTimeout(timer);
  }, [activeDialog]);

  if (activeSelectedLot) {
    return (
      <PropertyLotDetailView
        lot={activeSelectedLot}
        onBack={() => onSelectLot?.(null)}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-card">
      {/* Floating Card Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent text-accent-blue-foreground">
            <LandPlot className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-none text-foreground">Property Lots</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {controller.totalPoolCount} lot{controller.totalPoolCount === 1 ? '' : 's'} total
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => openDialog({ type: 'create' })}
            className="h-8 gap-1.5 bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Lot</span>
          </Button>

          {/* Single icon button for full lot table */}
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-row-hover hover:text-foreground"
            title="Open full lot table page"
            aria-label="Open full lot table page"
          >
            <Link href="/dashboard/properties">
              <Table2 className="h-4 w-4" />
            </Link>
          </Button>

          {/* Collapse button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:bg-row-hover hover:text-foreground"
            title="Collapse panel"
            aria-label="Collapse property lots panel"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <FilterToolbar
        variant="stacked"
        controller={controller}
        sort={false}
        viewMode={{
          value: viewMode,
          onChange: setViewMode,
          options: [
            { value: 'grid', label: 'Grid view', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
            { value: 'list', label: 'List view', icon: <LayoutList className="h-3.5 w-3.5" /> },
          ],
        }}
      />

      {/* List Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div role="alert" className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <p className="text-sm font-medium text-destructive">Could not load property lots</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        ) : isLoading ? (
          <PropertyRowsSkeleton rows={4} />
        ) : controller.matchedItems.length === 0 ? (
          <EmptyState
            controller={controller}
            onCreate={() => openDialog({ type: 'create' })}
          />
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="divide-y divide-border">
                {controller.truncatedItems.map((lot) => (
                  <LotRowItem
                    key={lot.property_id}
                    lot={lot}
                    onSelect={() => onSelectLot?.(lot)}
                    onHover={(hovering) =>
                      onHoverLot?.(
                        hovering
                          ? (lot.site_id
                              ? `${lot.site_id}:${lot.block_number}-${lot.lot_number}`
                              : `${lot.block_number}-${lot.lot_number}`)
                          : null
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="p-3">
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-card">
                        <TableHead className="h-9 px-3 text-[11px] uppercase">Lot</TableHead>
                        <TableHead className="h-9 px-2 text-[11px] uppercase">Area</TableHead>
                        <TableHead className="h-9 px-2 text-[11px] uppercase">Price</TableHead>
                        <TableHead className="h-9 px-3 text-[11px] uppercase">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {controller.truncatedItems.map((lot) => (
                        <TableRow
                          key={lot.property_id}
                          onClick={() => onSelectLot?.(lot)}
                          onMouseEnter={() =>
                            onHoverLot?.(
                              lot.site_id
                                ? `${lot.site_id}:${lot.block_number}-${lot.lot_number}`
                                : `${lot.block_number}-${lot.lot_number}`
                            )
                          }
                          onMouseLeave={() => onHoverLot?.(null)}
                          className="text-xs cursor-pointer hover:bg-row-hover"
                        >
                          <TableCell className="py-2.5 px-3 font-medium">{lotLabel(lot)}</TableCell>
                          <TableCell className="py-2.5 px-2 whitespace-nowrap text-muted-foreground">
                            {AREA.format(lot.area_size)} sqm
                          </TableCell>
                          <TableCell className="py-2.5 px-2 whitespace-nowrap">
                            {PESO.format(totalPrice(lot))}
                          </TableCell>
                          <TableCell className="py-2.5 px-3">
                            <StatusPill status={lot.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <ListShowMoreButton controller={controller} />
          </>
        )}
      </div>

      {/* Footer */}
      {!error && (
        <div className="flex shrink-0 items-center justify-between border-t border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            {isLoading
              ? 'Loading…'
              : controller.isFiltered || controller.truncatedItems.length < controller.matchedItems.length
                ? `Showing ${controller.truncatedItems.length} of ${controller.matchedItems.length} (${controller.totalPoolCount} total)`
                : `${controller.totalPoolCount} lot${controller.totalPoolCount === 1 ? '' : 's'} total`}
          </span>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs text-primary hover:bg-row-hover hover:text-primary"
          >
            <Link href="/dashboard/properties">
              <span>Full table</span>
              <Table2 className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}

      {/* Dialog for creating lots */}
      {renderedDialog?.type === 'create' && (
        <CreatePropertyLotModal
          open={activeDialog !== null}
          sites={sites}
          initialValues={createInitialValues ?? undefined}
        />
      )}
    </div>
  );
}

export function PropertyLotsSidebar(props: PropertyLotsSidebarProps) {
  return (
    <PropertyLotsProvider
      sites={props.sites}
      truncationMode="cap"
      onSiteFilterChange={props.onSiteFilterChange}
    >
      <PropertyLotsSidebarContent {...props} />
    </PropertyLotsProvider>
  );
}
