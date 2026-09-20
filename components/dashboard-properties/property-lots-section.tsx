'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Plus, Search, X, LandPlot, SearchX, Map, ChevronDown, Check, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useMutation } from '@/lib/hooks/use-mutation';
import { toast } from 'sonner';
import { CreatePropertyLotModal } from './property-lot-create-modal';
import { PropertyRowsSkeleton } from '@/components/dashboard-layout/page-skeletons';
import {
  PropertyLotsProvider,
  usePropertyLots,
  lotLabel,
  totalPrice,
  type StatusFilter,
} from '@/lib/hooks/use-property-lots';
import type { PropertyLotWithClient, PropertyStatus, Site } from '@/lib/types/property';
import { STATUSES, STATUS_PILL } from '@/lib/status-colors';

/** Matches the `duration-200` exit transition on DialogContent. */
const DIALOG_EXIT_MS = 200;

const GUTTER = 'px-4 sm:px-6';
const GUTTER_L = 'pl-4 sm:pl-6';
const GUTTER_R = 'pr-4 sm:pr-6';


const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const AREA = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 });

function StatusPill({ status }: { status: PropertyStatus }) {
  const { pill, dot } = STATUS_PILL[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${pill}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

/**
 * The status pill doubles as the control that changes it.
 *
 * Status is reversible and low-stakes, so there is no confirmation step — the
 * toast is the feedback. A pending change disables the trigger so a second
 * click cannot race the first.
 */
function StatusMenu({ lot }: { lot: PropertyLotWithClient }) {
  const { updateLotStatus } = usePropertyLots();
  const { state, execute } = useMutation(updateLotStatus);
  const isPending = state.status === 'pending';

  useEffect(() => {
    if (state.status === 'error') {
      toast.error(state.error);
    }
  }, [state]);

  async function handleSelect(next: PropertyStatus) {
    if (next === lot.status) return;
    const ok = await execute(lot.property_id, next);
    if (ok) {
      toast.success(`${lotLabel(lot)} marked ${next}`);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isPending}>
        <button
          aria-label={`Change status of ${lotLabel(lot)}, currently ${lot.status}`}
          className="group/status inline-flex items-center gap-1 rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
          onClick={(e) => e.stopPropagation()}
        >
          <StatusPill status={lot.status} />
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover/status:text-foreground" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Set status
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {STATUSES.map((status) => (
          <DropdownMenuItem
            key={status}
            className="justify-between"
            onSelect={(e) => { e.preventDefault(); void handleSelect(status); }}
          >
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${STATUS_PILL[status].dot}`} />
              {status}
            </span>
            {status === lot.status && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LotRow({ lot }: { lot: PropertyLotWithClient }) {
  return (
    <TableRow className="transition-colors duration-150 hover:bg-row-hover">
      <TableCell className={`py-4 pr-3 ${GUTTER_L}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-row-hover ring-1 ring-inset ring-border">
            <LandPlot className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{lotLabel(lot)}</p>
            <p className="truncate text-xs text-muted-foreground">{lot.location}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden px-3 py-4 text-sm text-foreground md:table-cell">
        {AREA.format(lot.area_size)} sqm
      </TableCell>
      <TableCell className="hidden px-3 py-4 lg:table-cell">
        <p className="text-sm text-foreground">{PESO.format(totalPrice(lot))}</p>
        <p className="text-xs text-muted-foreground">{PESO.format(lot.price_per_sqm)}/sqm</p>
      </TableCell>
      <TableCell className="hidden px-3 py-4 text-sm lg:table-cell">
        {lot.client
          ? <span className="text-foreground">{lot.client.full_name}</span>
          : <span className="text-muted-foreground">Unassigned</span>}
      </TableCell>
      <TableCell className={`py-4 pl-3 ${GUTTER_R}`}>
        <StatusMenu lot={lot} />
      </TableCell>
    </TableRow>
  );
}

function StatusTabs({
  value,
  onChange,
  counts,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}) {
  const tabs: StatusFilter[] = ['all', ...STATUSES];
  return (
    <div role="tablist" aria-label="Filter by status" className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-row-hover p-1">
      {tabs.map((tab) => {
        const isActive = value === tab;
        return (
          <button
            key={tab}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'all' ? 'All' : tab}
            <span className="text-xs tabular-nums text-muted-foreground">{counts[tab]}</span>
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ isFiltered, onClear, onCreate }: { isFiltered: boolean; onClear: () => void; onCreate: () => void }) {
  const Icon = isFiltered ? SearchX : LandPlot;
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-row-hover">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">
          {isFiltered ? 'No matching lots' : 'No property lots yet'}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {isFiltered
            ? 'Try a different search term, or clear the filters to see every lot.'
            : 'Add the first lot to start tracking property availability and inventory.'}
        </p>
      </div>
      {isFiltered ? (
        <Button variant="outline" onClick={onClear} className="gap-1.5 border-border bg-card text-foreground hover:bg-row-hover hover:text-foreground">
          <X className="h-3.5 w-3.5" />
          Clear filters
        </Button>
      ) : (
        <Button onClick={onCreate} className="gap-2 bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]">
          <Plus className="h-4 w-4" />
          New Lot
        </Button>
      )}
    </div>
  );
}

function PropertyLotsContent() {
  const {
    lots,
    visibleLots,
    isLoading,
    error,
    activeDialog,
    openDialog,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sites,
  } = usePropertyLots();

  // TODO: could use a refactor; or move it for the hook to manage
  const [renderedDialog, setRenderedDialog] = useState(activeDialog);
  useEffect(() => {
    if (activeDialog) {
      setRenderedDialog(activeDialog);
      return;
    }
    const timer = setTimeout(() => setRenderedDialog(null), DIALOG_EXIT_MS);
    return () => clearTimeout(timer);
  }, [activeDialog]);

  const isFiltered = search.trim() !== '' || statusFilter !== 'all';
  const counts = {
    all: lots.length,
    Open: lots.filter((l) => l.status === 'Open').length,
    Reserved: lots.filter((l) => l.status === 'Reserved').length,
    Sold: lots.filter((l) => l.status === 'Sold').length,
    Forfeited: lots.filter((l) => l.status === 'Forfeited').length,
  } satisfies Record<StatusFilter, number>;

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
  }

  return (
    <>
      <Card variant="section">
        <div className={`flex flex-wrap items-start justify-between gap-4 pb-5 pt-6 ${GUTTER}`}>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold leading-none tracking-tight text-foreground">
              Property Lots
            </h2>
            <p className="text-sm text-muted-foreground">
              Record raw land inventory and keep lot availability accurate.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              variant="outline"
              className="gap-2 border-border bg-card text-foreground hover:bg-row-hover hover:text-foreground"
            >
              <Link href="/dashboard/properties/map">
                <Map className="h-4 w-4" />
                Site map
              </Link>
            </Button>
            <Button
              onClick={() => openDialog({ type: 'create' })}
              className="gap-2 bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
            >
              <Plus className="h-4 w-4" />
              New Lot
            </Button>
          </div>
        </div>

        <div className={`flex flex-col gap-3 pb-5 xl:flex-row xl:items-center xl:justify-between ${GUTTER}`}>
          <StatusTabs value={statusFilter} onChange={setStatusFilter} counts={counts} />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search location, block or lot"
                aria-label="Search property lots"
                className="w-full pl-9 sm:w-72"
              />
            </div>
            {isFiltered && (
              <Button variant="ghost" onClick={clearFilters} className="gap-1.5 text-muted-foreground hover:bg-row-hover hover:text-foreground">
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
          {error ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
              <p className="text-sm font-medium text-destructive">Could not load property lots</p>
              <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            </div>
          ) : isLoading ? (
            <PropertyRowsSkeleton />
          ) : visibleLots.length === 0 ? (
            <EmptyState
              isFiltered={isFiltered}
              onClear={clearFilters}
              onCreate={() => openDialog({ type: 'create' })}
            />
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-card hover:bg-card">
                  <TableHead className={`h-11 pr-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${GUTTER_L}`}>
                    Lot
                  </TableHead>
                  <TableHead className="hidden h-11 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                    Area
                  </TableHead>
                  <TableHead className="hidden h-11 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                    Contract Price
                  </TableHead>
                  <TableHead className="hidden h-11 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                    Client
                  </TableHead>
                  <TableHead className={`h-11 pl-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${GUTTER_R}`}>
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleLots.map((lot) => <LotRow key={lot.property_id} lot={lot} />)}
              </TableBody>
            </Table>
          )}
        </div>

        {!error && (
          <div className={`flex shrink-0 items-center justify-between gap-3 border-t border-border py-3 ${GUTTER}`}>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {isLoading
                ? 'Loading property lots…'
                : isFiltered
                  ? `Showing ${visibleLots.length} of ${lots.length} lot${lots.length === 1 ? '' : 's'}`
                  : `${lots.length} lot${lots.length === 1 ? '' : 's'}`}
            </p>
          </div>
        )}
      </Card>

      {renderedDialog?.type === 'create' && <CreatePropertyLotModal open={activeDialog !== null} sites={sites} />}
    </>
  );
}

export function PropertyLotsSection({ sites }: { sites: Site[] }) {
  return (
    <PropertyLotsProvider sites={sites}>
      <PropertyLotsContent />
    </PropertyLotsProvider>
  );
}
