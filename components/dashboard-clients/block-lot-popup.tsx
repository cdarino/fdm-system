'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { SiteWithLots, PropertyLotWithClient, SiteSubdivision } from '@/lib/types/property';

export interface SelectedLotDetails {
  siteId: string;
  siteName: string;
  blockNumber: number;
  lotNumber: number;
  areaSize: number;
  pricePerSqm: number;
  totalPrice: number;
  existingPropertyId?: string;
  isRecordOnly: boolean;
  isUnopenedPlot: boolean;
  isManualNew: boolean;
}

export type EvaluatedLotStatus =
  | { type: 'already_assigned'; lot: PropertyLotWithClient }
  | { type: 'open'; lot: PropertyLotWithClient; isRecordOnly: boolean }
  | { type: 'unopened_plot'; subdivision: SiteSubdivision }
  | { type: 'new_record_only' }
  | null;

export function evaluateLotStatus(
  siteData: SiteWithLots | null,
  blockNumber: number,
  lotNumber: number
): EvaluatedLotStatus {
  if (!siteData || isNaN(blockNumber) || blockNumber <= 0 || isNaN(lotNumber) || lotNumber <= 0) {
    return null;
  }

  const existingLot = siteData.lots.find(
    (l) => l.block_number === blockNumber && l.lot_number === lotNumber
  );
  const subdivision = siteData.subdivisions.find(
    (s) => s.block_number === blockNumber && s.lot_number === lotNumber
  );

  if (existingLot) {
    if (existingLot.status === 'Reserved' || existingLot.status === 'Sold') {
      return { type: 'already_assigned', lot: existingLot };
    }
    return {
      type: 'open',
      lot: existingLot,
      isRecordOnly: !Boolean(subdivision || existingLot.boundary),
    };
  }

  if (subdivision) {
    return { type: 'unopened_plot', subdivision };
  }

  return { type: 'new_record_only' };
}

interface GridLotCell {
  blockNumber: number;
  lotNumber: number;
  state: 'open' | 'closed' | 'assigned';
  statusLabel: string;
}

interface BlockLotPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteData: SiteWithLots | null;
  activeBlock: number | null;
  activeLot: number | null;
  onSelectLot: (blockNumber: number, lotNumber: number) => void;
  children: React.ReactNode;
}

export function BlockLotPopup({
  open,
  onOpenChange,
  siteData,
  activeBlock,
  activeLot,
  onSelectLot,
  children,
}: BlockLotPopupProps) {
  const [onlyOpenForSale, setOnlyOpenForSale] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Group all known site lots and subdivision plots by block number
  const groupedBlocks = useMemo(() => {
    if (!siteData) return [];

    const cellMap = new Map<string, GridLotCell>();

    for (const sub of siteData.subdivisions) {
      const key = `${sub.block_number}-${sub.lot_number}`;
      cellMap.set(key, {
        blockNumber: sub.block_number,
        lotNumber: sub.lot_number,
        state: 'closed',
        statusLabel: 'Closed plot',
      });
    }

    for (const lot of siteData.lots) {
      const key = `${lot.block_number}-${lot.lot_number}`;
      const isAssigned = lot.status === 'Reserved' || lot.status === 'Sold';
      cellMap.set(key, {
        blockNumber: lot.block_number,
        lotNumber: lot.lot_number,
        state: isAssigned ? 'assigned' : lot.status === 'Open' ? 'open' : 'closed',
        statusLabel: lot.status,
      });
    }

    const byBlock = new Map<number, GridLotCell[]>();
    for (const cell of cellMap.values()) {
      if (onlyOpenForSale && cell.state !== 'open') continue;
      const list = byBlock.get(cell.blockNumber) ?? [];
      list.push(cell);
      byBlock.set(cell.blockNumber, list);
    }

    return Array.from(byBlock.entries())
      .sort(([a], [b]) => a - b)
      .map(([blockNumber, lots]) => ({
        blockNumber,
        lots: lots.sort((a, b) => a.lotNumber - b.lotNumber),
      }));
  }, [siteData, onlyOpenForSale]);

  // Scroll the active block into view when typing a block number
  useEffect(() => {
    if (!open || !activeBlock) return;
    const node = blockRefs.current[activeBlock];
    if (node) {
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [open, activeBlock]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div ref={anchorRef}>{children}</div>
      </PopoverAnchor>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[22rem] sm:w-[26rem] p-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node)) {
            e.preventDefault();
          }
        }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border bg-row-hover px-3 py-2">
          <span className="text-xs font-semibold text-foreground">
            {siteData ? `${siteData.name} Lots` : 'Site Lots'}
          </span>

          <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Checkbox
              checked={onlyOpenForSale}
              onCheckedChange={(checked) => setOnlyOpenForSale(checked === true)}
              className="h-3.5 w-3.5"
            />
            <span>Open for sale only</span>
          </label>
        </div>

        <div className="max-h-64 overflow-y-auto p-3 space-y-3">
          {groupedBlocks.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {onlyOpenForSale
                ? 'No lots currently marked open for sale on this site.'
                : 'No lots or subdivision plots registered yet. Enter numbers manually.'}
            </p>
          ) : (
            groupedBlocks.map(({ blockNumber, lots }) => {
              const isBlockActive = activeBlock === blockNumber;

              return (
                <div
                  key={blockNumber}
                  ref={(el) => {
                    blockRefs.current[blockNumber] = el;
                  }}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'text-[11px] font-semibold uppercase tracking-wider',
                        isBlockActive ? 'text-primary' : 'text-muted-foreground'
                      )}
                    >
                      Block {blockNumber}
                    </span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {lots.length} {lots.length === 1 ? 'lot' : 'lots'}
                    </span>
                  </div>

                  <div className="grid grid-cols-10 gap-1">
                    {lots.map((item) => {
                      const isAssigned = item.state === 'assigned';
                      const isSelected =
                        activeBlock === item.blockNumber && activeLot === item.lotNumber;

                      return (
                        <button
                          key={item.lotNumber}
                          type="button"
                          disabled={isAssigned}
                          title={`Block ${item.blockNumber} Lot ${item.lotNumber} (${item.statusLabel})`}
                          onClick={() => {
                            onSelectLot(item.blockNumber, item.lotNumber);
                            onOpenChange(false);
                          }}
                          className={cn(
                            'flex h-7 items-center justify-center rounded border text-xs tabular-nums transition-colors',
                            isAssigned &&
                              'cursor-not-allowed border-border bg-muted text-muted-foreground opacity-40',
                            !isAssigned &&
                              !isSelected &&
                              'border-border bg-card text-foreground hover:border-primary hover:bg-row-hover',
                            !isAssigned &&
                              isSelected &&
                              'border-primary bg-sidebar-accent font-semibold text-accent-blue-foreground ring-1 ring-primary'
                          )}
                        >
                          {item.lotNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
