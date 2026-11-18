'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LoadingButton } from '@/components/ui/loading-button';
import { PanelLeftOpen, PenTool, AlertTriangle } from 'lucide-react';
import { ProjectAreaMap } from './map-project-area';
import { PropertyLotsSidebar } from './property-lots-sidebar';
import { PropertyLotsProvider } from '@/lib/hooks/use-property-lots';
import {
  MapProjectAreaEditor,
  type SelectedPlotInfo,
  type ActiveDraftState,
  type ReadjustProjectAreaState,
} from './map-project-area-editor';
import {
  createProjectArea,
  batchCreateSubdivisionLots,
  updateSubdivisionLotBoundary,
  updateProjectAreaBoundary,
  deleteSubdivisionLot,
  archiveProjectArea,
  unarchiveProjectArea,
  deleteProjectArea,
} from '@/lib/actions/project-areas';
import { parseRing, calculatePolygonAreaSqm, isPolygonContained } from '@/lib/geometry';
import { getProjectAreaDraft, saveProjectAreaDraft, clearProjectAreaDraft } from '@/lib/storage/map-draft-storage';
import {
  countProjectAreasByView,
  filterProjectAreasByView,
  type ProjectAreaView,
} from '@/lib/project-area-views';
import type {
  PropertyLotWithClient,
  ProjectAreaWithLots,
  DraftLot,
  PendingBoundaryUpdate,
  PendingProjectAreaBoundaryUpdate,
} from '@/lib/types/property';
import type { LotPlotProperties } from './map-project-area-popup';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface ProjectAreaMapUnifiedViewProps {
  projectAreas: ProjectAreaWithLots[];
}

/** Interactive projectArea map, floating property lots sidebar, and integrated draft-driven CAD map editor. */
export function ProjectAreaMapUnifiedView({ projectAreas }: ProjectAreaMapUnifiedViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetLotId = searchParams.get('lot');
  const targetProjectAreaId = searchParams.get('projectArea');

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [hoveredLotKey, setHoveredLotKey] = useState<string | null>(null);
  const [selectedPropertyLot, setSelectedPropertyLot] = useState<PropertyLotWithClient | null>(() => {
    if (!targetLotId) return null;
    for (const projectArea of projectAreas) {
      const match = projectArea.lots.find((l) => l.property_id === targetLotId);
      if (match) return match;
    }
    return null;
  });
  const [createInitialValues, setCreateInitialValues] = useState<{
    project_area_id?: string;
    block_number?: number;
    lot_number?: number;
    area_size?: number;
    price_per_sqm?: number;
  } | null>(null);

  // Editor states
  const [isEditorActive, setIsEditorActive] = useState(false);
  // The editor draws one set of project areas at a time; the everyday map keeps its own rule.
  const [editorProjectAreaView, setEditorProjectAreaView] = useState<ProjectAreaView>('active');
  const [activeProjectAreaId, setActiveProjectAreaId] = useState<string | null>(() => {
    if (targetLotId) {
      for (const projectArea of projectAreas) {
        if (projectArea.lots.some((l) => l.property_id === targetLotId)) {
          return projectArea.project_area_id;
        }
      }
    }
    if (
      targetProjectAreaId &&
      projectAreas.some((p) => p.project_area_id === targetProjectAreaId)
    ) {
      return targetProjectAreaId;
    }
    return null;
  });

  // Entry confirmation dialog
  const [isEntryConfirmOpen, setIsEntryConfirmOpen] = useState(false);

  // Exit guard dialog when unsaved drafts exist
  const [isExitGuardOpen, setIsExitGuardOpen] = useState(false);
  const [pendingExitTarget, setPendingExitTarget] = useState<
    'leaveProjectArea' | 'exitEditor' | null
  >(null);

  // Drawing & Plotting states
  const [plotType, setPlotType] = useState<'lot' | 'project-area' | null>(null);
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([]);
  const [selectedPlotToDelete, setSelectedPlotToDelete] = useState<SelectedPlotInfo | null>(null);
  const [pendingProjectAreaBoundary, setPendingProjectAreaBoundary] = useState<[number, number][] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Project area boundary readjustment activity. Mirrors the lot draft panel: only one of the two
  // is ever active at a time, so the user never sees two overlapping editing popups.
  const [readjustProjectArea, setReadjustProjectArea] = useState<ReadjustProjectAreaState | null>(null);
  const [pendingProjectAreaBoundaryUpdates, setPendingProjectAreaBoundaryUpdates] = useState<
    PendingProjectAreaBoundaryUpdate[]
  >([]);

  // Draft session queue for active projectArea
  const [draftLots, setDraftLots] = useState<DraftLot[]>([]);
  const [pendingBoundaryUpdates, setPendingBoundaryUpdates] = useState<PendingBoundaryUpdate[]>([]);
  const [activeDraft, setActiveDraft] = useState<ActiveDraftState | null>(null);
  const [editingSubdivisionId, setEditingSubdivisionId] = useState<string | null>(null);
  const [hasStoredDraft, setHasStoredDraft] = useState(false);

  // The list the editor draws and lists. Filtering here, once, keeps the map canvas, the picker,
  // the pins and the lot geometry on the same set — they all read from this array.
  const editorProjectAreas = useMemo(
    () => filterProjectAreasByView(projectAreas, editorProjectAreaView),
    [projectAreas, editorProjectAreaView]
  );
  const editorProjectAreaCounts = useMemo(() => countProjectAreasByView(projectAreas), [projectAreas]);

  // Active projectArea boundary ring for ray-casting containment. A queued readjustment wins over
  // the stored ring so newly plotted lots are checked against the outline the user is editing.
  const activeProjectArea = useMemo(() => projectAreas.find((s) => s.project_area_id === activeProjectAreaId), [projectAreas, activeProjectAreaId]);
  const activeProjectAreaRing = useMemo(() => {
    if (!activeProjectAreaId) return null;
    const pendingUpdate = pendingProjectAreaBoundaryUpdates.find(
      (u) => u.projectAreaId === activeProjectAreaId
    );
    const boundary = pendingUpdate ? pendingUpdate.boundary : activeProjectArea?.boundary;
    if (!boundary) return null;
    return parseRing(boundary);
  }, [activeProjectArea, activeProjectAreaId, pendingProjectAreaBoundaryUpdates]);

  // Out-of-bounds vertex status. Only meaningful for lots: a new projectArea boundary is plotted
  // outside every existing projectArea ring by definition, so containment must not gate it.
  const hasOutOfBoundsVertex = useMemo(() => {
    if (plotType !== 'lot' || !activeProjectAreaRing || draftPoints.length === 0) return false;
    return !isPolygonContained(draftPoints, activeProjectAreaRing);
  }, [plotType, draftPoints, activeProjectAreaRing]);

  // Sync selected lot from targetLotId URL param
  useEffect(() => {
    if (!targetLotId) return;
    for (const projectArea of projectAreas) {
      const match = projectArea.lots.find((l) => l.property_id === targetLotId);
      if (match) {
        setSelectedPropertyLot(match);
        setIsSidebarOpen(true);
        setActiveProjectAreaId(projectArea.project_area_id);
        break;
      }
    }
  }, [targetLotId, projectAreas]);

  // Sync active project area from URL param
  useEffect(() => {
    if (!targetProjectAreaId) return;
    if (projectAreas.some((p) => p.project_area_id === targetProjectAreaId)) {
      setActiveProjectAreaId((current) =>
        current === targetProjectAreaId ? current : targetProjectAreaId
      );
    }
  }, [targetProjectAreaId, projectAreas]);

  // Check localStorage for saved draft when active projectArea changes in editor mode
  useEffect(() => {
    if (!isEditorActive || !activeProjectAreaId) {
      setHasStoredDraft(false);
      return;
    }
    const saved = getProjectAreaDraft(activeProjectAreaId);
    if (
      saved &&
      (saved.draftLots?.length > 0 ||
        saved.pendingBoundaryUpdates?.length > 0 ||
        (saved.pendingProjectAreaBoundaryUpdates?.length ?? 0) > 0)
    ) {
      setHasStoredDraft(true);
    } else {
      setHasStoredDraft(false);
    }
  }, [isEditorActive, activeProjectAreaId]);

  // Debounced auto-save of drafts to localStorage
  const draftLotsRef = useRef(draftLots);
  draftLotsRef.current = draftLots;
  const pendingBoundaryUpdatesRef = useRef(pendingBoundaryUpdates);
  pendingBoundaryUpdatesRef.current = pendingBoundaryUpdates;
  const pendingProjectAreaBoundaryUpdatesRef = useRef(pendingProjectAreaBoundaryUpdates);
  pendingProjectAreaBoundaryUpdatesRef.current = pendingProjectAreaBoundaryUpdates;

  useEffect(() => {
    if (!isEditorActive || !activeProjectAreaId) return;

    const timer = setTimeout(() => {
      const currentLots = draftLotsRef.current;
      const currentUpdates = pendingBoundaryUpdatesRef.current;
      const currentProjectAreaUpdates = pendingProjectAreaBoundaryUpdatesRef.current;
      if (
        currentLots.length > 0 ||
        currentUpdates.length > 0 ||
        currentProjectAreaUpdates.length > 0
      ) {
        saveProjectAreaDraft(activeProjectAreaId, {
          projectAreaId: activeProjectAreaId,
          draftLots: currentLots,
          pendingBoundaryUpdates: currentUpdates,
          pendingProjectAreaBoundaryUpdates: currentProjectAreaUpdates,
        });
      } else {
        clearProjectAreaDraft(activeProjectAreaId);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [isEditorActive, activeProjectAreaId, draftLots, pendingBoundaryUpdates, pendingProjectAreaBoundaryUpdates]);

  // beforeunload protection when unsaved drafts exist
  useEffect(() => {
    const hasUnsaved =
      draftLots.length > 0 ||
      pendingBoundaryUpdates.length > 0 ||
      pendingProjectAreaBoundaryUpdates.length > 0;
    if (!hasUnsaved) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [draftLots, pendingBoundaryUpdates, pendingProjectAreaBoundaryUpdates]);

  /** Any queued edit — lot drafts, lot boundary updates, or a project area boundary readjustment. */
  const hasPendingChanges = useCallback(
    () =>
      draftLots.length > 0 ||
      pendingBoundaryUpdates.length > 0 ||
      pendingProjectAreaBoundaryUpdates.length > 0,
    [draftLots, pendingBoundaryUpdates, pendingProjectAreaBoundaryUpdates]
  );

  const totalLots = projectAreas.reduce((sum, s) => sum + s.lots.length, 0);

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
    [isEditorActive]
  );

  /** Single project area selection entry point: drives the sidebar filter, the map focus, and the
   * editor's edit target. In the editor this is reached only from the project area chooser, where
   * no drafts can exist yet, so switching needs no guard. */
  const handleSelectProjectArea = useCallback((projectAreaId: string | null) => {
    setActiveProjectAreaId(projectAreaId);
  }, []);

  const handleSelectLot = useCallback((lot: PropertyLotWithClient | null) => {
    setCreateInitialValues(null);
    setSelectedPropertyLot(lot);
  }, []);

  const handleSelectUnregistered = useCallback(
    (data: {
      projectAreaId: string;
      block: number;
      lot: number;
      areaSize?: number;
      pricePerSqm?: number;
    }) => {
      if (!isEditorActive) {
        setIsSidebarOpen(true);
      }
      setSelectedPropertyLot(null);
      setCreateInitialValues({
        project_area_id: data.projectAreaId,
        block_number: data.block,
        lot_number: data.lot,
        area_size: data.areaSize,
        price_per_sqm: data.pricePerSqm,
      });
    },
    [isEditorActive]
  );

  // Entering editor mode is confirmed first, so the drafting rules are stated before any
  // editing is possible.
  const handleRequestEditorEntry = useCallback(() => {
    setIsEntryConfirmOpen(true);
  }, []);

  const handleConfirmEditorEntry = useCallback(() => {
    setIsEntryConfirmOpen(false);
    setIsSidebarOpen(false);
    setIsEditorActive(true);
    // Start at the top of the decision tree: a projectArea may have been selected in view mode,
    // but editing begins with an explicit choice from the projectArea list.
    setActiveProjectAreaId(null);
    setEditorProjectAreaView('active');
  }, []);

  /** Switch the editor between active and archived project areas. Drafts and pending geometry are
   * deliberately left alone — they are keyed by project area, so switching parks them rather than
   * discarding them. */
  const handleChangeEditorView = useCallback(
    (nextView: ProjectAreaView) => {
      setEditorProjectAreaView(nextView);
      setActiveProjectAreaId((currentId) => {
        if (!currentId) return null;
        const current = projectAreas.find((s) => s.project_area_id === currentId);
        return current && filterProjectAreasByView([current], nextView).length > 0 ? currentId : null;
      });
    },
    [projectAreas]
  );

  // Request leaving the chosen projectArea or exiting editor mode
  const handleLeaveProjectArea = useCallback(() => {
    if (hasPendingChanges()) {
      setPendingExitTarget('leaveProjectArea');
      setIsExitGuardOpen(true);
      return;
    }
    setActiveProjectAreaId(null);
    setActiveDraft(null);
    setReadjustProjectArea(null);
    setDraftPoints([]);
    setPlotType(null);
  }, [hasPendingChanges]);

  const handleToggleEditor = useCallback(
    (active: boolean) => {
      if (!active) {
        if (hasPendingChanges()) {
          setPendingExitTarget('exitEditor');
          setIsExitGuardOpen(true);
          return;
        }
        setIsEditorActive(false);
        setPlotType(null);
        setDraftPoints([]);
        setActiveDraft(null);
        setReadjustProjectArea(null);
        setSelectedPlotToDelete(null);
        setPendingProjectAreaBoundary(null);
        setIsSidebarOpen(true);
        toast.success('Left the map editor. You are back in the property lots view.');
      } else {
        handleRequestEditorEntry();
      }
    },
    [hasPendingChanges, handleRequestEditorEntry]
  );

  // LocalStorage draft recovery actions
  const handleResumeStoredDraft = useCallback(() => {
    if (!activeProjectAreaId) return;
    const saved = getProjectAreaDraft(activeProjectAreaId);
    if (saved) {
      setDraftLots(saved.draftLots ?? []);
      setPendingBoundaryUpdates(saved.pendingBoundaryUpdates ?? []);
      setPendingProjectAreaBoundaryUpdates(saved.pendingProjectAreaBoundaryUpdates ?? []);
      toast.success('Restored previous draft lots.');
    }
    setHasStoredDraft(false);
  }, [activeProjectAreaId]);

  const handleDiscardStoredDraft = useCallback(() => {
    if (!activeProjectAreaId) return;
    clearProjectAreaDraft(activeProjectAreaId);
    setHasStoredDraft(false);
    toast.info('Discarded stored drafts.');
  }, [activeProjectAreaId]);

  // Start plotting shape. Starting a plot is a distinct activity, so an open project area
  // boundary readjustment is dismissed rather than left running in parallel.
  const handleStartPlotting = useCallback((type: 'lot' | 'project-area') => {
    setPlotType(type);
    setDraftPoints([]);
    setActiveDraft(null);
    setEditingSubdivisionId(null);
    setReadjustProjectArea(null);
    setIsSidebarOpen(false);
  }, []);

  const handleCancelPlotting = useCallback(() => {
    setPlotType(null);
    setDraftPoints([]);
    setActiveDraft(null);
    setEditingSubdivisionId(null);
    setReadjustProjectArea(null);
  }, []);

  const handleAddDraftPoint = useCallback((pt: [number, number]) => {
    setDraftPoints((prev) => [...prev, pt]);
  }, []);

  const handleUndoPoint = useCallback(() => {
    setDraftPoints((prev) => prev.slice(0, -1));
  }, []);

  // Update draft points (from live vertex drag on map canvas). A project area boundary
  // readjustment uses the same vertex handles, so the active activity decides where the drag lands.
  const handleUpdateDraftPoints = useCallback((points: [number, number][]) => {
    setDraftPoints(points);
    if (points.length >= 3) {
      const area = Math.max(10, Math.round(calculatePolygonAreaSqm(points) * 100) / 100);
      setActiveDraft((prev) => (prev ? { ...prev, boundary: points, areaSize: area } : null));
      setReadjustProjectArea((prev) =>
        prev ? { ...prev, boundary: points, areaSize: area } : null
      );
    }
  }, []);

  // Finish shape drawing -> open inline lot details panel
  const handleFinishShape = useCallback(() => {
    if (draftPoints.length < 3) {
      toast.error('Plotting requires at least 3 points to form a polygon.');
      return;
    }
    if (plotType === 'lot') {
      const area = Math.max(10, Math.round(calculatePolygonAreaSqm(draftPoints) * 100) / 100);
      setActiveDraft({
        boundary: draftPoints,
        areaSize: area,
        isEditingExisting: Boolean(editingSubdivisionId),
      });
      setPlotType(null);
    } else if (plotType === 'project-area') {
      setPendingProjectAreaBoundary(draftPoints);
      setPlotType(null);
      setDraftPoints([]);
    }
  }, [draftPoints, plotType, editingSubdivisionId]);

  // Existing lot "Edit Boundary" clicked in popup. This is a lot activity, so any project area
  // boundary readjustment in progress is dismissed to keep a single activity on screen.
  const handleEditBoundary = useCallback((plot: LotPlotProperties) => {
    setReadjustProjectArea(null);
    // Find subdivision boundary for this plot
    let foundBoundary: [number, number][] | null = null;
    for (const projectArea of projectAreas) {
      if (projectArea.project_area_id === plot.projectAreaId) {
        const sub = projectArea.subdivisions?.find((s) => s.subdivision_id === plot.id);
        if (sub?.boundary) {
          const ring = parseRing(sub.boundary);
          if (ring) {
            foundBoundary = ring as [number, number][];
          }
        }
        break;
      }
    }

    if (!foundBoundary) {
      toast.error('Boundary geometry not found for this lot.');
      return;
    }

    setActiveProjectAreaId(plot.projectAreaId);
    setEditingSubdivisionId(plot.id);
    setDraftPoints(foundBoundary);
    setActiveDraft({
      boundary: foundBoundary,
      // Editing a closed lot has no stored area, so derive it from the ring being edited.
      areaSize:
        plot.areaSize ??
        Math.max(10, Math.round(calculatePolygonAreaSqm(foundBoundary) * 100) / 100),
      block: plot.block,
      lot: plot.lot,
      isEditingExisting: true,
    });
    setPlotType(null);
  }, [projectAreas]);

  // Confirm lot in inline slide-in panel -> queue in draft state
  const handleConfirmDraftLot = useCallback(
    (data: { block_number: number; lot_number: number }) => {
      if (!activeProjectAreaId || !activeDraft) return;

      if (activeDraft.isEditingExisting && editingSubdivisionId) {
        setPendingBoundaryUpdates((prev) => {
          const filtered = prev.filter((p) => p.subdivisionId !== editingSubdivisionId);
          return [
            ...filtered,
            {
              subdivisionId: editingSubdivisionId,
              projectAreaId: activeProjectAreaId,
              block: data.block_number,
              lot: data.lot_number,
              boundary: activeDraft.boundary,
              areaSize: activeDraft.areaSize,
              updatedAt: Date.now(),
            },
          ];
        });
        toast.success(`Block ${data.block_number} Lot ${data.lot_number} boundary queued for save.`);
      } else {
        const newDraft: DraftLot = {
          draftId: crypto.randomUUID(),
          projectAreaId: activeProjectAreaId,
          boundary: activeDraft.boundary,
          block: data.block_number,
          lot: data.lot_number,
          areaSize: activeDraft.areaSize,
          createdAt: Date.now(),
        };
        setDraftLots((prev) => [...prev, newDraft]);
        toast.success(`Block ${data.block_number} Lot ${data.lot_number} added to drafts.`);
      }

      setActiveDraft(null);
      setEditingSubdivisionId(null);
      setDraftPoints([]);
    },
    [activeProjectAreaId, activeDraft, editingSubdivisionId]
  );

  const handleDiscardDraftLot = useCallback(() => {
    setActiveDraft(null);
    setEditingSubdivisionId(null);
    setDraftPoints([]);
  }, []);

  const handleRedrawDraftLot = useCallback(() => {
    setActiveDraft(null);
    setReadjustProjectArea(null);
    setPlotType('lot');
    setDraftPoints([]);
  }, []);

  // "Readjust Boundary" clicked in the editor control box. Mirrors handleEditBoundary: load the
  // stored ring into the shared vertex handles and open the inline readjustment panel. Any lot
  // draft activity is cleared first, so only one editing activity is active.
  const handleReadjustProjectAreaBoundary = useCallback(() => {
    if (!activeProjectArea) {
      toast.error('No project area is open.');
      return;
    }

    const ring = parseRing(activeProjectArea.boundary);
    if (!ring) {
      toast.error('Boundary geometry not found for this project area.');
      return;
    }

    setActiveDraft(null);
    setEditingSubdivisionId(null);
    setDraftPoints(ring as [number, number][]);
    setReadjustProjectArea({
      boundary: ring as [number, number][],
      originalBoundary: ring as [number, number][],
      areaSize: Math.max(10, Math.round(calculatePolygonAreaSqm(ring) * 100) / 100),
    });
    setPlotType(null);
  }, [activeProjectArea]);

  // Queue the readjusted project area boundary into the draft session (committed on Save All).
  const handleConfirmReadjustProjectArea = useCallback(() => {
    if (!activeProjectAreaId || !readjustProjectArea) return;
    setPendingProjectAreaBoundaryUpdates((prev) => {
      const filtered = prev.filter((p) => p.projectAreaId !== activeProjectAreaId);
      return [
        ...filtered,
        {
          projectAreaId: activeProjectAreaId,
          boundary: readjustProjectArea.boundary,
          areaSize: readjustProjectArea.areaSize,
          updatedAt: Date.now(),
        },
      ];
    });
    toast.success('Project area boundary queued for save.');
    setReadjustProjectArea(null);
    setDraftPoints([]);
  }, [activeProjectAreaId, readjustProjectArea]);

  const handleDiscardReadjustProjectArea = useCallback(() => {
    setReadjustProjectArea(null);
    setDraftPoints([]);
  }, []);

  const handleResetReadjustProjectArea = useCallback(() => {
    if (!readjustProjectArea) return;
    setReadjustProjectArea({
      ...readjustProjectArea,
      boundary: readjustProjectArea.originalBoundary,
      areaSize: Math.max(
        10,
        Math.round(calculatePolygonAreaSqm(readjustProjectArea.originalBoundary) * 100) / 100
      ),
    });
    setDraftPoints(readjustProjectArea.originalBoundary);
  }, [readjustProjectArea]);

  const handleDiscardAllDrafts = useCallback(() => {
    if (activeProjectAreaId) {
      clearProjectAreaDraft(activeProjectAreaId);
    }
    setDraftLots([]);
    setPendingBoundaryUpdates([]);
    setPendingProjectAreaBoundaryUpdates([]);
    setActiveDraft(null);
    setReadjustProjectArea(null);
    setEditingSubdivisionId(null);
    setDraftPoints([]);
    toast.info('All draft lots discarded.');
  }, [activeProjectAreaId]);

  // Save All drafts & exit editor mode
  const handleSaveAll = useCallback(async () => {
    if (!hasPendingChanges()) {
      setIsEditorActive(false);
      setIsSidebarOpen(true);
      return;
    }

    setIsSaving(true);
    try {
      // 1. Batch create new draft lots
      if (draftLots.length > 0) {
        const payload = draftLots.map((d) => ({
          project_area_id: d.projectAreaId,
          block_number: d.block!,
          lot_number: d.lot!,
          boundary: d.boundary,
          area_size: d.areaSize,
        }));
        const res = await batchCreateSubdivisionLots(payload);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
      }

      // 2. Commit boundary updates for existing subdivisions
      for (const update of pendingBoundaryUpdates) {
        const res = await updateSubdivisionLotBoundary({
          subdivision_id: update.subdivisionId,
          project_area_id: update.projectAreaId,
          block_number: update.block,
          lot_number: update.lot,
          boundary: update.boundary,
        });
        if (!res.success) {
          toast.error(res.error);
          return;
        }
      }

      // 3. Commit project area outer-boundary readjustments
      for (const update of pendingProjectAreaBoundaryUpdates) {
        const res = await updateProjectAreaBoundary({
          project_area_id: update.projectAreaId,
          boundary: update.boundary,
        });
        if (!res.success) {
          toast.error(res.error);
          return;
        }
      }

      toast.success(
        `Saved ${
          draftLots.length + pendingBoundaryUpdates.length + pendingProjectAreaBoundaryUpdates.length
        } change(s) successfully.`
      );

      if (activeProjectAreaId) {
        clearProjectAreaDraft(activeProjectAreaId);
      }
      setDraftLots([]);
      setPendingBoundaryUpdates([]);
      setPendingProjectAreaBoundaryUpdates([]);
      setActiveDraft(null);
      setReadjustProjectArea(null);
      setEditingSubdivisionId(null);
      setDraftPoints([]);
      setIsEditorActive(false);
      setIsSidebarOpen(true);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }, [
    draftLots,
    pendingBoundaryUpdates,
    pendingProjectAreaBoundaryUpdates,
    activeProjectAreaId,
    hasPendingChanges,
    router,
  ]);

  // Confirm discarding drafts when exit guard triggers
  const handleConfirmDiscardAndExit = useCallback(() => {
    handleDiscardAllDrafts();
    setIsExitGuardOpen(false);
    if (pendingExitTarget === 'leaveProjectArea') {
      setActiveProjectAreaId(null);
      toast.success('Left this project area. Choose another to keep editing.');
    } else {
      setIsEditorActive(false);
      setIsSidebarOpen(true);
      toast.success('Left the map editor. You are back in the property lots view.');
    }
    setPendingExitTarget(null);
  }, [handleDiscardAllDrafts, pendingExitTarget]);

  // Confirm saving drafts when exit guard triggers
  const handleConfirmSaveAndExit = useCallback(async () => {
    setIsExitGuardOpen(false);
    await handleSaveAll();
    if (pendingExitTarget === 'leaveProjectArea') {
      setActiveProjectAreaId(null);
      setIsEditorActive(true);
      setIsSidebarOpen(false);
    }
    setPendingExitTarget(null);
  }, [handleSaveAll, pendingExitTarget]);

  // Save brand-new projectArea
  const handleSaveProjectArea = useCallback(
    async (data: { name: string; description?: string }) => {
      if (!pendingProjectAreaBoundary) return;
      setIsSaving(true);
      try {
        const result = await createProjectArea({
          name: data.name,
          description: data.description,
          boundary: pendingProjectAreaBoundary,
        });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        const created = result.data;
        toast.success(`Project area "${created.name}" created successfully.`);
        setPendingProjectAreaBoundary(null);
        setActiveProjectAreaId(created.project_area_id);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create project area');
      } finally {
        setIsSaving(false);
      }
    },
    [pendingProjectAreaBoundary, router]
  );

  const handleDeletePlotTrigger = useCallback((plot: SelectedPlotInfo) => {
    setSelectedPlotToDelete(plot);
  }, []);

  const handleConfirmDeletePlot = useCallback(async () => {
    if (!selectedPlotToDelete) return;
    setIsSaving(true);
    try {
      const result = await deleteSubdivisionLot({
        subdivision_id: selectedPlotToDelete.subdivisionId,
        project_area_id: selectedPlotToDelete.projectAreaId,
        block_number: selectedPlotToDelete.block,
        lot_number: selectedPlotToDelete.lot,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
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

  const handleArchiveProjectArea = useCallback(
    async (projectAreaId: string) => {
      setIsSaving(true);
      try {
        const result = await archiveProjectArea(projectAreaId);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success('Project area archived successfully');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to archive project area');
      } finally {
        setIsSaving(false);
      }
    },
    [router]
  );

  const handleUnarchiveProjectArea = useCallback(
    async (projectAreaId: string) => {
      setIsSaving(true);
      try {
        const result = await unarchiveProjectArea(projectAreaId);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success('Project area restored successfully');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to restore project area');
      } finally {
        setIsSaving(false);
      }
    },
    [router]
  );

  const handleDeleteProjectArea = useCallback(
    async (projectAreaId: string) => {
      setIsSaving(true);
      try {
        const result = await deleteProjectArea(projectAreaId);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success('Project area deleted successfully');
        setActiveProjectAreaId(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete project area');
      } finally {
        setIsSaving(false);
      }
    },
    [router]
  );

  return (
    <PropertyLotsProvider
      projectAreas={projectAreas}
      truncationMode="cap"
      onProjectAreaFilterChange={handleSelectProjectArea}
    >
      <TooltipProvider delayDuration={200}>
      <div className="relative flex flex-1 h-full min-h-0 w-full flex-col overflow-hidden">
        {/* Background: Edge-to-edge interactive MapLibre canvas */}
        <div className="absolute inset-0 h-full w-full flex flex-col">
          <ProjectAreaMap
            projectAreas={isEditorActive ? editorProjectAreas : projectAreas}
            isSidebarOpen={isSidebarOpen}
            hoveredLotKey={hoveredLotKey}
            selectedLotId={selectedPropertyLot?.property_id}
            onSelectLotProperty={handleSelectLotProperty}
            onSelectUnregistered={handleSelectUnregistered}
            isEditorMode={isEditorActive}
            isPlotting={plotType !== null}
            plotType={plotType}
            draftPoints={draftPoints}
            onAddDraftPoint={handleAddDraftPoint}
            onDeletePlot={handleDeletePlotTrigger}
            onEditBoundary={handleEditBoundary}
            onStartReadjustProjectArea={handleReadjustProjectAreaBoundary}
            focusedProjectAreaId={activeProjectAreaId}
            onSelectProjectArea={handleSelectProjectArea}
            activeProjectAreaRing={activeProjectAreaRing}
            draftLots={draftLots}
            pendingBoundaryUpdates={pendingBoundaryUpdates}
            pendingProjectAreaBoundaryUpdates={pendingProjectAreaBoundaryUpdates}
            onUpdateDraftPoints={handleUpdateDraftPoints}
            isAdjustingVertices={activeDraft !== null || readjustProjectArea !== null}
          />
        </div>

        {/* Floating Map Editor button at top-right when editor is NOT active */}
        {!isEditorActive && (
          <div className="absolute top-4 right-16 z-20">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestEditorEntry}
              className="h-8 gap-1.5 rounded-xl border border-border bg-card px-3 shadow-md hover:bg-row-hover text-foreground font-semibold text-xs"
              title="Enter interactive map editor"
            >
              <PenTool className="h-3.5 w-3.5 text-primary" />
              <span>Map Editor</span>
            </Button>
          </div>
        )}

        {/* Floating Map Editor Shell */}
        <MapProjectAreaEditor
          projectAreas={editorProjectAreas}
          view={editorProjectAreaView}
          onViewChange={handleChangeEditorView}
          viewCounts={editorProjectAreaCounts}
          activeProjectAreaId={activeProjectAreaId}
          onSelectProjectArea={handleSelectProjectArea}
          onLeaveProjectArea={handleLeaveProjectArea}
          isEditorActive={isEditorActive}
          onToggleEditor={handleToggleEditor}
          plotType={plotType}
          onStartPlotting={handleStartPlotting}
          onCancelPlotting={handleCancelPlotting}
          draftPointsCount={draftPoints.length}
          onUndoPoint={handleUndoPoint}
          onFinishShape={handleFinishShape}
          hasOutOfBoundsVertex={hasOutOfBoundsVertex}
          activeDraft={activeDraft}
          onConfirmDraftLot={handleConfirmDraftLot}
          onDiscardDraftLot={handleDiscardDraftLot}
          onRedrawDraftLot={handleRedrawDraftLot}
          readjustProjectArea={readjustProjectArea}
          onConfirmReadjustProjectArea={handleConfirmReadjustProjectArea}
          onDiscardReadjustProjectArea={handleDiscardReadjustProjectArea}
          onResetReadjustProjectArea={handleResetReadjustProjectArea}
          onStartReadjustProjectArea={handleReadjustProjectAreaBoundary}
          selectedPlotToDelete={selectedPlotToDelete}
          onConfirmDeletePlot={handleConfirmDeletePlot}
          onCancelDeletePlot={() => setSelectedPlotToDelete(null)}
          pendingProjectAreaBoundary={pendingProjectAreaBoundary}
          onSaveProjectArea={handleSaveProjectArea}
          onDiscardProjectArea={() => setPendingProjectAreaBoundary(null)}
          draftLotsCount={draftLots.length}
          pendingUpdatesCount={pendingBoundaryUpdates.length}
          pendingProjectAreaUpdatesCount={pendingProjectAreaBoundaryUpdates.length}
          onSaveAll={handleSaveAll}
          onDiscardAllDrafts={handleDiscardAllDrafts}
          isSaving={isSaving}
          hasStoredDraft={hasStoredDraft}
          onResumeStoredDraft={handleResumeStoredDraft}
          onDiscardStoredDraft={handleDiscardStoredDraft}
          onArchiveProjectArea={handleArchiveProjectArea}
          onUnarchiveProjectArea={handleUnarchiveProjectArea}
          onDeleteProjectArea={handleDeleteProjectArea}
        />

        {/* Floating Collapsible Card on Left (View Mode only) */}
        <div
          className={cn(
            'absolute bottom-2 left-2 top-2 z-20 w-[calc(100vw-1rem)] sm:bottom-4 sm:left-4 sm:top-4 sm:w-[460px] sm:max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ease-in-out',
            isSidebarOpen && !isEditorActive && !plotType
              ? 'translate-x-0 opacity-100 pointer-events-auto'
              : '-translate-x-[calc(100%+2rem)] opacity-0 pointer-events-none'
          )}
        >
          <PropertyLotsSidebar
            projectAreas={projectAreas}
            onClose={() => setIsSidebarOpen(false)}
            selectedLot={selectedPropertyLot}
            onSelectLot={handleSelectLot}
            onHoverLot={setHoveredLotKey}
            onProjectAreaFilterChange={handleSelectProjectArea}
            projectAreaFilter={activeProjectAreaId}
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

        {/* Editor Entry Confirmation Dialog */}
        <AlertDialog open={isEntryConfirmOpen} onOpenChange={setIsEntryConfirmOpen}>
          <AlertDialogContent className="max-w-md bg-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-base font-bold">
                <PenTool className="h-4 w-4 text-primary" />
                <span>Enter Map Editor?</span>
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 pt-2 text-xs leading-relaxed text-foreground">
                  <p>
                    You are entering <strong>interactive editing mode</strong>.
                  </p>
                  <div className="space-y-1.5 rounded-lg border border-border bg-row-hover p-2.5 text-muted-foreground">
                    <div className="flex items-start gap-1.5">
                      <span className="font-bold text-primary">•</span>
                      <span>
                        Edits are <strong>drafted locally</strong> and never applied to the live map
                        until you click <strong>Save All &amp; Exit</strong>.
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="font-bold text-primary">•</span>
                      <span>
                        You start by <strong>choosing a project area</strong>, then edit only within
                        it. Use <strong>Leave Project Area</strong> to go back and choose another.
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="font-bold text-primary">•</span>
                      <span>
                        Clicking lots on the map displays editing controls rather than client
                        details.
                      </span>
                    </div>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="pt-2">
              <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmEditorEntry}
                className="bg-primary text-xs font-semibold text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
              >
                Enter Editor
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Unsaved Drafts Exit Warning Dialog */}
        <AlertDialog open={isExitGuardOpen} onOpenChange={setIsExitGuardOpen}>
          <AlertDialogContent className="max-w-md bg-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-base font-bold text-warning">
                <AlertTriangle className="h-4 w-4" />
                <span>Unsaved Drafts Detected</span>
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-foreground leading-relaxed space-y-2">
                <p>
                  You have{' '}
                  <strong>
                    {draftLots.length +
                      pendingBoundaryUpdates.length +
                      pendingProjectAreaBoundaryUpdates.length}
                  </strong>{' '}
                  unsaved draft change(s) on{' '}
                  <strong>{projectAreas.find((s) => s.project_area_id === activeProjectAreaId)?.name ?? 'this project area'}</strong>.
                </p>
                <p className="text-muted-foreground">
                  You cannot leave this project area or exit the editor until you either commit all changes to the database or discard them.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="pt-2 flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="text-xs">Stay in Editor</AlertDialogCancel>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmDiscardAndExit}
                className="text-xs"
              >
                Discard All Drafts
              </Button>
              <LoadingButton
                size="sm"
                onClick={handleConfirmSaveAndExit}
                isLoading={isSaving}
                loadingText="Saving..."
                className="text-xs font-semibold bg-primary text-primary-foreground"
              >
                Save All &amp; Exit
              </LoadingButton>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
    </PropertyLotsProvider>
  );
}
