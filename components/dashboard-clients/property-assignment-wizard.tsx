'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { IconBox } from '@/components/ui/icon-box';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  CheckCircle2,
  FileText,
  Receipt,
  Award,
  Loader2,
  AlertTriangle,
  Info,
  Pencil,
  PhilippinePeso,
} from 'lucide-react';
import { DOC_TYPE_LABEL, type DocType } from '@/lib/types/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  getPropertyLotById,
  createPropertyLot,
  assignPropertyFullyPaid,
} from '@/lib/actions/properties';
import { createBillingLedger } from '@/lib/actions/billing';
import { formatCurrency } from '@/lib/billing/ledger-engine';
import { getProjectAreas, getProjectAreaWithLots } from '@/lib/actions/project-areas';
import { getClientRequirements, formatMissingRequirements } from '@/lib/utils/client-requirements';
import { PROPERTY_STATUS_VARIANT } from '@/lib/status-colors';
import {
  BlockLotPopup,
  evaluateLotStatus,
  type SelectedLotDetails,
} from './block-lot-popup';
import { useClientDetail } from '@/lib/hooks/use-client-detail';
import type { ProjectArea, ProjectAreaWithLots } from '@/lib/types/property';

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

type AssignmentStage = 'account-settlement' | 'legal-processing' | 'for-release' | null;

interface StageOption {
  id: AssignmentStage;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresComplete: boolean;
}

const STAGE_OPTIONS: StageOption[] = [
  {
    id: 'account-settlement',
    title: 'Account Settlement',
    description: 'Client is paying or restructuring via installment plan',
    icon: Receipt,
    requiresComplete: true,
  },
  {
    id: 'legal-processing',
    title: 'Legal Processing',
    description: 'Client is fully paid. Billing clears account and Legal drafts DOAS & title',
    icon: FileText,
    requiresComplete: true,
  },
  {
    id: 'for-release',
    title: 'For Release',
    description: 'Title and executed documents are ready for client turnover at office',
    icon: Award,
    requiresComplete: true,
  },
];

interface PropertyAssignmentWizardProps {
  preSelectedPropertyId?: string;
  onSuccess?: () => void;
  onNavigateToDocuments?: (docType?: DocType) => void;
}

export function PropertyAssignmentWizard({
  preSelectedPropertyId,
  onSuccess,
  onNavigateToDocuments,
}: PropertyAssignmentWizardProps) {
  const { client } = useClientDetail();
  const router = useRouter();
  const [selectedProjectAreaId, setSelectedProjectAreaId] = useState<string>('');
  const [projectAreaData, setProjectAreaData] = useState<ProjectAreaWithLots | null>(null);
  const [isLoadingProjectArea, setIsLoadingProjectArea] = useState(false);

  // Inline Block, Lot, Area & Price state
  const [blockInput, setBlockInput] = useState<string>('');
  const [lotInput, setLotInput] = useState<string>('');
  const [areaInput, setAreaInput] = useState<string>('');
  const [priceInput, setPriceInput] = useState<string>('');
  const [isLotPopupOpen, setIsLotPopupOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<'area' | 'price' | null>(null);

  const [selectedStage, setSelectedStage] = useState<AssignmentStage>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Account Settlement stage state (Contract Ledger)
  const [totalContractPrice, setTotalContractPrice] = useState<string>('');
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [downpayment, setDownpayment] = useState<string>('0');
  const [termMonths, setTermMonths] = useState<number>(36);
  const [firstDueDate, setFirstDueDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-25`;
  });
  const [dueDay, setDueDay] = useState<number>(25);
  const [penaltyRate, setPenaltyRate] = useState<number>(3.5);

  const numericTcp = parseFloat(totalContractPrice) || 0;
  const numericDp = parseFloat(downpayment) || 0;
  const financedPrincipal = Math.max(0, numericTcp - numericDp);
  const computedMonthly = termMonths > 0 ? +(financedPrincipal / termMonths).toFixed(2) : 0;

  const handleFirstDueDateChange = (dateVal: string) => {
    setFirstDueDate(dateVal);
    const day = Number(dateVal.split('-')[2]);
    if (day && day >= 1 && day <= 31) {
      setDueDay(day);
    }
  };

  // For Release stage state
  const [titleNumber, setTitleNumber] = useState<string>('');
  const [isLegacyTransferred, setIsLegacyTransferred] = useState<boolean>(false);

  const [projectAreas, setProjectAreas] = useState<ProjectArea[]>([]);
  const [isLoadingPreSelected, setIsLoadingPreSelected] = useState(false);

  const requirements = getClientRequirements(client, client.client_document);

  const projectAreaOptions = useMemo(
    () =>
      projectAreas.map((projectArea) => ({
        value: projectArea.project_area_id,
        label: projectArea.name,
        description: projectArea.description ?? undefined,
      })),
    [projectAreas]
  );

  // Load projectAreas on mount
  useEffect(() => {
    getProjectAreas()
      .then((data) => {
        setProjectAreas(data);
        if (data.length === 1 && !selectedProjectAreaId) {
          setSelectedProjectAreaId(data[0].project_area_id);
        }
      })
      .catch((err) => console.error('Failed to load project areas:', err));
  }, [selectedProjectAreaId]);

  // Load project area data when the project area selection changes
  useEffect(() => {
    if (!selectedProjectAreaId) {
      setProjectAreaData(null);
      return;
    }

    let isMounted = true;
    setIsLoadingProjectArea(true);
    getProjectAreaWithLots(selectedProjectAreaId)
      .then((data) => {
        if (isMounted) setProjectAreaData(data);
      })
      .catch((err) => {
        console.error('Failed to load project area details:', err);
        if (isMounted) setProjectAreaData(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingProjectArea(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedProjectAreaId]);

  // Pre-load lot if passed via query params (e.g. from subdivision map)
  useEffect(() => {
    if (!preSelectedPropertyId) return;

    setIsLoadingPreSelected(true);
    getPropertyLotById(preSelectedPropertyId)
      .then((lot) => {
        const projectAreaId = lot.project_area_id || '';
        if (projectAreaId) setSelectedProjectAreaId(projectAreaId);
        setBlockInput(lot.block_number.toString());
        setLotInput(lot.lot_number.toString());
        setAreaInput(lot.area_size.toString());
        setPriceInput(lot.price_per_sqm.toString());
        setTotalContractPrice((lot.area_size * lot.price_per_sqm).toString());
      })
      .catch((err) => {
        console.error('Failed to load pre-selected property:', err);
      })
      .finally(() => setIsLoadingPreSelected(false));
  }, [preSelectedPropertyId]);

  const blockNumber = parseInt(blockInput, 10);
  const lotNumber = parseInt(lotInput, 10);
  const hasValidBlockAndLot =
    !isNaN(blockNumber) && blockNumber > 0 && !isNaN(lotNumber) && lotNumber > 0;

  const evaluatedStatus = useMemo(
    () => evaluateLotStatus(projectAreaData, blockNumber, lotNumber),
    [projectAreaData, blockNumber, lotNumber]
  );

  const isBlocked = evaluatedStatus?.type === 'already_assigned';
  const isManualMetricsEditable =
    evaluatedStatus?.type === 'unopened_plot' || evaluatedStatus?.type === 'new_record_only';

  const numericArea = parseFloat(areaInput);
  const numericPrice = parseFloat(priceInput);
  const isMetricsValid =
    !isNaN(numericArea) && numericArea > 0 && !isNaN(numericPrice) && numericPrice > 0;
  const computedTotalPrice = isMetricsValid ? numericArea * numericPrice : null;

  // Derive active SelectedLotDetails when inputs and status are valid
  const selectedLotDetails: SelectedLotDetails | null = useMemo(() => {
    if (
      !projectAreaData ||
      !hasValidBlockAndLot ||
      !evaluatedStatus ||
      evaluatedStatus.type === 'already_assigned' ||
      computedTotalPrice === null
    ) {
      return null;
    }

    const base = {
      projectAreaId: projectAreaData.project_area_id,
      projectAreaName: projectAreaData.name,
      blockNumber,
      lotNumber,
      areaSize: numericArea,
      pricePerSqm: numericPrice,
      totalPrice: computedTotalPrice,
    };

    if (evaluatedStatus.type === 'open') {
      return {
        ...base,
        existingPropertyId: evaluatedStatus.lot.property_id,
        isRecordOnly: evaluatedStatus.isRecordOnly,
        isUnopenedPlot: false,
        isManualNew: false,
      };
    }

    if (evaluatedStatus.type === 'unopened_plot') {
      return {
        ...base,
        isRecordOnly: false,
        isUnopenedPlot: true,
        isManualNew: false,
      };
    }

    return {
      ...base,
      isRecordOnly: true,
      isUnopenedPlot: false,
      isManualNew: true,
    };
  }, [
    projectAreaData,
    hasValidBlockAndLot,
    evaluatedStatus,
    computedTotalPrice,
    blockNumber,
    lotNumber,
    numericArea,
    numericPrice,
  ]);

  // Keep Account Settlement totalContractPrice synced with computed lot total unless manually overridden
  useEffect(() => {
    if (!isEditingPrice) {
      setTotalContractPrice(computedTotalPrice !== null ? computedTotalPrice.toString() : '');
    }
  }, [computedTotalPrice, isEditingPrice]);

  function updateBlockAndLot(nextBlock: string, nextLot: string) {
    const prevWasLocked =
      evaluatedStatus?.type === 'open' || evaluatedStatus?.type === 'already_assigned';

    setBlockInput(nextBlock);
    setLotInput(nextLot);
    setEditingMetric(null);
    setIsEditingPrice(false);

    const nextStatus = evaluateLotStatus(
      projectAreaData,
      parseInt(nextBlock, 10),
      parseInt(nextLot, 10)
    );

    if (nextStatus?.type === 'open' || nextStatus?.type === 'already_assigned') {
      setAreaInput(nextStatus.lot.area_size.toString());
      setPriceInput(nextStatus.lot.price_per_sqm.toString());
    } else if (!nextStatus || prevWasLocked) {
      setAreaInput('');
      setPriceInput('');
    }
  }

  function handleProjectAreaChange(newProjectAreaId: string) {
    setSelectedProjectAreaId(newProjectAreaId);
    setBlockInput('');
    setLotInput('');
    setAreaInput('');
    setPriceInput('');
    setEditingMetric(null);
    setTotalContractPrice('');
    setIsEditingPrice(false);
  }

  function handleStageSelect(stage: AssignmentStage) {
    setSelectedStage((current) => (current === stage ? null : stage));
    setTitleNumber('');
    setIsLegacyTransferred(false);
  }

  async function handleSubmit() {
    if (!selectedLotDetails || !selectedStage) return;

    const selectedStageOption = STAGE_OPTIONS.find((opt) => opt.id === selectedStage);
    if (selectedStageOption?.requiresComplete && !requirements.isComplete) {
      toast.error(`Cannot assign: Missing ${formatMissingRequirements(requirements)}`);
      return;
    }

    setIsSubmitting(true);

    try {
      let targetPropertyId = selectedLotDetails.existingPropertyId;

      // Create/open lot in property_lot first if unopened plot or new record-only lot
      if (!targetPropertyId) {
        const createResult = await createPropertyLot({
          project_area_id: selectedLotDetails.projectAreaId,
          location: selectedLotDetails.projectAreaName,
          block_number: selectedLotDetails.blockNumber,
          lot_number: selectedLotDetails.lotNumber,
          area_size: selectedLotDetails.areaSize,
          price_per_sqm: selectedLotDetails.pricePerSqm,
          status: 'Open',
        });

        if (!createResult.success) {
          throw new Error(createResult.error || 'Failed to open property lot');
        }

        targetPropertyId = createResult.data.property_id;
      }

      if (selectedStage === 'account-settlement') {
        const tcp = parseFloat(totalContractPrice);
        if (isNaN(tcp) || tcp <= 0) {
          toast.error('Invalid total contract price');
          return;
        }

        const dp = parseFloat(downpayment) || 0;
        if (dp < 0) {
          toast.error('Downpayment cannot be negative');
          return;
        }
        if (termMonths < 1 || termMonths > 120) {
          toast.error('Terms must be between 1 and 120 months');
          return;
        }
        if (!firstDueDate) {
          toast.error('First due date is required');
          return;
        }

        const result = await createBillingLedger({
          clientId: client.client_id,
          propertyId: targetPropertyId,
          contractPrice: tcp,
          downpayment: dp,
          termMonths,
          firstDueDate,
          dueDay,
          penaltyRate,
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to create contract ledger');
        }

        const actionText = selectedLotDetails.isUnopenedPlot
          ? `Opened Block ${selectedLotDetails.blockNumber} Lot ${selectedLotDetails.lotNumber} and created contract ledger`
          : `Property assigned and contract ledger created with ${termMonths}-month installment schedule`;
        toast.success(actionText);
      } else if (selectedStage === 'legal-processing') {
        const result = await assignPropertyFullyPaid(targetPropertyId, client.client_id);

        if (!result.success) {
          throw new Error(result.error || 'Failed to assign property');
        }

        const actionText = selectedLotDetails.isUnopenedPlot
          ? `Opened Block ${selectedLotDetails.blockNumber} Lot ${selectedLotDetails.lotNumber} as fully paid, queued for Legal Processing`
          : `Property assigned as fully paid, queued for Legal Processing`;
        toast.success(actionText);
      } else if (selectedStage === 'for-release') {
        if (!titleNumber.trim()) {
          toast.error('Title number is required for the For Release stage');
          return;
        }

        const result = await assignPropertyFullyPaid(targetPropertyId, client.client_id, {
          title_number: titleNumber.trim(),
          is_legacy_transferred: isLegacyTransferred,
          create_title: true,
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to assign property');
        }

        const actionText = selectedLotDetails.isUnopenedPlot
          ? `Opened Block ${selectedLotDetails.blockNumber} Lot ${selectedLotDetails.lotNumber} with title ready for release`
          : `Property assigned with title ready for release`;
        toast.success(actionText);
      }

      setBlockInput('');
      setLotInput('');
      setAreaInput('');
      setPriceInput('');
      setEditingMetric(null);
      setSelectedStage(null);
      setTitleNumber('');
      setIsLegacyTransferred(false);
      setTotalContractPrice('');
      setIsEditingPrice(false);
      setDownpayment('0');
      setTermMonths(36);
      setPenaltyRate(3.5);

      router.refresh();

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Assignment error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to assign property');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNavigateToUpload(type?: DocType) {
    if (onNavigateToDocuments) {
      onNavigateToDocuments(type);
    }
    const params = new URLSearchParams();
    params.set('tab', 'documents');
    if (type) params.set('uploadType', type);
    router.push(`/dashboard/clients/${client.client_id}?${params.toString()}`);
  }

  const canProceed = Boolean(selectedLotDetails) && Boolean(selectedStage);
  const selectedStageOption = STAGE_OPTIONS.find((opt) => opt.id === selectedStage);
  const needsTitleNumber = selectedStage === 'for-release' && !titleNumber.trim();
  const hasAnyInput = Boolean(blockInput || lotInput || areaInput || priceInput || selectedStage);

  return (
    <div className="space-y-5">
      {!requirements.isComplete && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="space-y-1">
            <p className="font-semibold text-foreground">Client requirements incomplete</p>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
              <span>Missing:</span>
              {requirements.missingProfile.map((field, idx) => (
                <span key={field} className="font-medium">
                  {field}
                  {idx < requirements.missingProfile.length - 1 || requirements.missingDocuments.length > 0 ? ',' : ''}
                </span>
              ))}
              {requirements.missingDocuments.map((type, idx) => (
                <span key={type} className="inline-flex items-center gap-1 font-medium">
                  <span>{DOC_TYPE_LABEL[type]}</span>
                  <button
                    type="button"
                    onClick={() => handleNavigateToUpload(type)}
                    className="font-medium text-primary underline underline-offset-2 hover:text-[color-mix(in_srgb,var(--primary)_85%,black)]"
                    aria-label={`Upload ${DOC_TYPE_LABEL[type]}`}
                  >
                    Upload
                  </button>
                  {idx < requirements.missingDocuments.length - 1 ? ',' : ''}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Property assignment is locked until these requirements are completed.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div
        className={cn(
          'space-y-5 transition-opacity',
          !requirements.isComplete && 'pointer-events-none opacity-50 select-none'
        )}
        aria-disabled={!requirements.isComplete}
        inert={!requirements.isComplete ? true : undefined}
      >
        {/* 1. Inline Property Lot Chooser */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-foreground">
          1. Choose Property Lot
        </Label>

        {isLoadingPreSelected ? (
          <div className="flex items-center justify-center p-6 rounded-lg border border-border bg-card gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading property details...
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="grid gap-3 sm:grid-cols-[1fr_13rem]">
              {/* Searchable Project Area Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="project-area-selector" className="text-xs text-muted-foreground font-medium">
                  Project Area
                </Label>
                <SearchableSelect
                  id="project-area-selector"
                  options={projectAreaOptions}
                  value={selectedProjectAreaId}
                  onValueChange={handleProjectAreaChange}
                  placeholder="Choose a project area..."
                  searchPlaceholder="Search project area name or address..."
                  emptyMessage="No matching project areas found."
                />
              </div>

              {/* Inline Block & Lot Fields with Focus Grid Popup */}
              <BlockLotPopup
                open={isLotPopupOpen && Boolean(selectedProjectAreaId) && !isLoadingProjectArea}
                onOpenChange={setIsLotPopupOpen}
                projectAreaData={projectAreaData}
                activeBlock={!isNaN(blockNumber) && blockNumber > 0 ? blockNumber : null}
                activeLot={!isNaN(lotNumber) && lotNumber > 0 ? lotNumber : null}
                onSelectLot={(blk, lot) => updateBlockAndLot(blk.toString(), lot.toString())}
              >
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="inline-block" className="text-xs text-muted-foreground font-medium">
                      Block No.
                    </Label>
                    <Input
                      id="inline-block"
                      type="number"
                      min={1}
                      step={1}
                      placeholder="e.g. 1"
                      disabled={!selectedProjectAreaId || isLoadingProjectArea}
                      value={blockInput}
                      onFocus={() => setIsLotPopupOpen(true)}
                      onChange={(e) => updateBlockAndLot(e.target.value, lotInput)}
                      className="h-9 bg-card"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inline-lot" className="text-xs text-muted-foreground font-medium">
                      Lot No.
                    </Label>
                    <Input
                      id="inline-lot"
                      type="number"
                      min={1}
                      step={1}
                      placeholder="e.g. 5"
                      disabled={!selectedProjectAreaId || isLoadingProjectArea}
                      value={lotInput}
                      onFocus={() => setIsLotPopupOpen(true)}
                      onChange={(e) => updateBlockAndLot(blockInput, e.target.value)}
                      className="h-9 bg-card"
                    />
                  </div>
                </div>
              </BlockLotPopup>
            </div>

            {/* Unified Inline Details & Preview Bar (Clickable Area & Price) */}
            <div
              className={cn(
                'flex flex-col justify-between gap-3 rounded-lg border px-3.5 py-2.5 sm:flex-row sm:items-center',
                isBlocked
                  ? 'border-[color-mix(in_srgb,var(--destructive)_30%,white)] bg-[color-mix(in_srgb,var(--destructive)_8%,white)]'
                  : 'border-border bg-row-hover'
              )}
            >
              {/* Left: Consolidated state & action preview */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {isLoadingProjectArea ? (
                    <Badge variant="muted" shape="pill">
                      Loading project area...
                    </Badge>
                  ) : !evaluatedStatus ? (
                    <Badge variant="muted" shape="pill">
                      No lot entered
                    </Badge>
                  ) : null}

                  {evaluatedStatus?.type === 'open' && (
                    <>
                      <Badge variant={PROPERTY_STATUS_VARIANT.Open} shape="pill" dot>
                        Open
                      </Badge>
                      {evaluatedStatus.isRecordOnly && (
                        <Badge variant="outline" shape="pill" className="text-[10px] px-2 py-0">
                          Record-only
                        </Badge>
                      )}
                    </>
                  )}

                  {evaluatedStatus?.type === 'unopened_plot' && (
                    <Badge variant="info" shape="pill" dot>
                      Unopened Plot
                    </Badge>
                  )}

                  {evaluatedStatus?.type === 'new_record_only' && (
                    <Badge variant="warning" shape="pill" dot>
                      New Record-Only
                    </Badge>
                  )}

                  {evaluatedStatus?.type === 'already_assigned' && (
                    <Badge variant="destructive" shape="pill" dot>
                      {evaluatedStatus.lot.status}
                    </Badge>
                  )}
                </div>

                <p
                  className={cn(
                    'text-xs leading-snug',
                    isBlocked ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  {isLoadingProjectArea && 'Fetching project area lots and subdivision plan...'}
                  {!isLoadingProjectArea &&
                    !evaluatedStatus &&
                    (selectedProjectAreaId
                      ? 'Focus Block or Lot to pick from grid, or enter numbers manually.'
                      : 'Select a project area first.')}
                  {evaluatedStatus?.type === 'open' &&
                    (evaluatedStatus.isRecordOnly
                      ? 'Selects existing open lot (no digital plat on file).'
                      : 'Selects existing open lot from project area plan.')}
                  {evaluatedStatus?.type === 'unopened_plot' &&
                    'Plot exists on plan; will open lot and assign. Click Area and Price to set.'}
                  {evaluatedStatus?.type === 'new_record_only' &&
                    'Not on digital plan; will create a record-only lot. Click Area and Price to set.'}
                  {evaluatedStatus?.type === 'already_assigned' &&
                    `Assigned${
                      evaluatedStatus.lot.client?.full_name
                        ? ` to ${evaluatedStatus.lot.client.full_name}`
                        : ''
                    }. Double sale prevented.`}
                </p>
              </div>

              {/* Right: Always-visible Area, Price / sqm (clickable when editable) & Total Price */}
              <div className="flex flex-wrap items-center gap-3 sm:shrink-0 sm:gap-4">
                {/* Area (sqm) */}
                <div
                  className={cn(
                    'text-left sm:text-right',
                    !isManualMetricsEditable && 'opacity-50'
                  )}
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Area (sqm)
                  </p>
                  {isManualMetricsEditable && editingMetric === 'area' ? (
                    <Input
                      type="number"
                      min={0.01}
                      step="0.01"
                      autoFocus
                      value={areaInput}
                      onChange={(e) => setAreaInput(e.target.value)}
                      onBlur={() => setEditingMetric(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          e.preventDefault();
                          setEditingMetric(null);
                        }
                      }}
                      className="mt-0.5 h-7 w-24 bg-card px-2 text-xs tabular-nums"
                    />
                  ) : isManualMetricsEditable ? (
                    <button
                      type="button"
                      onClick={() => setEditingMetric('area')}
                      className="mt-0.5 inline-flex items-center gap-1 rounded border border-dashed border-primary bg-card px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground hover:bg-sidebar-accent"
                    >
                      <span>
                        {!isNaN(numericArea) && numericArea > 0
                          ? `${numericArea} sqm`
                          : 'Set area'}
                      </span>
                      <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                    </button>
                  ) : (
                    <p className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">
                      {!isNaN(numericArea) && numericArea > 0 ? `${numericArea} sqm` : 'Not set'}
                    </p>
                  )}
                </div>

                {/* Price / sqm */}
                <div
                  className={cn(
                    'text-left sm:text-right',
                    !isManualMetricsEditable && 'opacity-50'
                  )}
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Price / sqm
                  </p>
                  {isManualMetricsEditable && editingMetric === 'price' ? (
                    <Input
                      type="number"
                      min={0.01}
                      step="0.01"
                      autoFocus
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      onBlur={() => setEditingMetric(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          e.preventDefault();
                          setEditingMetric(null);
                        }
                      }}
                      className="mt-0.5 h-7 w-28 bg-card px-2 text-xs tabular-nums"
                    />
                  ) : isManualMetricsEditable ? (
                    <button
                      type="button"
                      onClick={() => setEditingMetric('price')}
                      className="mt-0.5 inline-flex items-center gap-1 rounded border border-dashed border-primary bg-card px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground hover:bg-sidebar-accent"
                    >
                      <span>
                        {!isNaN(numericPrice) && numericPrice > 0
                          ? PESO.format(numericPrice)
                          : 'Set price'}
                      </span>
                      <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                    </button>
                  ) : (
                    <p className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">
                      {!isNaN(numericPrice) && numericPrice > 0 ? PESO.format(numericPrice) : 'Not set'}
                    </p>
                  )}
                </div>

                {/* Total Price */}
                <div
                  className={cn(
                    'border-l border-border pl-3 text-left sm:pl-4 sm:text-right',
                    computedTotalPrice === null && 'opacity-50'
                  )}
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Total Price
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
                    {computedTotalPrice !== null ? PESO.format(computedTotalPrice) : 'Not set'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Process Stage Selector */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-foreground">
          2. Select Assignment Stage
        </Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {STAGE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedStage === option.id;
            const isDisabled = !selectedLotDetails;

            return (
              <button
                key={option.id}
                type="button"
                disabled={isDisabled}
                onClick={() => handleStageSelect(option.id)}
                className={cn(
                  'relative flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isDisabled && 'cursor-not-allowed opacity-50',
                  !isDisabled && !isSelected && 'border-border hover:border-primary hover:bg-row-hover',
                  isSelected && 'border-primary bg-sidebar-accent shadow-sm'
                )}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <IconBox
                    size="sm"
                    className={cn(
                      'transition-colors',
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </IconBox>
                  <div
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground'
                    )}
                  >
                    {isSelected && <CheckCircle2 className="h-3 w-3" />}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{option.title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 3: Stage-specific forms */}
      {selectedStage && selectedLotDetails && (
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-foreground">
            3. {selectedStageOption?.title} Details
          </Label>

          {/* Account Settlement Stage Form (Contract Ledger) */}
          {selectedStage === 'account-settlement' && (
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              <div className="border-b border-border pb-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Contract Ledger Configuration
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure contract price, reservation downpayment, and installment schedule terms.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="total-contract-price" className="text-xs font-medium">
                      Total Contract Price (PHP)
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingPrice(!isEditingPrice)}
                      className="h-7 text-xs"
                    >
                      {isEditingPrice ? 'Use Calculated' : 'Edit Manually'}
                    </Button>
                  </div>

                  {isEditingPrice ? (
                    <div className="relative">
                      <PhilippinePeso className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="total-contract-price"
                        type="number"
                        min={1}
                        step="any"
                        value={totalContractPrice}
                        onChange={(e) => setTotalContractPrice(e.target.value)}
                        placeholder="Enter total contract price"
                        className="pl-9 font-mono text-xs tabular-nums"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-border bg-row-hover px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">Auto-calculated from lot area</span>
                      <span className="text-base font-bold font-mono text-foreground tabular-nums">
                        {formatCurrency(numericTcp)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ledger-downpayment" className="text-xs font-medium">
                    Downpayment / Reservation (PHP)
                  </Label>
                  <div className="relative">
                    <PhilippinePeso className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="ledger-downpayment"
                      type="number"
                      min={0}
                      step="any"
                      value={downpayment}
                      onChange={(e) => setDownpayment(e.target.value)}
                      placeholder="0"
                      className="pl-9 font-mono text-xs tabular-nums"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ledger-terms" className="text-xs font-medium">
                    Terms (Months)
                  </Label>
                  <Input
                    id="ledger-terms"
                    type="number"
                    min={1}
                    max={120}
                    value={termMonths}
                    onChange={(e) => setTermMonths(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="font-mono text-xs tabular-nums"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ledger-first-due" className="text-xs font-medium">
                    First Due Date
                  </Label>
                  <Input
                    id="ledger-first-due"
                    type="date"
                    value={firstDueDate}
                    onChange={(e) => handleFirstDueDateChange(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ledger-due-day" className="text-xs font-medium">
                    Monthly Due Day
                  </Label>
                  <Input
                    id="ledger-due-day"
                    type="number"
                    min={1}
                    max={31}
                    value={dueDay}
                    onChange={(e) => setDueDay(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                    className="font-mono text-xs tabular-nums"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ledger-penalty" className="text-xs font-medium">
                    Monthly Late Penalty (%)
                  </Label>
                  <Input
                    id="ledger-penalty"
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={penaltyRate}
                    onChange={(e) => setPenaltyRate(parseFloat(e.target.value) || 0)}
                    className="font-mono text-xs tabular-nums"
                  />
                </div>
              </div>

              <div className="bg-muted/40 border border-border rounded-lg p-4 text-xs space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                  Payment Breakdown
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Contract Price:</span>
                  <span className="tabular-nums font-mono font-medium text-foreground">
                    {formatCurrency(numericTcp)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Less Downpayment:</span>
                  <span className="tabular-nums font-mono font-medium text-foreground">
                    {formatCurrency(numericDp)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground border-t border-border pt-1">
                  <span>Balance to Finance:</span>
                  <span className="tabular-nums font-mono font-medium text-foreground">
                    {formatCurrency(financedPrincipal)}
                  </span>
                </div>
                <div className="flex justify-between text-foreground font-semibold border-t border-border pt-2 text-sm">
                  <span>Monthly Installment:</span>
                  <span className="tabular-nums font-mono text-primary font-bold">
                    {formatCurrency(computedMonthly)} / mo
                  </span>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  A contract ledger account will be created for this client with status &quot;Reserved&quot;. The installment plan and any signing downpayment will be immediately active in Billing.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Legal Processing Stage Form */}
          {selectedStage === 'legal-processing' && (
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <p className="font-semibold">Legal Processing Workflow</p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                    <li>The account will be marked &quot;Cleared by Billing&quot; and the lot &quot;Sold&quot;</li>
                    <li>Legal staff then prepare the DOAS and title record from the Legal page</li>
                    <li>Client is fully paid for this property</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* For Release Stage Form */}
          {selectedStage === 'for-release' && (
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              <div className="space-y-2">
                <Label htmlFor="title-number" className="text-sm font-medium">
                  Title Number (TCT / OCT) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title-number"
                  value={titleNumber}
                  onChange={(e) => setTitleNumber(e.target.value)}
                  placeholder="e.g., TCT-2024-12345"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Official title number registered for this property lot.
                </p>
              </div>

              <div className="rounded-lg border border-border p-3.5 space-y-2 bg-sidebar-accent/50">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isLegacyTransferred}
                    onChange={(e) => setIsLegacyTransferred(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium text-foreground">
                      Title is already on client&apos;s name
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Check if FDM already transferred the title into the client&apos;s name during historical 80%–90% settlement. Bypasses Deed of Absolute Sale (DOAS) drafting during release.
                    </p>
                  </div>
                </label>
              </div>

              <Alert>
                <Award className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <p className="font-semibold">Ready for Client Turnover</p>
                  <p className="mt-1 text-xs">
                    The account will be cleared by Billing and the title record staged directly as &quot;Ready for Claim&quot;.
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setBlockInput('');
            setLotInput('');
            setAreaInput('');
            setPriceInput('');
            setEditingMetric(null);
            setSelectedStage(null);
            setTitleNumber('');
            setIsLegacyTransferred(false);
            setTotalContractPrice('');
            setIsEditingPrice(false);
            setDownpayment('0');
            setTermMonths(36);
            setPenaltyRate(3.5);
          }}
          disabled={!hasAnyInput && !isSubmitting}
        >
          Clear Selection
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canProceed || !requirements.isComplete || needsTitleNumber || isSubmitting}
          title={!requirements.isComplete ? `Cannot assign: Missing ${formatMissingRequirements(requirements)}` : undefined}
          className="gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Assigning...
            </>
          ) : (
            'Assign Property'
          )}
        </Button>
      </div>
      </div>
    </div>
  );
}
