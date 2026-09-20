'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, UserRound, Check } from 'lucide-react';
import { getClients } from '@/lib/actions/clients';
import { usePropertyLots, lotLabel } from '@/lib/hooks/use-property-lots';
import { useMutation } from '@/lib/hooks/use-mutation';
import { toast } from 'sonner';
import type { ClientListItem } from '@/lib/types/client';
import type { PropertyLotWithClient } from '@/lib/types/property';
import { cn } from '@/lib/utils';

/**
 * Picks the client a lot is sold to.
 *
 * Clients are fetched here rather than held in `usePropertyLots`, because the
 * lots table has no other use for them and loading every client on page load
 * would be wasted work for the common case of never opening this dialog.
 */
export function AssignLotClientDialog({
  lot,
  open,
}: {
  lot: PropertyLotWithClient;
  open: boolean;
}) {
  const { assignClient, closeDialog } = usePropertyLots();
  const { state, execute } = useMutation(assignClient);

  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(lot.client?.client_id ?? null);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setLoadError(null);
    getClients({ limit: 200, sortBy: 'full_name', sortOrder: 'asc' })
      .then((result) => setClients(result.data))
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : 'Failed to load clients')
      )
      .finally(() => setIsLoading(false));
  }, [open]);

  const visibleClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) =>
      [client.full_name, client.tin_number ?? '', client.address ?? ''].some((field) =>
        field.toLowerCase().includes(query)
      )
    );
  }, [clients, search]);

  const isPending = state.status === 'pending';
  const isUnchanged = selectedId === (lot.client?.client_id ?? null);

  async function handleAssign() {
    if (!selectedId) return;
    const ok = await execute(lot.property_id, selectedId);
    if (ok) {
      const name = clients.find((c) => c.client_id === selectedId)?.full_name ?? 'Client';
      toast.success(`${lotLabel(lot)} assigned to ${name}`);
      closeDialog();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign {lotLabel(lot)}</DialogTitle>
          <DialogDescription>
            The lot moves to Reserved and a ledger account is opened for the sale.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, TIN or address"
            aria-label="Search clients"
            className="pl-9"
          />
        </div>

        <div className="max-h-72 min-h-40 overflow-y-auto rounded-lg border border-border">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading clients…
            </div>
          ) : loadError ? (
            <p className="px-4 py-10 text-center text-sm text-destructive">{loadError}</p>
          ) : visibleClients.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {search.trim() ? 'No clients match that search.' : 'No clients yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {visibleClients.map((client) => {
                const isSelected = selectedId === client.client_id;
                return (
                  <li key={client.client_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(client.client_id)}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                        isSelected ? 'bg-row-active' : 'hover:bg-row-hover'
                      )}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-row-hover ring-1 ring-inset ring-border">
                        <UserRound className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {client.full_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {client.tin_number ?? client.address ?? 'No TIN on record'}
                        </p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {state.status === 'error' && (
          <p className="text-xs text-destructive">{state.error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={closeDialog} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleAssign()}
            disabled={isPending || !selectedId || isUnchanged}
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {lot.client ? 'Reassign lot' : 'Assign lot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
