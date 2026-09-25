'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LandPlot, UserPlus, UserMinus, Loader2, X } from 'lucide-react';
import { useClients } from '@/lib/hooks/use-clients-page';
import { toast } from 'sonner';
import type { ClientListItem, ClientWithDetails } from '@/lib/types/client';
import type { PropertyLot, PropertyLotWithClient } from '@/lib/types/property';

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const AREA = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 });

export function ClientProfileProperties({
  client,
  details,
  onDetailsChange,
}: {
  client: ClientListItem;
  details: ClientWithDetails;
  onDetailsChange: (updater: (prev: ClientWithDetails) => ClientWithDetails) => void;
}) {
  const { listUnassignedLots, assignLot, unassignLot } = useClients();

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [availableLots, setAvailableLots] = useState<PropertyLotWithClient[]>([]);
  const [isLoadingLots, setIsLoadingLots] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);

  const lots = details.properties ?? [];

  // Fetched only when the picker is opened: most visits never assign a lot.
  useEffect(() => {
    if (!isAssignOpen || availableLots.length > 0) return;
    setIsLoadingLots(true);
    listUnassignedLots()
      .then(setAvailableLots)
      .catch(() => setAvailableLots([]))
      .finally(() => setIsLoadingLots(false));
  }, [isAssignOpen, availableLots.length, listUnassignedLots]);

  async function handleAssign() {
    if (!selectedLotId) return;
    setIsAssigning(true);
    try {
      const assigned = await assignLot(selectedLotId, client.client_id);
      onDetailsChange((prev) => ({
        ...prev,
        properties: [...(prev.properties ?? []), assigned],
      }));
      setAvailableLots((prev) => prev.filter((lot) => lot.property_id !== selectedLotId));
      setSelectedLotId('');
      setIsAssignOpen(false);
      toast.success(`Block ${assigned.block_number} Lot ${assigned.lot_number} assigned`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign lot');
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleUnassign(lot: PropertyLot) {
    setUnassigningId(lot.property_id);
    try {
      await unassignLot(lot.property_id);
      onDetailsChange((prev) => ({
        ...prev,
        properties: (prev.properties ?? []).filter(
          (p) => p.property_id !== lot.property_id,
        ),
      }));
      // Back on the market, so it belongs in the picker again.
      setAvailableLots((prev) => [{ ...lot, status: 'Open', client: null }, ...prev]);
      toast.success(`Block ${lot.block_number} Lot ${lot.lot_number} unassigned`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unassign lot');
    } finally {
      setUnassigningId(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Property lots</h3>
          <Badge variant="secondary">{lots.length}</Badge>
        </div>
        <Button
          type="button"
          size="sm"
          variant={isAssignOpen ? 'ghost' : 'outline'}
          onClick={() => setIsAssignOpen((open) => !open)}
          className="h-8 gap-1.5 text-xs"
        >
          {isAssignOpen ? <X className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
          {isAssignOpen ? 'Cancel' : 'Assign lot'}
        </Button>
      </div>

      {isAssignOpen && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-row-hover p-3 sm:flex-row">
          <Select
            value={selectedLotId}
            onValueChange={setSelectedLotId}
            disabled={isLoadingLots || availableLots.length === 0}
          >
            <SelectTrigger className="h-9 flex-1">
              <SelectValue
                placeholder={
                  isLoadingLots
                    ? 'Loading lots…'
                    : availableLots.length === 0
                      ? 'No unassigned lots available'
                      : 'Select an unassigned lot'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {availableLots.map((lot) => (
                <SelectItem key={lot.property_id} value={lot.property_id}>
                  Block {lot.block_number} Lot {lot.lot_number} · {lot.location}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            disabled={isAssigning || !selectedLotId}
            onClick={() => void handleAssign()}
            className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
          >
            {isAssigning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
            Assign
          </Button>
        </div>
      )}

      {lots.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          No lots assigned to this client.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {lots.map((lot) => (
            <li
              key={lot.property_id}
              className="flex items-center gap-3 p-2.5 transition-colors hover:bg-row-hover"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-row-hover ring-1 ring-inset ring-border">
                <LandPlot className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  Block {lot.block_number} Lot {lot.lot_number}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {lot.location} · {AREA.format(lot.area_size)} sqm ·{' '}
                  {PESO.format(lot.area_size * lot.price_per_sqm)}
                </p>
              </div>

              <Badge variant="secondary" className="shrink-0 text-xs">
                {lot.status}
              </Badge>

              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Unassign Block ${lot.block_number} Lot ${lot.lot_number}`}
                title="Unassign lot"
                disabled={unassigningId === lot.property_id}
                onClick={() => void handleUnassign(lot)}
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              >
                {unassigningId === lot.property_id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserMinus className="h-3.5 w-3.5" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
