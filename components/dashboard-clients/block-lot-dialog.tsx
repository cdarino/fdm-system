'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Ban,
  Info,
  LandPlot,
} from 'lucide-react';
import { computeSubdivisionAreaSqm } from '@/lib/geometry';
import type { SiteWithLots, PropertyLotWithClient, SiteSubdivision } from '@/lib/types/property';

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

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

interface BlockLotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteData: SiteWithLots | null;
  selectedLot: SelectedLotDetails | null;
  onSelectLot: (details: SelectedLotDetails) => void;
}

type EvaluatedStatus =
  | { type: 'already_assigned'; lot: PropertyLotWithClient }
  | { type: 'open'; lot: PropertyLotWithClient; isRecordOnly: boolean }
  | { type: 'unopened_plot'; subdivision: SiteSubdivision; computedArea: number }
  | { type: 'new_record_only' }
  | null;

export function BlockLotDialog({
  open,
  onOpenChange,
  siteData,
  selectedLot,
  onSelectLot,
}: BlockLotDialogProps) {
  // Manual input fields
  const [blockInput, setBlockInput] = useState<string>('');
  const [lotInput, setLotInput] = useState<string>('');
  const [areaInput, setAreaInput] = useState<string>('');
  const [priceInput, setPriceInput] = useState<string>('6500');

  // Sync inputs with selected lot when dialog opens or lot changes
  useEffect(() => {
    if (open) {
      if (selectedLot && siteData && selectedLot.siteId === siteData.site_id) {
        setBlockInput(selectedLot.blockNumber.toString());
        setLotInput(selectedLot.lotNumber.toString());
        setAreaInput(selectedLot.areaSize.toString());
        setPriceInput(selectedLot.pricePerSqm.toString());
      } else {
        setBlockInput('');
        setLotInput('');
        setAreaInput('');
        setPriceInput('6500');
      }
    }
  }, [open, selectedLot, siteData]);

  const blockNumber = parseInt(blockInput, 10);
  const lotNumber = parseInt(lotInput, 10);
  const hasValidBlockAndLot = !isNaN(blockNumber) && blockNumber > 0 && !isNaN(lotNumber) && lotNumber > 0;

  // Real-time evaluation of block & lot against site data
  const evaluatedStatus: EvaluatedStatus = useMemo(() => {
    if (!siteData || !hasValidBlockAndLot) return null;

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

      const hasDigitalPlat = Boolean(subdivision || existingLot.boundary);
      return { type: 'open', lot: existingLot, isRecordOnly: !hasDigitalPlat };
    }

    if (subdivision) {
      const computedArea = computeSubdivisionAreaSqm(subdivision.boundary);
      return { type: 'unopened_plot', subdivision, computedArea };
    }

    return { type: 'new_record_only' };
  }, [siteData, hasValidBlockAndLot, blockNumber, lotNumber]);

  // Sync area and price inputs when evaluated status changes
  useEffect(() => {
    if (!evaluatedStatus) return;

    if (evaluatedStatus.type === 'open') {
      setAreaInput(evaluatedStatus.lot.area_size.toString());
      setPriceInput(evaluatedStatus.lot.price_per_sqm.toString());
    } else if (evaluatedStatus.type === 'unopened_plot') {
      setAreaInput(evaluatedStatus.computedArea.toString());
      setPriceInput((prev) => prev || '6500');
    }
  }, [evaluatedStatus]);

  // List of open lots for quick selection on the active site (no search)
  const openLots = useMemo(() => {
    if (!siteData) return [];
    return siteData.lots.filter((lot) => lot.status === 'Open');
  }, [siteData]);

  function handleSelectOpenLot(lot: PropertyLotWithClient) {
    setBlockInput(lot.block_number.toString());
    setLotInput(lot.lot_number.toString());
    setAreaInput(lot.area_size.toString());
    setPriceInput(lot.price_per_sqm.toString());
  }

  function handleApplySelection() {
    if (!siteData || !hasValidBlockAndLot || !evaluatedStatus) return;
    if (evaluatedStatus.type === 'already_assigned') return;

    const area = parseFloat(areaInput);
    const rate = parseFloat(priceInput);
    if (isNaN(area) || area <= 0 || isNaN(rate) || rate <= 0) return;

    const totalPrice = area * rate;
    let details: SelectedLotDetails;

    if (evaluatedStatus.type === 'open') {
      details = {
        siteId: siteData.site_id,
        siteName: siteData.name,
        blockNumber,
        lotNumber,
        areaSize: area,
        pricePerSqm: rate,
        totalPrice,
        existingPropertyId: evaluatedStatus.lot.property_id,
        isRecordOnly: evaluatedStatus.isRecordOnly,
        isUnopenedPlot: false,
        isManualNew: false,
      };
    } else if (evaluatedStatus.type === 'unopened_plot') {
      details = {
        siteId: siteData.site_id,
        siteName: siteData.name,
        blockNumber,
        lotNumber,
        areaSize: area,
        pricePerSqm: rate,
        totalPrice,
        isRecordOnly: false,
        isUnopenedPlot: true,
        isManualNew: false,
      };
    } else {
      details = {
        siteId: siteData.site_id,
        siteName: siteData.name,
        blockNumber,
        lotNumber,
        areaSize: area,
        pricePerSqm: rate,
        totalPrice,
        isRecordOnly: true,
        isUnopenedPlot: false,
        isManualNew: true,
      };
    }

    onSelectLot(details);
    onOpenChange(false);
  }

  const isBlocked = evaluatedStatus?.type === 'already_assigned';
  const numericArea = parseFloat(areaInput);
  const numericPrice = parseFloat(priceInput);
  const isInputValid = !isNaN(numericArea) && numericArea > 0 && !isNaN(numericPrice) && numericPrice > 0;
  const canApply = hasValidBlockAndLot && evaluatedStatus !== null && !isBlocked && isInputValid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 space-y-4 bg-card">
        <DialogHeader className="pb-1 border-b border-border">
          <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <LandPlot className="h-4 w-4 text-primary" />
            Block & Lot Selector
          </DialogTitle>
          <p className="text-xs text-muted-foreground pt-0.5">
            Enter numbers manually or pick from available open lots below.
          </p>
        </DialogHeader>

        {/* 1. Manual Block & Lot Inputs */}
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="dialog-block" className="text-xs font-medium text-foreground">
                Block No.
              </Label>
              <Input
                id="dialog-block"
                type="number"
                min={1}
                placeholder="e.g. 1"
                value={blockInput}
                onChange={(e) => setBlockInput(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dialog-lot" className="text-xs font-medium text-foreground">
                Lot No.
              </Label>
              <Input
                id="dialog-lot"
                type="number"
                min={1}
                placeholder="e.g. 5"
                value={lotInput}
                onChange={(e) => setLotInput(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Area & Price inputs (for unopened plot or record only) */}
          {hasValidBlockAndLot && evaluatedStatus && !isBlocked && (
            <div className="grid grid-cols-2 gap-2.5 border-t border-border pt-2.5">
              <div className="space-y-1">
                <Label htmlFor="dialog-area" className="text-[11px] font-medium text-muted-foreground">
                  Area (sqm)
                </Label>
                <Input
                  id="dialog-area"
                  type="number"
                  min={1}
                  step="0.01"
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                  className="h-7 text-xs"
                  disabled={evaluatedStatus.type === 'open'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dialog-price" className="text-[11px] font-medium text-muted-foreground">
                  Price / sqm
                </Label>
                <Input
                  id="dialog-price"
                  type="number"
                  min={1}
                  step="100"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="h-7 text-xs"
                  disabled={evaluatedStatus.type === 'open'}
                />
              </div>
            </div>
          )}
        </div>

        {/* 2. Status evaluation alerts */}
        {hasValidBlockAndLot && evaluatedStatus && (
          <div className="space-y-2">
            {evaluatedStatus.type === 'already_assigned' && (
              <Alert variant="destructive" className="py-2.5">
                <Ban className="h-4 w-4" />
                <AlertTitle className="text-xs font-bold">Already Assigned</AlertTitle>
                <AlertDescription className="text-xs mt-0.5">
                  Block {blockNumber} Lot {lotNumber} is already {evaluatedStatus.lot.status}
                  {evaluatedStatus.lot.client?.full_name ? ` by ${evaluatedStatus.lot.client.full_name}` : ''}. Double sale is prevented.
                </AlertDescription>
              </Alert>
            )}

            {evaluatedStatus.type === 'unopened_plot' && (
              <Alert variant="info" className="py-2.5">
                <Info className="h-4 w-4" />
                <AlertTitle className="text-xs font-bold">Unopened Plot</AlertTitle>
                <AlertDescription className="text-xs mt-0.5">
                  This plot is in the subdivision plan but is currently closed. Assigning will open this lot on {siteData?.name}, then assign it to the client.
                </AlertDescription>
              </Alert>
            )}

            {evaluatedStatus.type === 'new_record_only' && (
              <div className="text-[11px] text-muted-foreground bg-muted/40 rounded px-2.5 py-1.5 border border-border">
                This lot does not have a digital plat drawing on file yet; it will be saved as a record-only lot.
              </div>
            )}

            {evaluatedStatus.type === 'open' && evaluatedStatus.isRecordOnly && (
              <div className="text-[11px] text-muted-foreground bg-muted/40 rounded px-2.5 py-1.5 border border-border">
                This lot does not have a digital plat drawing on file yet; it will be saved as a record-only lot.
              </div>
            )}
          </div>
        )}

        {/* 3. Available Open Lots List (no search) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Available Open Lots</span>
            <span className="text-[11px] font-normal">{openLots.length} available</span>
          </div>

          {openLots.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center border border-dashed border-border rounded-md">
              No open lots registered. Enter block & lot manually above.
            </p>
          ) : (
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5">
              {openLots.map((lot) => {
                const isSelected = blockNumber === lot.block_number && lotNumber === lot.lot_number;

                return (
                  <div
                    key={lot.property_id}
                    onClick={() => handleSelectOpenLot(lot)}
                    className={`flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-primary bg-sidebar-accent shadow-sm'
                        : 'border-border bg-card hover:bg-row-hover'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        Block {lot.block_number} Lot {lot.lot_number}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {lot.area_size} sqm · ₱{lot.price_per_sqm.toLocaleString()}/sqm
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-foreground">
                        {PESO.format(lot.area_size * lot.price_per_sqm)}
                      </p>
                      <Badge variant="success" shape="pill" className="text-[9px] px-1.5 py-0">
                        Open
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Action Buttons */}
        <DialogFooter className="pt-2 border-t border-border flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApplySelection}
            disabled={!canApply}
            className="h-8 text-xs gap-1.5"
          >
            {isBlocked ? 'Blocked' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
