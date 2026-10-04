'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { IconBox } from '@/components/ui/icon-box';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2,
  FileText,
  Receipt,
  Award,
  Loader2,
  AlertTriangle,
  Info,
  DollarSign,
  ChevronDown,
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
import {
  BlockLotDialog,
  type SelectedLotDetails,
} from './block-lot-dialog';
import type { ClientWithDetails } from '@/lib/types/client';
import type { Site, SiteWithLots } from '@/lib/types/property';

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

type AssignmentStage = 'reserved' | 'title-in-process' | 'to-claim' | null;

interface StageOption {
  id: AssignmentStage;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresComplete: boolean;
}

const STAGE_OPTIONS: StageOption[] = [
  {
    id: 'reserved',
    title: 'Reserved',
    description: 'Client will be or is currently paying via installment',
    icon: Receipt,
    requiresComplete: true,
  },
  {
    id: 'title-in-process',
    title: 'Title in Process',
    description: 'Client is fully paid and title processing has started',
    icon: FileText,
    requiresComplete: true,
  },
  {
    id: 'to-claim',
    title: 'To Claim',
    description: 'Title is fully processed and awaiting pickup at office',
    icon: Award,
    requiresComplete: false,
  },
];

interface PropertyAssignmentWizardProps {
  client: ClientWithDetails;
  preSelectedPropertyId?: string;
  onSuccess?: () => void;
}

export function PropertyAssignmentWizard({
  client,
  preSelectedPropertyId,
  onSuccess,
}: PropertyAssignmentWizardProps) {
  const router = useRouter();
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [siteData, setSiteData] = useState<SiteWithLots | null>(null);
  const [isLoadingSite, setIsLoadingSite] = useState(false);
  const [selectedLotDetails, setSelectedLotDetails] = useState<SelectedLotDetails | null>(null);
  const [isLotDialogOpen, setIsLotDialogOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<AssignmentStage>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reserved stage state
  const [totalContractPrice, setTotalContractPrice] = useState<string>('');
  const [isEditingPrice, setIsEditingPrice] = useState(false);

  // To Claim stage state
  const [titleNumber, setTitleNumber] = useState<string>('');

  const [sites, setSites] = useState<Site[]>([]);
  const [isLoadingPreSelected, setIsLoadingPreSelected] = useState(false);

  const requirements = getClientRequirements(client, client.client_document);

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

        const isRecordOnly = !lot.boundary;
        setSelectedLotDetails({
          siteId,
          siteName: lot.location,
          blockNumber: lot.block_number,
          lotNumber: lot.lot_number,
          areaSize: lot.area_size,
          pricePerSqm: lot.price_per_sqm,
          totalPrice: lot.area_size * lot.price_per_sqm,
          existingPropertyId: lot.property_id,
          isRecordOnly,
          isUnopenedPlot: false,
          isManualNew: false,
        });
        setTotalContractPrice((lot.area_size * lot.price_per_sqm).toString());
      })
      .catch((err) => {
        console.error('Failed to load pre-selected property:', err);
      })
      .finally(() => setIsLoadingPreSelected(false));
  }, [preSelectedPropertyId]);

  function handleSiteChange(newSiteId: string) {
    setSelectedSiteId(newSiteId);
    if (selectedLotDetails?.siteId !== newSiteId) {
      setSelectedLotDetails(null);
      setTotalContractPrice('');
    }
  }

  function handleSelectLot(details: SelectedLotDetails) {
    setSelectedLotDetails(details);
    setTotalContractPrice(details.totalPrice.toString());
    setIsEditingPrice(false);
  }

  function handleStageSelect(stage: AssignmentStage) {
    setSelectedStage((current) => (current === stage ? null : stage));
    setTitleNumber('');
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

      // If unopened plot or new lot, create/open it in property_lot first
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

      if (selectedStage === 'reserved') {
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
          ? `Opened Block ${selectedLotDetails.blockNumber} Lot ${selectedLotDetails.lotNumber} and assigned as Reserved`
          : `Property assigned as Reserved with installment plan`;
        toast.success(actionText);
      } else if (selectedStage === 'title-in-process') {
        const result = await assignPropertyFullyPaid(targetPropertyId, client.client_id, null);

        if (!result.success) {
          throw new Error(result.error || 'Failed to assign property');
        }

        const actionText = selectedLotDetails.isUnopenedPlot
          ? `Opened Block ${selectedLotDetails.blockNumber} Lot ${selectedLotDetails.lotNumber} with title now in processing`
          : `Property assigned with title now in processing`;
        toast.success(actionText);
      } else if (selectedStage === 'to-claim') {
        if (!titleNumber.trim()) {
          toast.error('Title number is required for To Claim stage');
          return;
        }

        const result = await assignPropertyFullyPaid(targetPropertyId, client.client_id, titleNumber.trim());

        if (!result.success) {
          throw new Error(result.error || 'Failed to assign property');
        }

        const actionText = selectedLotDetails.isUnopenedPlot
          ? `Opened Block ${selectedLotDetails.blockNumber} Lot ${selectedLotDetails.lotNumber} with title ready for claim`
          : `Property assigned with title ready for claim`;
        toast.success(actionText);
      }

      // Reset form
      setSelectedLotDetails(null);
      setSelectedStage(null);
      setTitleNumber('');

      // Refresh page to show updated data
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
  const needsTitleNumber = selectedStage === 'to-claim' && !titleNumber.trim();

  return (
    <div className="space-y-5">
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
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Site Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="site-selector" className="text-xs text-muted-foreground font-medium">
                Subdivision Site
              </Label>
              <Select value={selectedSiteId} onValueChange={handleSiteChange}>
                <SelectTrigger id="site-selector" className="h-9">
                  <SelectValue placeholder="Choose a development site..." />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.site_id} value={site.site_id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Block & Lot Dialog Button */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">
                Block & Lot
              </Label>
              <Button
                type="button"
                variant="outline"
                disabled={!selectedSiteId || isLoadingSite}
                onClick={() => setIsLotDialogOpen(true)}
                className="h-9 w-full justify-between text-left font-normal border-input bg-card hover:bg-row-hover px-3"
              >
                <span className="truncate text-xs sm:text-sm">
                  {isLoadingSite ? (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading site...
                    </span>
                  ) : selectedLotDetails && selectedLotDetails.siteId === selectedSiteId ? (
                    <span className="font-semibold text-foreground">
                      Block {selectedLotDetails.blockNumber} Lot {selectedLotDetails.lotNumber}
                      <span className="ml-1.5 font-normal text-muted-foreground text-xs">
                        ({selectedLotDetails.areaSize} sqm · ₱{selectedLotDetails.pricePerSqm.toLocaleString()}/sqm)
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {!selectedSiteId ? 'Select a site first...' : 'Choose Block & Lot...'}
                    </span>
                  )}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
              </Button>
            </div>
          </div>
        )}

        <BlockLotDialog
          open={isLotDialogOpen}
          onOpenChange={setIsLotDialogOpen}
          siteData={siteData}
          selectedLot={selectedLotDetails}
          onSelectLot={handleSelectLot}
        />

        {/* Total Contract Price Display Only */}
        {selectedLotDetails && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total Contract Price
            </span>
            <span className="text-base font-bold text-foreground">
              {PESO.format(selectedLotDetails.totalPrice)}
            </span>
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
                {option.requiresComplete && (
                  <Badge
                    variant="outline"
                    className="mt-1 text-[10px] uppercase tracking-wider"
                  >
                    Requires Complete Profile
                  </Badge>
                )}
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

          {/* Requirements Warning for Reserved and Title in Process */}
          {needsRequirements && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold">Missing Requirements:</p>
                <p className="mt-1 text-sm">
                  {formatMissingRequirements(requirements)}
                </p>
                <p className="mt-2 text-xs">
                  Complete the client profile and upload required documents before assigning this property.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Reserved Stage Form */}
          {selectedStage === 'reserved' && (
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
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3">
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

          {/* Title in Process Stage Form */}
          {selectedStage === 'title-in-process' && (
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <p className="font-semibold">Title Processing Workflow</p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                    <li>Property will be marked as &quot;Sold&quot;</li>
                    <li>A land title record will be created with status &quot;Processing&quot;</li>
                    <li>No title number required at this stage</li>
                    <li>Client is fully paid for this property</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* To Claim Stage Form */}
          {selectedStage === 'to-claim' && (
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              <div className="space-y-2">
                <Label htmlFor="title-number" className="text-sm font-medium">
                  Title Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title-number"
                  value={titleNumber}
                  onChange={(e) => setTitleNumber(e.target.value)}
                  placeholder="e.g., TCT-2024-12345"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the official title number issued by authorities
                </p>
              </div>

              <Alert>
                <Award className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <p className="font-semibold">Ready for Client Pickup</p>
                  <p className="mt-1 text-xs">
                    Property will be marked as &quot;Sold&quot; with title status &quot;Ready for Release&quot;. This stage bypasses profile requirements as the title is already processed.
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
            setSelectedLotDetails(null);
            setSelectedStage(null);
            setTitleNumber('');
          }}
          disabled={!selectedLotDetails && !selectedStage && !isSubmitting}
        >
          Clear Selection
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canProceed || needsRequirements || needsTitleNumber || isSubmitting}
          className="gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Assigning...
            </>
          ) : (
            <>
              Assign Property
              {needsRequirements && (
                <Badge variant="destructive" className="ml-1 text-[10px]">
                  Requirements Missing
                </Badge>
              )}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
