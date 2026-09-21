'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { Search, X, Users, SearchX, UserCheck, UserX } from 'lucide-react';
import { ClientCompactRow } from '@/components/dashboard-clients/client-compact-row';
import { usePropertyLots, lotLabel } from '@/lib/hooks/use-property-lots';
import { useMutation } from '@/lib/hooks/use-mutation';
import { getClients } from '@/lib/actions/clients';
import { toast } from 'sonner';
import type { ClientListItem } from '@/lib/types/client';
import type { PropertyLotWithClient } from '@/lib/types/property';

export interface ClientAssignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lot: PropertyLotWithClient;
  onAssigned?: (updatedLot: PropertyLotWithClient) => void;
}

type StatusFilter = 'all' | 'Active' | 'Inactive';

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

export function ClientAssignModal({
  open,
  onOpenChange,
  lot,
  onAssigned,
}: ClientAssignModalProps) {
  const { assignClient } = usePropertyLots();
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    lot.client?.client_id ?? null
  );

  const { state: assignState, execute: executeAssign } = useMutation(assignClient);

  // Sync selected client and fetch list when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedClientId(lot.client?.client_id ?? null);
      setSearch('');
      setStatusFilter('all');
      setIsLoading(true);
      setFetchError(null);

      getClients({ limit: 100, sortBy: 'full_name', sortOrder: 'asc' })
        .then((res) => setClients(res.data))
        .catch((err) => setFetchError(err instanceof Error ? err.message : 'Failed to load clients'))
        .finally(() => setIsLoading(false));
    }
  }, [open, lot.client?.client_id]);

  const visibleClients = useMemo(() => {
    return clients.filter((c) => {
      if (!matchesSearch(c, search)) return false;
      if (statusFilter !== 'all' && c.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      return true;
    });
  }, [clients, search, statusFilter]);

  const counts = {
    all: clients.length,
    Active: clients.filter((c) => c.status.toLowerCase() === 'active').length,
    Inactive: clients.filter((c) => c.status.toLowerCase() === 'inactive').length,
  };

  const isPending = assignState.status === 'pending';
  const isSelectedSame = selectedClientId === (lot.client?.client_id ?? null);

  async function handleAssign() {
    if (!selectedClientId) return;
    // Transition Open -> Reserved, or preserve existing status
    const targetStatus = lot.status === 'Open' ? 'Reserved' : lot.status;
    const ok = await executeAssign(lot.property_id, selectedClientId, targetStatus);
    if (ok) {
      toast.success(`Client successfully assigned to ${lotLabel(lot)}`);
      onOpenChange(false);
    }
  }

  async function handleUnassign() {
    const ok = await executeAssign(lot.property_id, null, 'Open');
    if (ok) {
      toast.success(`Client removed from ${lotLabel(lot)}`);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent text-accent-blue-foreground">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Assign Client to {lotLabel(lot)}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Select a client record to assign as primary buyer on this property lot.
              </DialogDescription>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="pt-3 flex flex-wrap items-center justify-between gap-2.5">
            <div role="tablist" aria-label="Filter clients by status" className="inline-flex items-center gap-1 rounded-lg bg-row-hover p-0.5">
              {(['all', 'Active', 'Inactive'] as const).map((tab) => {
                const isActive = statusFilter === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setStatusFilter(tab)}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{tab === 'all' ? 'All' : tab}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">({counts[tab]})</span>
                  </button>
                );
              })}
            </div>

            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, address..."
                className="h-8 pl-8 pr-7 text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Client List Content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {fetchError ? (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-xs font-medium text-destructive">{fetchError}</p>
            </div>
          ) : isLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading clients…</div>
          ) : visibleClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
              <SearchX className="h-6 w-6 text-muted-foreground" />
              <p className="text-xs font-medium text-foreground">No matching clients</p>
              <p className="text-[11px] text-muted-foreground">Try a different search term or clear the filter.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="bg-card hover:bg-card">
                  <TableHead className="w-10 pl-4 sm:pl-6">
                    <span className="sr-only">Select</span>
                  </TableHead>
                  <TableHead className="h-8 pr-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Client
                  </TableHead>
                  <TableHead className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Address
                  </TableHead>
                  <TableHead className="h-8 pl-3 pr-4 sm:pr-6 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleClients.map((client) => (
                  <ClientCompactRow
                    key={client.client_id}
                    client={client}
                    selectable
                    selected={selectedClientId === client.client_id}
                    onSelect={() => setSelectedClientId(client.client_id)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Dialog Footer Actions */}
        <DialogFooter className="flex items-center justify-between gap-2 border-t border-border p-3.5 bg-card sm:justify-between">
          <div>
            {lot.client && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={handleUnassign}
                className="gap-1.5 border-destructive/30 text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_10%,white)] hover:text-destructive text-xs h-8"
              >
                <UserX className="h-3.5 w-3.5" />
                Unassign Client
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <LoadingButton
              type="button"
              size="sm"
              isLoading={isPending}
              disabled={!selectedClientId || isSelectedSame || isPending}
              onClick={handleAssign}
              className="gap-1.5 bg-primary text-xs text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)] h-8"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Assign Client
            </LoadingButton>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

