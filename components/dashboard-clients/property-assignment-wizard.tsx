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
  DollarSign,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  getPropertyLotById,
  createPropertyLot,
  assignPropertyParties,
  assignPropertyFullyPaid,
} from '@/lib/actions/properties';
import { getSites, getSiteWithLots } from '@/lib/actions/sites';
import { getClientRequirements, formatMissingRequirements } from '@/lib/utils/client-requirements';
import { PROPERTY_STATUS_VARIANT } from '@/lib/status-colors';
import {
  BlockLotPopup,
  evaluateLotStatus,
  type SelectedLotDetails,
} from './block-lot-popup';
import { useClientDetail } from '@/lib/hooks/use-client-detail';
import type { Site, SiteWithLots } from '@/lib/types/property';

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
}

export function PropertyAssignmentWizard({
  preSelectedPropertyId,
  onSuccess,
}: PropertyAssignmentWizardProps) {
  const { client } = useClientDetail();
  const router = useRouter();
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [siteData, setSiteData] = useState<SiteWithLots | null>(null);
  const [isLoadingSite, setIsLoadingSite] = useState(false);

  // Inline Block, Lot, Area & Price state
  const [blockInput, setBlockInput] = useState<string>('');
  const [lotInput, setLotInput] = useState<string>('');
  const [areaInput, setAreaInput] = useState<string>('');
  const [priceInput, setPriceInput] = useState<string>('');
  const [isLotPopupOpen, setIsLotPopupOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<'area' | 'price' | null>(null);

  const [selectedStage, setSelectedStage] = useState<AssignmentStage>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Account Settlement stage state
  const [totalContractPrice, setTotalContractPrice] = useState<string>('');
  const [isEditingPrice, setIsEditingPrice] = useState(false);

  // For Release stage state
  const [titleNumber, setTitleNumber] = useState<string>('');
  const [isLegacyTransferred, setIsLegacyTransferred] = useState<boolean>(false);

  const [sites, setSites] = useState<Site[]>([]);
  const [isLoadingPreSelected, setIsLoadingPreSelected] = useState(false);

  const requirements = getClientRequirements(client, client.client_document);

  const siteOptions = useMemo(
    () =>
      sites.map((site) => ({
        value: site.site_id,
        label: site.name,
        description: site.description ?? undefined,
      })),
    [sites]
  );

  // Load sites on mount
  useEffect(() => {
    getSites()
      .then((data) => {
        setSites(data);
        if (data.length === 1 && !selectedSiteId) {
          setSelectedSiteId(data[0].site_id);
        }
      })
      .catch((err) => console.error('Failed to load sites:', err));
  }, [selectedSiteId]);

  // Load site data when site selection changes
  useEffect(() => {
    if (!selectedSiteId) {
      setSiteData(null);
      return;
    }

    let isMounted = true;
    setIsLoadingSite(true);
    getSiteWithLots(selectedSiteId)
      .then((data) => {
        if (isMounted) setSiteData(data);
      })
      .catch((err) => {
        console.error('Failed to load site details:', err);
        if (isMounted) setSiteData(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSite(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSiteId]);

  // Pre-load lot if passed via query params (e.g. from subdivision map)
  useEffect(() => {
    if (!preSelectedPropertyId) return;

    setIsLoadingPreSelected(true);
    getPropertyLotById(preSelectedPropertyId)
      .then((lot) => {
        const siteId = lot.site_id || '';
        if (siteId) setSelectedSiteId(siteId);
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
    () => evaluateLotStatus(siteData, blockNumber, lotNumber),
    [siteData, blockNumber, lotNumber]
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
      !siteData ||
      !hasValidBlockAndLot ||
      !evaluatedStatus ||
      evaluatedStatus.type === 'already_assigned' ||
      computedTotalPrice === null
    ) {
      return null;
    }

    const base = {
      siteId: siteData.site_id,
      siteName: siteData.name,
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
    siteData,
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
      siteData,
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

  function handleSiteChange(newSiteId: string) {
    setSelectedSiteId(newSiteId);
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
          site_id: selectedLotDetails.siteId,
          location: selectedLotDetails.siteName,
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

        const result = await assignPropertyParties(
          targetPropertyId,
          [
            {
              client_id: client.client_id,
              role: 'Principal Buyer',
              ownership_percentage: 100,
              is_primary: true,
            },
          ],
          'Reserved',
          { total_contract_price: tcp }
        );

        if (!result) {
          throw new Error('Failed to assign property');
        }

        const actionText = selectedLotDetails.isUnopenedPlot
          ? `Opened Block ${selectedLotDetails.blockNumber} Lot ${selectedLotDetails.lotNumber} and assigned under Account Settlement`
          : `Property assigned under Account Settlement with installment plan`;
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

  const canProceed = Boolean(selectedLotDetails) && Boolean(selectedStage);
  const selectedStageOption = STAGE_OPTIONS.find((opt) => opt.id === selectedStage);
  const needsRequirements = selectedStageOption?.requiresComplete && !requirements.isComplete;
  const needsTitleNumber = selectedStage === 'for-release' && !titleNumber.trim();
  const hasAnyInput = Boolean(blockInput || lotInput || areaInput || priceInput || selectedStage);

  return (
    <div className="space-y-5">
      {!requirements.isComplete && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="space-y-1">
            <p className="font-semibold text-foreground">Client requirements incomplete</p>
            <p className="text-xs">
              Missing: <span className="font-medium">{formatMissingRequirements(requirements)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              You can prepare the assignment details below, but finalizing the assignment is locked until these requirements are completed.
            </p>
          </AlertDescription>
        </Alert>
      )}

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
              {/* Searchable Site Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="site-selector" className="text-xs text-muted-foreground font-medium">
                  Subdivision Site
                </Label>
                <SearchableSelect
                  id="site-selector"
                  options={siteOptions}
                  value={selectedSiteId}
                  onValueChange={handleSiteChange}
                  placeholder="Choose a development site..."
                  searchPlaceholder="Search site name or address..."
                  emptyMessage="No matching sites found."
                />
              </div>

              {/* Inline Block & Lot Fields with Focus Grid Popup */}
              <BlockLotPopup
                open={isLotPopupOpen && Boolean(selectedSiteId) && !isLoadingSite}
                onOpenChange={setIsLotPopupOpen}
                siteData={siteData}
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
                      disabled={!selectedSiteId || isLoadingSite}
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
                      disabled={!selectedSiteId || isLoadingSite}
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
                  {isLoadingSite ? (
                    <Badge variant="muted" shape="pill">
                      Loading site...
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
                  {isLoadingSite && 'Fetching site lots and subdivision plan...'}
                  {!isLoadingSite &&
                    !evaluatedStatus &&
                    (selectedSiteId
                      ? 'Focus Block or Lot to pick from grid, or enter numbers manually.'
                      : 'Select a subdivision site first.')}
                  {evaluatedStatus?.type === 'open' &&
                    (evaluatedStatus.isRecordOnly
                      ? 'Selects existing open lot (no digital plat on file).'
                      : 'Selects existing open lot from site plan.')}
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
                      placeholder="250"
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
                      placeholder="3500"
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

          {/* Account Settlement Stage Form */}
          {selectedStage === 'account-settlement' && (
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="total-contract-price" className="text-sm font-medium">
                    Total Contract Price
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
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="total-contract-price"
                      type="number"
                      value={totalContractPrice}
                      onChange={(e) => setTotalContractPrice(e.target.value)}
                      placeholder="Enter total contract price"
                      className="pl-9"
                      disabled={needsRequirements}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-row-hover px-4 py-3">
                    <span className="text-sm text-muted-foreground">Auto-calculated from lot area</span>
                    <span className="text-lg font-bold text-foreground">
                      ₱{parseFloat(totalContractPrice || '0').toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  A ledger account will be created for this client with status &quot;Reserved&quot;. The client will be marked as having an active installment plan.
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
          }}
          disabled={!hasAnyInput && !isSubmitting}
        >
          Clear Selection
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canProceed || needsRequirements || needsTitleNumber || isSubmitting}
          title={needsRequirements ? `Cannot assign: Missing ${formatMissingRequirements(requirements)}` : undefined}
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
  );
}
