'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PanelLeftOpen } from 'lucide-react';
import { SiteMap } from './map-site';
import { PropertyLotsSidebar } from './property-lots-sidebar';
import { MapSiteEditor, type SelectedPlotInfo } from './map-site-editor';
import { createSite, createSubdivisionLot, deleteSubdivisionLot } from '@/lib/actions/sites';
import type { PropertyLotWithClient, SiteWithLots } from '@/lib/types/property';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface SiteMapUnifiedViewProps {
  sites: SiteWithLots[];
}

/** Interactive site map, floating property lots sidebar, and integrated map editor. */
export function SiteMapUnifiedView({ sites }: SiteMapUnifiedViewProps) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [hoveredLotKey, setHoveredLotKey] = useState<string | null>(null);
  const [selectedPropertyLot, setSelectedPropertyLot] = useState<PropertyLotWithClient | null>(null);
  const [createInitialValues, setCreateInitialValues] = useState<{
    site_id?: string;
    block_number?: number;
    lot_number?: number;
  } | null>(null);

  // Editor states
  const [isEditorActive, setIsEditorActive] = useState(false);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(sites[0]?.site_id ?? null);
  const [plotType, setPlotType] = useState<'lot' | 'site' | null>(null);
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([]);
  const [selectedPlotToDelete, setSelectedPlotToDelete] = useState<SelectedPlotInfo | null>(null);
  const [pendingLotBoundary, setPendingLotBoundary] = useState<[number, number][] | null>(null);
  const [pendingSiteBoundary, setPendingSiteBoundary] = useState<[number, number][] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const totalLots = sites.reduce((sum, s) => sum + s.lots.length, 0);

  const handleOpenSidebar = useCallback(() => {
    setIsEditorActive(false);
    setPlotType(null);
    setDraftPoints([]);
    setIsSidebarOpen(true);
  }, []);

  const handleSelectLotProperty = useCallback(
    (lot: PropertyLotWithClient) => {
      if (!isEditorActive) {
        setIsSidebarOpen(true);
      }
      setCreateInitialValues(null);
      setSelectedPropertyLot(lot);
    },
    [isEditorActive],
  );

  const handleSelectLot = useCallback((lot: PropertyLotWithClient | null) => {
    setCreateInitialValues(null);
    setSelectedPropertyLot(lot);
  }, []);

  const handleSelectUnregistered = useCallback(
    (data: { siteId: string; block: number; lot: number }) => {
      if (!isEditorActive) {
        setIsSidebarOpen(true);
      }
      setSelectedPropertyLot(null);
      setCreateInitialValues({
        site_id: data.siteId,
        block_number: data.block,
        lot_number: data.lot,
      });
    },
    [isEditorActive],
  );

  const handleToggleEditor = useCallback(
    (active: boolean) => {
      setIsEditorActive(active);
      if (active) {
        setIsSidebarOpen(false);
        if (!activeSiteId && sites.length > 0) {
          setActiveSiteId(sites[0].site_id);
        }
      } else {
        setPlotType(null);
        setDraftPoints([]);
        setSelectedPlotToDelete(null);
        setPendingLotBoundary(null);
        setPendingSiteBoundary(null);
      }
    },
    [activeSiteId, sites],
  );


  const handleStartPlotting = useCallback((type: 'lot' | 'site') => {
    setPlotType(type);
    setDraftPoints([]);
    setIsSidebarOpen(false);
  }, []);

  const handleCancelPlotting = useCallback(() => {
    setPlotType(null);
    setDraftPoints([]);
  }, []);

  const handleAddDraftPoint = useCallback((pt: [number, number]) => {
    setDraftPoints((prev) => [...prev, pt]);
  }, []);

  const handleUndoPoint = useCallback(() => {
    setDraftPoints((prev) => prev.slice(0, -1));
  }, []);

  const handleFinishShape = useCallback(() => {
    if (draftPoints.length < 3) {
      toast.error('Plotting requires at least 3 points to form a polygon.');
      return;
    }
    if (plotType === 'lot') {
      setPendingLotBoundary(draftPoints);
    } else if (plotType === 'site') {
      setPendingSiteBoundary(draftPoints);
    }
    setPlotType(null);
    setDraftPoints([]);
  }, [draftPoints, plotType]);

  const handleSaveLot = useCallback(
    async (data: {
      block_number: number;
      lot_number: number;
      area_size?: number;
      price_per_sqm?: number;
    }) => {
      if (!activeSiteId || !pendingLotBoundary) return;
      setIsSaving(true);
      try {
        await createSubdivisionLot({
          site_id: activeSiteId,
          block_number: data.block_number,
          lot_number: data.lot_number,
          boundary: pendingLotBoundary,
          area_size: data.area_size,
          price_per_sqm: data.price_per_sqm,
        });
        toast.success(`Block ${data.block_number} Lot ${data.lot_number} created successfully.`);
        setPendingLotBoundary(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create lot plot');
      } finally {
        setIsSaving(false);
      }
    },
    [activeSiteId, pendingLotBoundary, router],
  );

  const handleSaveSite = useCallback(
    async (data: { name: string; description?: string }) => {
      if (!pendingSiteBoundary) return;
      setIsSaving(true);
      try {
        const created = await createSite({
          name: data.name,
          description: data.description,
          boundary: pendingSiteBoundary,
        });
        toast.success(`Site "${created.name}" created successfully.`);
        setPendingSiteBoundary(null);
        setActiveSiteId(created.site_id);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create site');
      } finally {
        setIsSaving(false);
      }
    },
    [pendingSiteBoundary, router],
  );

  const handleDeletePlotTrigger = useCallback((plot: SelectedPlotInfo) => {
    setSelectedPlotToDelete(plot);
  }, []);

  const handleConfirmDeletePlot = useCallback(async () => {
    if (!selectedPlotToDelete) return;
    setIsSaving(true);
    try {
      await deleteSubdivisionLot({
        subdivision_id: selectedPlotToDelete.subdivisionId,
        site_id: selectedPlotToDelete.siteId,
        block_number: selectedPlotToDelete.block,
        lot_number: selectedPlotToDelete.lot,
      });
      toast.success(
        `Block ${selectedPlotToDelete.block} Lot ${selectedPlotToDelete.lot} deleted successfully.`
      );
      setSelectedPlotToDelete(null);
      setSelectedPropertyLot(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete plot');
    } finally {
      setIsSaving(false);
    }
  }, [selectedPlotToDelete, router]);

  return (
    <div className="relative flex flex-1 h-full min-h-0 w-full flex-col overflow-hidden">
      {/* Background: Edge-to-edge interactive canvas */}
      <div className="absolute inset-0 h-full w-full flex flex-col">
        <SiteMap
          sites={sites}
          isSidebarOpen={isSidebarOpen}
          hoveredLotKey={hoveredLotKey}
          selectedLotId={selectedPropertyLot?.property_id}
          onSelectLotProperty={handleSelectLotProperty}
          onSelectUnregistered={handleSelectUnregistered}
          isEditorMode={isEditorActive}
          isPlotting={plotType !== null}
          draftPoints={draftPoints}
          onAddDraftPoint={handleAddDraftPoint}
          onDeletePlot={handleDeletePlotTrigger}
          focusedSiteId={activeSiteId}
        />
      </div>

      {/* Floating Low-profile Map Editor Controls */}
      <MapSiteEditor
        sites={sites}
        activeSiteId={activeSiteId}
        onSelectSite={setActiveSiteId}
        isEditorActive={isEditorActive}
        onToggleEditor={handleToggleEditor}
        plotType={plotType}
        onStartPlotting={handleStartPlotting}
        onCancelPlotting={handleCancelPlotting}
        draftPointsCount={draftPoints.length}
        onUndoPoint={handleUndoPoint}
        onFinishShape={handleFinishShape}
        selectedPlotToDelete={selectedPlotToDelete}
        onConfirmDeletePlot={handleConfirmDeletePlot}
        onCancelDeletePlot={() => setSelectedPlotToDelete(null)}
        pendingLotBoundary={pendingLotBoundary}
        onSaveLot={handleSaveLot}
        onDiscardLot={() => setPendingLotBoundary(null)}
        pendingSiteBoundary={pendingSiteBoundary}
        onSaveSite={handleSaveSite}
        onDiscardSite={() => setPendingSiteBoundary(null)}
        isSaving={isSaving}
      />

      {/* Floating Collapsible Card on Left */}
      <div
        className={cn(
          'absolute left-4 top-4 bottom-4 z-20 w-[420px] sm:w-[460px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ease-in-out',
          isSidebarOpen && !plotType
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : '-translate-x-[calc(100%+2rem)] opacity-0 pointer-events-none'
        )}
      >
        <PropertyLotsSidebar
          sites={sites}
          onClose={() => setIsSidebarOpen(false)}
          selectedLot={selectedPropertyLot}
          onSelectLot={handleSelectLot}
          onHoverLot={setHoveredLotKey}
          createInitialValues={createInitialValues}
          onClearCreateInitialValues={() => setCreateInitialValues(null)}
        />
      </div>

      {/* Floating expand toggle button when card is collapsed and editor is not active */}
      {!isSidebarOpen && !isEditorActive && !plotType && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenSidebar}
          className="absolute left-4 top-4 z-20 gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg hover:bg-row-hover text-foreground font-medium"
          aria-label="Open property lots panel"
        >
          <PanelLeftOpen className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold">Property Lots</span>
          <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] text-accent-blue-foreground font-medium">
            {totalLots}
          </span>
        </Button>
      )}
    </div>
  );
}
