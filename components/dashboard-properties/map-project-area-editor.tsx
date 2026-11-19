'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/lib/hooks/use-session';
import { LoadingButton } from '@/components/ui/loading-button';
import { calculatePolygonAreaSqm } from '@/lib/geometry';
import { getArchiveEligibility } from '@/lib/utils/archive-rules';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ProjectAreaView } from '@/lib/project-area-views';
import { DeleteProjectAreaDialog } from './project-area-delete-dialog';
import type { ProjectArea, ProjectAreaWithLots } from '@/lib/types/property';
import {
  Undo2,
  X,
  Check,
  Trash2,
  MapPin,
  LandPlot,
  AlertTriangle,
  MoreVertical,
  Archive,
  ArchiveRestore,
  ChevronRight,
  RotateCcw,
  Save,
  LogOut,
  PenTool,
} from 'lucide-react';

export interface SelectedPlotInfo {
  subdivisionId?: string;
  projectAreaId: string;
  projectAreaName?: string;
  block: number;
  lot: number;
  status: string;
}

export interface ActiveDraftState {
  boundary: [number, number][];
  areaSize: number;
  block?: number;
  lot?: number;
  isEditingExisting?: boolean;
}

/** Live state while the user drags the corners of an existing project area's outer boundary. */
export interface ReadjustProjectAreaState {
  boundary: [number, number][];
  /** The boundary as stored, so "Reset" can undo every drag without leaving the activity. */
  originalBoundary: [number, number][];
  areaSize: number;
}

export interface MapProjectAreaEditorProps {
  /** Already filtered to the selected view by the caller. Never filter again here. */
  projectAreas: (ProjectAreaWithLots | ProjectArea)[];
  view: ProjectAreaView;
  onViewChange: (view: ProjectAreaView) => void;
  /** Size of each view, for the switch labels. Both sets, not just `projectAreas`. */
  viewCounts: Record<ProjectAreaView, number>;
  activeProjectAreaId: string | null;
  onSelectProjectArea: (projectAreaId: string) => void;
  onLeaveProjectArea: () => void;
  isEditorActive: boolean;
  onToggleEditor: (active: boolean) => void;
  plotType: 'lot' | 'project-area' | null;
  onStartPlotting: (type: 'lot' | 'project-area') => void;
  onCancelPlotting: () => void;
  draftPointsCount: number;
  onUndoPoint: () => void;
  onFinishShape: () => void;
  hasOutOfBoundsVertex?: boolean;

  // Active Draft Panel
  activeDraft: ActiveDraftState | null;
  onConfirmDraftLot: (data: { block_number: number; lot_number: number }) => void;
  onDiscardDraftLot: () => void;
  onRedrawDraftLot: () => void;

  // Project area boundary readjustment activity (mutually exclusive with the lot draft panel)
  readjustProjectArea: ReadjustProjectAreaState | null;
  onConfirmReadjustProjectArea: () => void;
  onDiscardReadjustProjectArea: () => void;
  onResetReadjustProjectArea: () => void;
  /** Start readjusting the active project area's outer boundary from the top-left control box. */
  onStartReadjustProjectArea: () => void;

  // Selected plot deletion
  selectedPlotToDelete: SelectedPlotInfo | null;
  onConfirmDeletePlot: () => Promise<void>;
  onCancelDeletePlot: () => void;

  // New project area boundary
  pendingProjectAreaBoundary: [number, number][] | null;
  onSaveProjectArea: (data: { name: string; description?: string }) => Promise<void>;
  onDiscardProjectArea: () => void;

  // Draft session & batch commit
  draftLotsCount: number;
  pendingUpdatesCount: number;
  /** Queued project area boundary readjustments, counted in the draft footer badge. */
  pendingProjectAreaUpdatesCount?: number;
  onSaveAll: () => Promise<void>;
  onDiscardAllDrafts: () => void;
  isSaving: boolean;

  // LocalStorage recovery
  hasStoredDraft?: boolean;
  onResumeStoredDraft?: () => void;
  onDiscardStoredDraft?: () => void;

  // Project area options
  onArchiveProjectArea?: (projectAreaId: string) => Promise<void>;
  onUnarchiveProjectArea?: (projectAreaId: string) => Promise<void>;
  onDeleteProjectArea?: (projectAreaId: string) => Promise<void>;
}

/**
 * Editor-only switch between the active and archived sets. Both options carry their count so the
 * current mode and what it hides are readable without opening anything.
 */
function ProjectAreaViewSwitch({
  counts,
  view,
  onViewChange,
  className,
}: {
  counts: Record<ProjectAreaView, number>;
  view: ProjectAreaView;
  onViewChange: (view: ProjectAreaView) => void;
  className?: string;
}) {
  return (
    <Tabs
      value={view}
      onValueChange={(next) => onViewChange(next as ProjectAreaView)}
      className={className}
    >
      <TabsList aria-label="Project area view" className="w-full">
        <TabsTrigger value="active" className="flex-1 text-xs">
          Active ({counts.active})
        </TabsTrigger>
        <TabsTrigger value="archived" className="flex-1 text-xs">
          Archived ({counts.archived})
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export function MapProjectAreaEditor({
  projectAreas,
  view,
  onViewChange,
  viewCounts,
  activeProjectAreaId,
  onSelectProjectArea,
  onLeaveProjectArea,
  isEditorActive,
  onToggleEditor,
  plotType,
  onStartPlotting,
  onCancelPlotting,
  draftPointsCount,
  onUndoPoint,
  onFinishShape,
  hasOutOfBoundsVertex = false,
  activeDraft,
  onConfirmDraftLot,
  onDiscardDraftLot,
  onRedrawDraftLot,
  readjustProjectArea,
  onConfirmReadjustProjectArea,
  onDiscardReadjustProjectArea,
  onResetReadjustProjectArea,
  onStartReadjustProjectArea,
  selectedPlotToDelete,
  onConfirmDeletePlot,
  onCancelDeletePlot,
  pendingProjectAreaBoundary,
  onSaveProjectArea,
  onDiscardProjectArea,
  draftLotsCount,
  pendingUpdatesCount,
  pendingProjectAreaUpdatesCount = 0,
  onSaveAll,
  onDiscardAllDrafts,
  isSaving,
  hasStoredDraft = false,
  onResumeStoredDraft,
  onDiscardStoredDraft,
  onArchiveProjectArea,
  onUnarchiveProjectArea,
  onDeleteProjectArea,
}: MapProjectAreaEditorProps) {
  const { isSystemAdmin } = useSession();

  // Controlled inputs for inline lot-details slide-in panel
  const [lotBlock, setLotBlock] = useState<string>('');
  const [lotNumber, setLotNumber] = useState<string>('');

  // Sync inputs when activeDraft changes (e.g. pre-populate when editing an existing lot)
  useEffect(() => {
    if (activeDraft) {
      setLotBlock(activeDraft.block ? String(activeDraft.block) : '');
      setLotNumber(activeDraft.lot ? String(activeDraft.lot) : '');
    } else {
      setLotBlock('');
      setLotNumber('');
    }
  }, [activeDraft]);

  // Save project area form state
  const [projectAreaName, setProjectAreaName] = useState<string>('');
  const [projectAreaDesc, setProjectAreaDesc] = useState<string>('');
  const [isDeleteProjectAreaOpen, setIsDeleteProjectAreaOpen] = useState(false);

  if (!isEditorActive) {
    return null;
  }

  const activeProjectArea = projectAreas.find((s) => s.project_area_id === activeProjectAreaId);
  const activeProjectAreaEligibility = getArchiveEligibility(
    Boolean(activeProjectArea?.is_archived),
    activeProjectArea?.archived_at
  );
  const calculatedProjectAreaArea = pendingProjectAreaBoundary
    ? Math.round(calculatePolygonAreaSqm(pendingProjectAreaBoundary))
    : 0;

  function handleDraftSubmit(e: React.FormEvent) {
    e.preventDefault();
    const block = parseInt(lotBlock, 10);
    const lot = parseInt(lotNumber, 10);
    if (!block || !lot) return;

    onConfirmDraftLot({
      block_number: block,
      lot_number: lot,
    });
  }

  async function handleProjectAreaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectAreaName.trim()) return;

    await onSaveProjectArea({
      name: projectAreaName.trim(),
      description: projectAreaDesc.trim() || undefined,
    });

    setProjectAreaName('');
    setProjectAreaDesc('');
  }

  return (
    <>
      {/* Top-left editor menu and recovery stack — hidden while a focused activity is active */}
      {!activeDraft && !readjustProjectArea && (
      <div className="absolute top-4 left-4 z-30 flex flex-col items-start gap-2 max-w-[calc(100vw-2rem)]">
        <div data-testid="map-editor-card" className="flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-xl transition-all">
          {plotType !== null ? (
            /* State: Active Plotting */
            <>
              <div className="flex flex-col gap-1.5 border-b border-border pb-2">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    <span className="truncate text-xs font-semibold text-foreground">
                      {plotType === 'lot' ? 'Plotting Lot' : 'Plotting New Project Area'}
                    </span>
                  </div>
                  <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-[11px] font-mono text-accent-blue-foreground shrink-0">
                    {draftPointsCount} {draftPointsCount === 1 ? 'pt' : 'pts'}
                  </span>
                </div>

                {hasOutOfBoundsVertex && (
                  <span className="flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-destructive">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span>Outside Boundary</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 pt-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onUndoPoint}
                  disabled={draftPointsCount === 0}
                  className="h-7 px-2 text-xs text-foreground hover:bg-row-hover"
                  title="Undo last plotted point"
                >
                  <Undo2 className="h-3.5 w-3.5 mr-1 shrink-0" />
                  Undo
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancelPlotting}
                  className="h-7 px-2 text-xs text-muted-foreground hover:bg-row-hover hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5 mr-1 shrink-0" />
                  Cancel
                </Button>

                <Button
                  size="sm"
                  onClick={onFinishShape}
                  disabled={draftPointsCount < 3 || hasOutOfBoundsVertex}
                  className="h-7 gap-1 bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)] disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                  title={
                    draftPointsCount < 3
                      ? 'Plot at least 3 points to finish'
                      : hasOutOfBoundsVertex
                        ? 'All points must be inside the project area boundary to finish'
                        : 'Close shape and enter details'
                  }
                >
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  Finish Shape
                </Button>
              </div>
            </>
          ) : !activeProjectArea ? (
            /* State: Project Area Chooser — the top of the decision tree. Pick a project area to
               focus on, or start a brand-new one. Nothing is editable until one is chosen. */
            <>
              <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Map Editor</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleEditor(false)}
                  className="h-7 shrink-0 gap-1 border-border bg-card px-2 text-xs font-medium text-foreground hover:bg-row-hover"
                  title="Leave the map editor and return to the property lots view"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Leave Editor</span>
                </Button>
              </div>

              <div className="pt-0.5">
                <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                  Choose a project area to edit
                </p>
                <ProjectAreaViewSwitch
                  counts={viewCounts}
                  view={view}
                  onViewChange={onViewChange}
                  className="mb-2"
                />
                {projectAreas.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-2.5 py-3 text-[11px] text-muted-foreground">
                    {view === 'archived'
                      ? 'No archived project areas.'
                      : 'No active project areas. Plot a new one below.'}
                  </p>
                ) : (
                  <div
                    role="group"
                    aria-label="Project areas to edit"
                    className="max-h-[280px] space-y-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]"
                  >
                    {projectAreas.map((s) => {
                      const lotCount = 'lots' in s && Array.isArray(s.lots) ? s.lots.length : 0;
                      return (
                        <button
                          key={s.project_area_id}
                          type="button"
                          onClick={() => onSelectProjectArea(s.project_area_id)}
                          className="group flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left transition-colors hover:border-primary hover:bg-row-hover"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-medium text-foreground">
                                {s.name}
                              </span>
                              <span className="block text-[10px] text-muted-foreground">
                                {lotCount} lot{lotCount === 1 ? '' : 's'}
                              </span>
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {s.is_archived && (
                              <span className="flex items-center gap-1 rounded-md border border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                                <Archive className="h-3 w-3" />
                                <span>Archived</span>
                              </span>
                            )}
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {view === 'active' && (
                <div className="border-t border-border pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStartPlotting('project-area')}
                    className="h-8 w-full gap-1.5 border-border bg-card text-xs font-medium text-foreground hover:bg-row-hover"
                    title="Plot a new project area boundary"
                  >
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span>+ New Project Area</span>
                  </Button>
                </div>
              )}
            </>
          ) : (
            /* State: Project Area Focused — editing is scoped to this one project area.
               "+ New Project Area" is deliberately absent; use Leave Project Area to go back up the tree. */
            <>
              <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span
                    className="truncate text-xs font-semibold text-foreground"
                    title={activeProjectArea.name}
                  >
                    {activeProjectArea.name}
                  </span>
                  {activeProjectArea.is_archived && (
                    <span className="flex shrink-0 items-center gap-1 rounded-md border border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                      <Archive className="h-3 w-3" />
                      <span>Archived</span>
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={onLeaveProjectArea}
                    className="cursor-pointer px-1 text-xs font-medium text-primary hover:underline"
                    title="Leave this project area and choose another"
                  >
                    Leave Project Area
                  </button>

                  {isSystemAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-row-active hover:text-foreground"
                          aria-label={`Project area options for ${activeProjectArea.name}`}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-44">
                        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Project Area Options
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          hidden={!activeProjectArea.is_archived}
                          icon={<ArchiveRestore className="h-4 w-4" />}
                          disabled={isSaving}
                          onSelect={() => onUnarchiveProjectArea?.(activeProjectArea.project_area_id)}
                        >
                          Restore Project Area
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          hidden={activeProjectArea.is_archived}
                          icon={<Archive className="h-4 w-4" />}
                          disabled={isSaving}
                          onSelect={() => onArchiveProjectArea?.(activeProjectArea.project_area_id)}
                        >
                          Archive Project Area
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          hidden={!activeProjectArea.is_archived || !isSystemAdmin}
                          disabled={!activeProjectAreaEligibility.isEligibleForDelete}
                          disabledReason={activeProjectAreaEligibility.tooltipReason}
                          tooltipSide="right"
                          variant="destructive"
                          icon={<Trash2 className="h-4 w-4" />}
                          onSelect={() => setIsDeleteProjectAreaOpen(true)}
                        >
                          Delete Project Area
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 pt-0.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStartPlotting('lot')}
                  disabled={activeProjectArea.is_archived}
                  className="h-8 w-full gap-1.5 border-border bg-card text-xs font-medium text-foreground hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-50"
                  title={
                    activeProjectArea.is_archived
                      ? 'Restore project area before plotting new lots'
                      : 'Plot a new lot polygon on this project area'
                  }
                >
                  <LandPlot className="h-3.5 w-3.5 text-primary" />
                  <span>+ Plot Lot</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={onStartReadjustProjectArea}
                  disabled={activeProjectArea.is_archived || isSaving}
                  className="h-8 w-full gap-1.5 border-border bg-card text-xs font-medium text-foreground hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-50"
                  title={
                    activeProjectArea.is_archived
                      ? 'Restore project area before readjusting its boundary'
                      : 'Readjust this project area boundary'
                  }
                >
                  <PenTool className="h-3.5 w-3.5 text-primary" />
                  <span>Readjust Boundary</span>
                </Button>
              </div>

              <p className="border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
                Click a lot on the map to edit its boundary or delete it. Drag the corner dots while
                readjusting to reshape the outline.
              </p>
            </>
          )}
        </div>

        {/* LocalStorage Session Recovery Banner */}
        {hasStoredDraft && activeProjectArea && (
          <div className="flex w-[340px] max-w-[calc(100vw-2rem)] items-center justify-between gap-2 rounded-xl border border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-card px-3 py-2 shadow-xl">
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-foreground">
              <RotateCcw className="h-3.5 w-3.5 text-warning shrink-0" />
              <span className="truncate">
                Draft: <strong>{activeProjectArea.name}</strong>
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={onResumeStoredDraft}
                className="h-7 px-2 text-xs font-semibold text-primary border-[color-mix(in_srgb,var(--primary)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
              >
                Resume
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDiscardStoredDraft}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                Discard
              </Button>
            </div>
          </div>
        )}
      </div>
      )}

      {activeDraft && !readjustProjectArea && (
        <div
          data-testid="map-editor-draft-card"
          className="absolute top-4 left-4 z-30 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-xl transition-all"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <LandPlot className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate text-xs font-semibold text-foreground">
                {activeDraft.isEditingExisting ? 'Edit Lot Boundary' : 'New Lot Details'}
              </span>
            </div>
            <div className="shrink-0 text-[11px]">
              <span className="text-muted-foreground">Area: </span>
              <span className="font-semibold text-foreground">{activeDraft.areaSize} sqm</span>
            </div>
          </div>

          <form onSubmit={handleDraftSubmit} className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="draft-blk" className="text-xs font-medium">
                  Block No. *
                </Label>
                <Input
                  id="draft-blk"
                  type="number"
                  min={1}
                  step={1}
                  allowDecimals={false}
                  required
                  autoFocus
                  value={lotBlock}
                  onChange={(e) => setLotBlock(e.target.value)}
                  className="h-8 w-full text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="draft-lot" className="text-xs font-medium">
                  Lot No. *
                </Label>
                <Input
                  id="draft-lot"
                  type="number"
                  min={1}
                  step={1}
                  allowDecimals={false}
                  required
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  className="h-8 w-full text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 border-t border-border pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRedrawDraftLot}
                className="h-7 px-2 text-xs text-muted-foreground hover:bg-row-hover hover:text-foreground"
                title="Clear points and re-plot"
              >
                Redraw
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDiscardDraftLot}
                className="h-7 px-2 text-xs border-border text-foreground hover:bg-row-hover"
              >
                Discard
              </Button>

              <Button
                type="submit"
                size="sm"
                className="ml-auto h-7 px-3 text-xs font-semibold bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
              >
                {activeDraft.isEditingExisting ? 'Update Lot' : 'Add to Drafts'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Focused activity screen: Readjust Boundary. Replaces the corner card so the activity
          feels like a dedicated screen; the map stays interactive beneath it. */}
      {readjustProjectArea && (
        <div className="absolute top-4 left-4 z-30 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-xl transition-all">
          <div className="flex items-start justify-between gap-2 border-b border-border pb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <PenTool className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate text-xs font-semibold text-foreground">Readjust Boundary</span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {activeProjectArea?.name}
              </p>
            </div>
            <div className="flex flex-col items-end text-[11px] shrink-0">
              <span className="font-semibold text-foreground">
                {Math.round(readjustProjectArea.areaSize).toLocaleString()} sqm
              </span>
              <span className="text-muted-foreground">
                {readjustProjectArea.boundary.length} corners
              </span>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Drag the corner dots on the map to reshape the boundary.
          </p>

          <div className="flex items-center gap-1.5 border-t border-border pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetReadjustProjectArea}
              className="h-7 px-2 text-xs text-muted-foreground hover:bg-row-hover hover:text-foreground"
              title="Reset the outline to the saved boundary"
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDiscardReadjustProjectArea}
              className="h-7 px-2 text-xs border-border text-foreground hover:bg-row-hover"
            >
              Discard
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={onConfirmReadjustProjectArea}
              disabled={readjustProjectArea.boundary.length < 3}
              className="ml-auto h-7 px-3 text-xs font-semibold bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Queue Update
            </Button>
          </div>
        </div>
      )}

      {/* Bottom-Left Draft Session Badge & Save All & Exit Footer */}
      {(draftLotsCount > 0 || pendingUpdatesCount > 0 || pendingProjectAreaUpdatesCount > 0) &&
        !activeDraft &&
        !readjustProjectArea && (
        <div className="absolute bottom-4 left-4 z-30 flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2 shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              📝 {draftLotsCount + pendingUpdatesCount + pendingProjectAreaUpdatesCount} Pending
              Draft
              {draftLotsCount + pendingUpdatesCount + pendingProjectAreaUpdatesCount === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDiscardAllDrafts}
              disabled={isSaving}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            >
              Discard All
            </Button>

            <LoadingButton
              type="button"
              size="sm"
              onClick={onSaveAll}
              isLoading={isSaving}
              loadingText="Saving..."
              className="h-7 gap-1.5 px-3 text-xs font-semibold bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)] shadow-sm"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save All &amp; Exit</span>
            </LoadingButton>
          </div>
        </div>
      )}

      {/* Save New Project Area Modal (when plotting a new project area boundary) */}
      <Dialog open={pendingProjectAreaBoundary !== null} onOpenChange={(open) => !open && onDiscardProjectArea()}>
        <DialogContent className="max-w-sm bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Save New Project Area</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleProjectAreaSubmit} className="space-y-3.5 py-1">
            <div className="rounded-lg bg-row-hover p-2.5 text-xs space-y-1 border border-border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plotted Perimeter:</span>
                <span className="font-semibold text-foreground">
                  {pendingProjectAreaBoundary?.length ?? 0} corners
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Land Area:</span>
                <span className="font-semibold text-foreground">
                  {calculatedProjectAreaArea.toLocaleString()} sqm
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="project-area-name-input" className="text-xs font-medium">
                Project Area Name *
              </Label>
              <Input
                id="project-area-name-input"
                type="text"
                required
                autoFocus
                placeholder="e.g. San Isidro Heights"
                value={projectAreaName}
                onChange={(e) => setProjectAreaName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="project-area-desc-input" className="text-xs font-medium">
                Description (Optional)
              </Label>
              <Input
                id="project-area-desc-input"
                type="text"
                placeholder="Residential subdivision..."
                value={projectAreaDesc}
                onChange={(e) => setProjectAreaDesc(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDiscardProjectArea}
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
                Create Project Area
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
              {selectedPlotToDelete?.projectAreaName ? ` in ${selectedPlotToDelete.projectAreaName}` : ''}?
            </p>

            {selectedPlotToDelete?.status &&
              selectedPlotToDelete.status !== 'Closed' &&
              selectedPlotToDelete.status !== 'Open' && (
                <Alert variant="destructive" className="p-2.5 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <AlertDescription className="text-xs">
                    Block {selectedPlotToDelete.block} Lot {selectedPlotToDelete.lot} is currently{' '}
                    {selectedPlotToDelete.status}. Registered lots can only be deleted while Open, so
                    this will be refused.
                  </AlertDescription>
                </Alert>
              )}

            <Alert variant="warning" className="p-2.5 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <AlertDescription className="text-xs">
                This deletes the lot&apos;s record and its polygon. Block{' '}
                {selectedPlotToDelete?.block} Lot {selectedPlotToDelete?.lot} will no longer appear on
                the map.
              </AlertDescription>
            </Alert>

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

      {activeProjectArea && (
        <DeleteProjectAreaDialog
          projectArea={activeProjectArea}
          open={isDeleteProjectAreaOpen}
          onOpenChange={setIsDeleteProjectAreaOpen}
          onConfirm={async () => {
            if (onDeleteProjectArea) {
              await onDeleteProjectArea(activeProjectArea.project_area_id);
            }
            setIsDeleteProjectAreaOpen(false);
          }}
          isPending={isSaving}
        />
      )}
    </>
  );
}
