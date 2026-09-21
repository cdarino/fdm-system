'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingButton } from '@/components/ui/loading-button';
import { calculatePolygonAreaSqm } from '@/lib/geometry';
import type { Site, SiteWithLots } from '@/lib/types/property';
import {
  PenTool,
  Plus,
  Undo2,
  X,
  Check,
  Trash2,
  MapPin,
  LandPlot,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectedPlotInfo {
  subdivisionId?: string;
  siteId: string;
  siteName?: string;
  block: number;
  lot: number;
  status: string;
}

export interface MapSiteEditorProps {
  sites: (SiteWithLots | Site)[];
  activeSiteId: string | null;
  onSelectSite: (siteId: string) => void;
  isEditorActive: boolean;
  onToggleEditor: (active: boolean) => void;
  plotType: 'lot' | 'site' | null;
  onStartPlotting: (type: 'lot' | 'site') => void;
  onCancelPlotting: () => void;
  draftPointsCount: number;
  onUndoPoint: () => void;
  onFinishShape: () => void;
  selectedPlotToDelete: SelectedPlotInfo | null;
  onConfirmDeletePlot: () => Promise<void>;
  onCancelDeletePlot: () => void;
  pendingLotBoundary: [number, number][] | null;
  onSaveLot: (data: {
    block_number: number;
    lot_number: number;
    area_size?: number;
    price_per_sqm?: number;
  }) => Promise<void>;
  onDiscardLot: () => void;
  pendingSiteBoundary: [number, number][] | null;
  onSaveSite: (data: { name: string; description?: string }) => Promise<void>;
  onDiscardSite: () => void;
  isSaving: boolean;
}

export function MapSiteEditor({
  sites,
  activeSiteId,
  onSelectSite,
  isEditorActive,
  onToggleEditor,
  plotType,
  onStartPlotting,
  onCancelPlotting,
  draftPointsCount,
  onUndoPoint,
  onFinishShape,
  selectedPlotToDelete,
  onConfirmDeletePlot,
  onCancelDeletePlot,
  pendingLotBoundary,
  onSaveLot,
  onDiscardLot,
  pendingSiteBoundary,
  onSaveSite,
  onDiscardSite,
  isSaving,
}: MapSiteEditorProps) {
  // Save lot form state
  const [lotBlock, setLotBlock] = useState<string>('');
  const [lotNumber, setLotNumber] = useState<string>('');

  // Save site form state
  const [siteName, setSiteName] = useState<string>('');
  const [siteDesc, setSiteDesc] = useState<string>('');

  const activeSite = sites.find((s) => s.site_id === activeSiteId);
  const calculatedLotArea = pendingLotBoundary
    ? Math.max(10, Math.round(calculatePolygonAreaSqm(pendingLotBoundary) * 100) / 100)
    : 250;
  const calculatedSiteArea = pendingSiteBoundary
    ? Math.round(calculatePolygonAreaSqm(pendingSiteBoundary))
    : 0;

  async function handleLotSubmit(e: React.FormEvent) {
    e.preventDefault();
    const block = parseInt(lotBlock, 10);
    const lot = parseInt(lotNumber, 10);
    if (!block || !lot) return;

    await onSaveLot({
      block_number: block,
      lot_number: lot,
      area_size: calculatedLotArea,
    });

    setLotBlock('');
    setLotNumber('');
  }


  async function handleSiteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!siteName.trim()) return;

    await onSaveSite({
      name: siteName.trim(),
      description: siteDesc.trim() || undefined,
    });

    setSiteName('');
    setSiteDesc('');
  }

  return (
    <>
      {/* Top Center Floating Editor Toolbar */}
      <div className="absolute left-1/2 top-4 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2">
        {!isEditorActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleEditor(true)}
            className="h-9 gap-2 rounded-xl border border-border bg-card px-3.5 shadow-lg hover:bg-row-hover text-foreground font-medium transition-all hover:scale-105"
          >
            <PenTool className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold">Map Editor</span>
          </Button>
        ) : (
          <div className="flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-1.5 shadow-xl transition-all">
            {plotType === null ? (
              <>
                {/* Site Picker dropdown */}
                <div className="min-w-0 flex-1 sm:min-w-[160px]">
                  <Select
                    value={activeSiteId ?? ''}
                    onValueChange={onSelectSite}
                    disabled={sites.length === 0}
                  >
                    <SelectTrigger className="h-8 border-none bg-row-hover text-xs font-medium focus:ring-0">
                      <SelectValue placeholder={sites.length === 0 ? 'No sites' : 'Select site'} />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map((s) => (
                        <SelectItem key={s.site_id} value={s.site_id} className="text-xs">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Plot lot button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStartPlotting('lot')}
                  disabled={!activeSiteId}
                  className="h-8 gap-1.5 border-border bg-card text-xs font-medium text-foreground hover:bg-row-hover hover:text-foreground"
                  title={!activeSiteId ? 'Select a site first' : 'Plot a new lot polygon on this site'}
                >
                  <LandPlot className="h-3.5 w-3.5 text-primary" />
                  <span>+ Plot Lot</span>
                </Button>

                {/* New site button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStartPlotting('site')}
                  className="h-8 gap-1.5 border-border bg-card text-xs font-medium text-foreground hover:bg-row-hover hover:text-foreground"
                  title="Plot a new site boundary"
                >
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span>+ New Site</span>
                </Button>

                <div className="h-4 w-[1px] bg-border mx-0.5" />

                {/* Exit Editor button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleEditor(false)}
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:bg-row-hover hover:text-foreground"
                >
                  Done
                </Button>
              </>
            ) : (
              /* Plotting active controls */
              <div className="flex items-center gap-2 px-1">
                <div className="flex items-center gap-2 pr-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  <span className="min-w-0 max-w-full truncate text-xs font-semibold text-foreground">
                    {plotType === 'lot'
                      ? `Plotting Lot on ${activeSite?.name ?? 'Site'}`
                      : 'Plotting New Site'}
                  </span>
                  <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-[11px] font-mono text-accent-blue-foreground">
                    {draftPointsCount} {draftPointsCount === 1 ? 'pt' : 'pts'}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onUndoPoint}
                  disabled={draftPointsCount === 0}
                  className="h-7 px-2 text-xs text-foreground hover:bg-row-hover"
                  title="Undo last plotted point"
                >
                  <Undo2 className="h-3.5 w-3.5 mr-1" />
                  Undo
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancelPlotting}
                  className="h-7 px-2 text-xs text-muted-foreground hover:bg-row-hover hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>

                <Button
                  size="sm"
                  onClick={onFinishShape}
                  disabled={draftPointsCount < 3}
                  className="h-7 gap-1 bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
                >
                  <Check className="h-3.5 w-3.5" />
                  Finish Shape
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save Lot Modal */}
      <Dialog open={pendingLotBoundary !== null} onOpenChange={(open) => !open && onDiscardLot()}>
        <DialogContent className="max-w-sm bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Save Lot on Map</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleLotSubmit} className="space-y-3.5 py-1">
            <div className="rounded-lg bg-row-hover p-2.5 text-xs space-y-1 border border-border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Site:</span>
                <span className="font-semibold text-foreground">{activeSite?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Calculated Area:</span>
                <span className="font-semibold text-foreground">{calculatedLotArea} sqm</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="plot-blk" className="text-xs font-medium">
                  Block No. *
                </Label>
                <Input
                  id="plot-blk"
                  type="number"
                  min={1}
                  required
                  autoFocus
                  placeholder="1"
                  value={lotBlock}
                  onChange={(e) => setLotBlock(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="plot-lot" className="text-xs font-medium">
                  Lot No. *
                </Label>
                <Input
                  id="plot-lot"
                  type="number"
                  min={1}
                  required
                  placeholder="1"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              This lot will be saved as an <strong className="text-foreground font-medium">Available</strong> subdivision on the map.
            </p>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDiscardLot}
                disabled={isSaving}
                className="text-xs border-border"
              >
                Discard
              </Button>
              <LoadingButton
                type="submit"
                size="sm"
                isLoading={isSaving}
                loadingText="Saving..."
                className="text-xs bg-primary text-primary-foreground"
              >
                Save Lot
              </LoadingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Save Site Modal */}
      <Dialog open={pendingSiteBoundary !== null} onOpenChange={(open) => !open && onDiscardSite()}>
        <DialogContent className="max-w-sm bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Save New Site</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSiteSubmit} className="space-y-3.5 py-1">
            <div className="rounded-lg bg-row-hover p-2.5 text-xs space-y-1 border border-border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plotted Perimeter:</span>
                <span className="font-semibold text-foreground">
                  {pendingSiteBoundary?.length ?? 0} corners
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Land Area:</span>
                <span className="font-semibold text-foreground">
                  {calculatedSiteArea.toLocaleString()} sqm
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="site-name-input" className="text-xs font-medium">
                Site Name *
              </Label>
              <Input
                id="site-name-input"
                type="text"
                required
                autoFocus
                placeholder="e.g. San Isidro Heights"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="site-desc-input" className="text-xs font-medium">
                Description (Optional)
              </Label>
              <Input
                id="site-desc-input"
                type="text"
                placeholder="Residential subdivision..."
                value={siteDesc}
                onChange={(e) => setSiteDesc(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDiscardSite}
                disabled={isSaving}
                className="text-xs border-border"
              >
                Discard
              </Button>
              <LoadingButton
                type="submit"
                size="sm"
                isLoading={isSaving}
                loadingText="Creating..."
                className="text-xs bg-primary text-primary-foreground"
              >
                Create Site
              </LoadingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Plot Confirmation Dialog */}
      <Dialog
        open={selectedPlotToDelete !== null}
        onOpenChange={(open) => !open && onCancelDeletePlot()}
      >
        <DialogContent className="max-w-sm bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Delete Plot
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <p className="text-xs text-foreground">
              Are you sure you want to delete{' '}
              <strong className="font-semibold">
                Block {selectedPlotToDelete?.block} Lot {selectedPlotToDelete?.lot}
              </strong>
              {selectedPlotToDelete?.siteName ? ` in ${selectedPlotToDelete.siteName}` : ''}?
            </p>

            {selectedPlotToDelete?.status && selectedPlotToDelete.status !== 'Open' && (
              <div className="flex items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--destructive)_30%,white)] bg-[color-mix(in_srgb,var(--destructive)_10%,white)] p-2.5 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Warning: Lot is currently marked as {selectedPlotToDelete.status}. Deletion may fail if client agreements exist.
                </span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancelDeletePlot}
                disabled={isSaving}
                className="text-xs border-border"
              >
                Cancel
              </Button>
              <LoadingButton
                type="button"
                size="sm"
                variant="destructive"
                onClick={onConfirmDeletePlot}
                isLoading={isSaving}
                loadingText="Deleting..."
                className="text-xs"
              >
                Delete Plot
              </LoadingButton>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

