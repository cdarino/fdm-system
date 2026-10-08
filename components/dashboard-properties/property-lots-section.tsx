'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardTableFooter } from '@/components/ui/card';
import { FilterToolbar } from '@/components/ui/filter-toolbar';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import Link from 'next/link';
import {
  Plus,
  X,
  LandPlot,
  SearchX,
  Map,
  MoreHorizontal,
  FileDown,
} from 'lucide-react';
import { getPropertyReportData } from '@/lib/actions/reports';
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
import { toast } from 'sonner';
import { CreatePropertyLotModal } from './property-lot-create-modal';
import { AssignLotClientDialog } from './property-lot-assign-dialog';
import { PropertyRowsSkeleton } from '@/components/dashboard-layout/page-skeletons';
import {
  PropertyLotsProvider,
  usePropertyLots,
  lotLabel,
  totalPrice,
  type StatusFilter,
  type LotSortKey,
} from '@/lib/hooks/use-property-lots';
import type { PropertyLotWithClient, PropertyStatus, Site } from '@/lib/types/property';
import { STATUSES, PROPERTY_STATUS_VARIANT } from '@/lib/status-colors';
import { Badge } from '@/components/ui/badge';
import { IconBox } from '@/components/ui/icon-box';

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
  return (
    <Badge variant={PROPERTY_STATUS_VARIANT[status]} shape="pill" dot>
      {status}
    </Badge>
  );
}

async function handleExportLotPdf(lot: PropertyLotWithClient) {
  try {
    const data = await getPropertyReportData(lot.property_id);
    // Loaded on demand so jsPDF stays out of the page bundle.
    const { generatePropertyPdfReport } = await import('@/lib/reports/pdf-property-report');
    generatePropertyPdfReport(data);
    toast.success('Property PDF report generated');
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to generate property report');
  }
}

function LotRow({ lot }: { lot: PropertyLotWithClient }) {
  return (
    <TableRow className="transition-colors duration-150 hover:bg-row-hover">
      <TableCell className={`py-4 pr-3 ${GUTTER_L}`}>
        <div className="flex items-center gap-3">
          <IconBox size="md" shape="square">
            <LandPlot className="h-4 w-4 text-muted-foreground" />
          </IconBox>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{lotLabel(lot)}</p>
            <p className="truncate text-xs text-muted-foreground">{lot.location}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground md:hidden">
              {AREA.format(lot.area_size)} sqm
              <span aria-hidden="true"> · </span>
              {lot.client?.full_name ?? 'Unassigned'}
            </p>
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
      <TableCell className="py-4 px-3">
        <StatusPill status={lot.status} />
      </TableCell>
      <TableCell className={`py-4 pl-3 ${GUTTER_R} text-right`} onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-70 hover:opacity-100"
              aria-label={`Actions for lot ${lotLabel(lot)}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Actions
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              icon={<FileDown className="h-4 w-4" />}
              onSelect={() => handleExportLotPdf(lot)}
            >
              Export PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
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
        <Button variant="quiet" onClick={onClear} className="gap-1.5">
          <X className="h-3.5 w-3.5" />
          Clear filters
        </Button>
      ) : (
        <Button onClick={onCreate} className="gap-2">
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
    sort,
    toggleSort,
    sites,
  } = usePropertyLots();

  const directionOf = (key: LotSortKey) => (sort?.key === key ? sort.direction : null);

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
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              asChild
              variant="quiet"
              className="gap-2"
            >
              <Link href="/dashboard/properties/map">
                <Map className="h-4 w-4" />
                Site map
              </Link>
            </Button>
            <Button
              onClick={() => openDialog({ type: 'create' })}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Lot
            </Button>
          </div>
        </div>

        <FilterToolbar
          tabs={{
            value: statusFilter,
            onChange: setStatusFilter,
            ariaLabel: 'Filter by status',
            items: [
              { value: 'all', label: 'All', count: counts.all },
              ...STATUSES.map((status) => ({
                value: status,
                label: status,
                count: counts[status],
              })),
            ],
          }}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search location, block or lot',
            ariaLabel: 'Search property lots',
          }}
          isFiltered={isFiltered}
          onClear={clearFilters}
        />

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
          {error ? (
            <div role="alert" className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
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
                  <SortableTableHead
                    direction={directionOf('lot')}
                    onSort={() => toggleSort('lot')}
                    className={`h-11 pr-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${GUTTER_L}`}
                  >
                    Lot
                  </SortableTableHead>
                  <SortableTableHead
                    direction={directionOf('area')}
                    onSort={() => toggleSort('area')}
                    className="hidden h-11 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell"
                  >
                    Area
                  </SortableTableHead>
                  <SortableTableHead
                    direction={directionOf('price')}
                    onSort={() => toggleSort('price')}
                    className="hidden h-11 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell"
                  >
                    Contract Price
                  </SortableTableHead>
                  <SortableTableHead
                    direction={directionOf('client')}
                    onSort={() => toggleSort('client')}
                    className="hidden h-11 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell"
                  >
                    Client
                  </SortableTableHead>
                  <SortableTableHead
                    direction={directionOf('status')}
                    onSort={() => toggleSort('status')}
                    className="h-11 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Status
                  </SortableTableHead>
                  <TableHead className={`h-11 pl-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground ${GUTTER_R}`}>
                    Actions
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
          <CardTableFooter>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {isLoading
                ? 'Loading property lots…'
                : isFiltered
                  ? `Showing ${visibleLots.length} of ${lots.length} lot${lots.length === 1 ? '' : 's'}`
                  : `${lots.length} lot${lots.length === 1 ? '' : 's'}`}
            </p>
          </CardTableFooter>
        )}
      </Card>

      {renderedDialog?.type === 'create' && <CreatePropertyLotModal open={activeDialog !== null} sites={sites} />}
      {renderedDialog?.type === 'assign' && (
        <AssignLotClientDialog lot={renderedDialog.lot} open={activeDialog !== null} />
      )}
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
