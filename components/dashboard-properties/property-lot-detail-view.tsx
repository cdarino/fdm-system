'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  X,
  UserRound,
  DollarSign,
  FileDown,
  Loader2,
  Archive,
  ArchiveRestore,
  Trash2,
  Maximize2,
  Tag,
  Pencil,
  Copy,
  Check,
  UserPlus,
  Plus,
  Receipt,
  Award,
  ExternalLink,
  MoreHorizontal,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Card } from '@/components/ui/card';
import { IconBox } from '@/components/ui/icon-box';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from '@/components/ui/popover';
import { getPropertyReportData } from '@/lib/actions/reports';
import { ClientAssignModal } from './client-assign-modal';
import { CreatePropertyLotModal } from './property-lot-create-modal';
import { DeletePropertyLotDialog } from './property-lot-delete-dialog';
import { usePropertyLots, lotLabel } from '@/lib/hooks/use-property-lots';
import { useSession } from '@/lib/hooks/use-session';
import { useMutation } from '@/lib/hooks/use-mutation';
import { toast } from 'sonner';
import { getArchiveEligibility } from '@/lib/utils/archive-rules';
import type {
  AccountStatus,
  PropertyLotWithClient,
  SubdivisionDisplayStatus,
} from '@/lib/types/property';
import { PROPERTY_STATUS_VARIANT } from '@/lib/status-colors';

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const AREA = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 });

const ACCOUNT_STATUS_VARIANT: Record<AccountStatus, 'success' | 'warning' | 'destructive' | 'muted' | 'purple'> = {
  Active: 'success',
  Matured: 'warning',
  Delinquent: 'destructive',
  Cancelled: 'muted',
  Forfeited: 'purple',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface LotMetricFloatingEditorProps {
  title: string;
  label: string;
  initialValue: number;
  placeholder?: string;
  onSave: (value: number) => Promise<void>;
}

function LotMetricFloatingEditor({
  title,
  label,
  initialValue,
  placeholder,
  onSave,
}: LotMetricFloatingEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rawValue, setRawValue] = useState(String(initialValue));

  function handleOpenChange(open: boolean) {
    if (open) {
      setRawValue(String(initialValue));
    }
    setIsOpen(open);
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (isSaving) return;

    const parsed = parseFloat(rawValue);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error('Please enter a valid positive number');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(parsed);
      setIsOpen(false);
    } catch {
      // Error feedback is handled by caller toast
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label={title}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-72 space-y-3 p-3"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <PopoverClose asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label="Close editor"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </PopoverClose>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              {label}
            </label>
            <Input
              type="number"
              step="any"
              min={0.01}
              autoFocus
              value={rawValue}
              onChange={(e) => setRawValue(e.target.value)}
              placeholder={placeholder ?? 'Enter value...'}
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <PopoverClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                disabled={isSaving}
              >
                Cancel
              </Button>
            </PopoverClose>
            <Button
              type="submit"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

interface LotTitleFloatingEditorProps {
  title: string;
  label: string;
  initialValue: string | null;
  placeholder?: string;
  onSave: (value: string | null) => Promise<void>;
}

function LotTitleFloatingEditor({
  title,
  label,
  initialValue,
  placeholder,
  onSave,
}: LotTitleFloatingEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rawValue, setRawValue] = useState(initialValue ?? '');

  function handleOpenChange(open: boolean) {
    if (open) {
      setRawValue(initialValue ?? '');
    }
    setIsOpen(open);
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (isSaving) return;

    const trimmed = rawValue.trim();
    setIsSaving(true);
    try {
      await onSave(trimmed.length > 0 ? trimmed : null);
      setIsOpen(false);
    } catch {
      // Error feedback is handled by caller toast
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label={title}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-72 space-y-3 p-3"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <PopoverClose asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label="Close editor"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </PopoverClose>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              {label}
            </label>
            <Input
              type="text"
              autoFocus
              value={rawValue}
              onChange={(e) => setRawValue(e.target.value)}
              placeholder={placeholder ?? 'e.g. T-123456'}
              className="h-8 text-xs font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <PopoverClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                disabled={isSaving}
              >
                Cancel
              </Button>
            </PopoverClose>
            <Button
              type="submit"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export interface PropertyLotDetailViewProps {
  lot: PropertyLotWithClient;
  onBack: () => void;
  onClose: () => void;
}

export function PropertyLotDetailView({ lot, onBack, onClose }: PropertyLotDetailViewProps) {
  const { createLot, updateLot, archiveLot, unarchiveLot, reopenLot, sites } = usePropertyLots();
  const { isSystemAdmin } = useSession();
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [draftArea, setDraftArea] = useState<number>(lot.area_size);
  const [draftPrice, setDraftPrice] = useState<number>(lot.price_per_sqm);
  const [draftTitle, setDraftTitle] = useState<string | null>(lot.title_number ?? null);

  // Sync local metrics when the selected lot changes
  useEffect(() => {
    setDraftArea(lot.area_size);
    setDraftPrice(lot.price_per_sqm);
    setDraftTitle(lot.title_number ?? null);
  }, [lot.property_id, lot.site_id, lot.block_number, lot.lot_number, lot.area_size, lot.price_per_sqm, lot.title_number]);

  const isRegistered = Boolean(lot.property_id);
  const displayStatus: SubdivisionDisplayStatus = isRegistered ? lot.status : 'Closed';
  const isArchived = Boolean(lot.is_archived);
  const eligibility = getArchiveEligibility(isArchived, lot.archived_at);

  const forfeitedAt = lot.forfeited_account?.forfeited_at;
  const daysRemaining = forfeitedAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(forfeitedAt).getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now()) /
            (24 * 60 * 60 * 1000)
        )
      )
    : 0;
  const isGracePeriodActive = daysRemaining > 0;

  const currentArea = isRegistered ? lot.area_size : draftArea;
  const currentPrice = isRegistered ? lot.price_per_sqm : draftPrice;
  const currentTitle = isRegistered ? (lot.title_number ?? null) : draftTitle;
  const calculatedTotal = currentArea * currentPrice;

  const { state: archiveState, execute: runArchive } = useMutation(archiveLot, {
    onSuccess: () => {
      toast.success(`${lotLabel(lot)} archived successfully`);
    },
  });

  const { state: unarchiveState, execute: runUnarchive } = useMutation(unarchiveLot, {
    onSuccess: () => {
      toast.success(`${lotLabel(lot)} restored successfully`);
    },
  });

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`Copied "${text}" to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleUpdateArea(nextArea: number) {
    if (!isRegistered) {
      setDraftArea(nextArea);
      toast.success('Area size updated');
      return;
    }

    const res = await updateLot(lot.property_id, { area_size: nextArea });
    if (!res.success) {
      toast.error(res.error || 'Failed to update area size');
      throw new Error(res.error || 'Failed to update area size');
    }
    toast.success('Area size updated');
  }

  async function handleUpdatePrice(nextPrice: number) {
    if (!isRegistered) {
      setDraftPrice(nextPrice);
      toast.success('Price per sqm updated');
      return;
    }

    const res = await updateLot(lot.property_id, { price_per_sqm: nextPrice });
    if (!res.success) {
      toast.error(res.error || 'Failed to update price per sqm');
      throw new Error(res.error || 'Failed to update price per sqm');
    }
    toast.success('Price per sqm updated');
  }

  async function handleUpdateTitle(nextTitle: string | null) {
    if (!isRegistered) {
      setDraftTitle(nextTitle);
      toast.success('Title number updated');
      return;
    }

    const res = await updateLot(lot.property_id, { title_number: nextTitle });
    if (!res.success) {
      toast.error(res.error || 'Failed to update title number');
      throw new Error(res.error || 'Failed to update title number');
    }
    toast.success('Title number updated');
  }

  async function handleEnsureRegistered(): Promise<string | null> {
    if (lot.property_id) return lot.property_id;
    const res = await createLot({
      site_id: lot.site_id,
      location: lot.location,
      block_number: lot.block_number,
      lot_number: lot.lot_number,
      area_size: currentArea,
      price_per_sqm: currentPrice,
      status: 'Open',
      title_number: currentTitle ?? undefined,
    });
    if (!res.success) {
      toast.error(res.error || 'Failed to open property lot');
      return null;
    }
    return res.data.property_id;
  }

  async function handleExportPdf() {
    if (!isRegistered) return;
    setIsExportingPdf(true);
    try {
      const data = await getPropertyReportData(lot.property_id);
      // Loaded on demand so jsPDF stays out of the page bundle.
      const { generatePropertyPdfReport } = await import('@/lib/reports/pdf-property-report');
      generatePropertyPdfReport(data);
      toast.success('Property PDF report generated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate property report');
    } finally {
      setIsExportingPdf(false);
    }
  }

  // Reopen forfeited lot for sale with early override when grace period is active
  async function handleConfirmReopen() {
    if (isReopening) return;
    setIsReopening(true);
    try {
      const result = await reopenLot(lot.property_id, isGracePeriodActive);
      if (result.success) {
        toast.success(`${lotLabel(lot)} reopened for sale`);
        setIsReopenDialogOpen(false);
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reopen lot');
    } finally {
      setIsReopening(false);
    }
  }

  const effectiveLotForModal: PropertyLotWithClient = {
    ...lot,
    area_size: currentArea,
    price_per_sqm: currentPrice,
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-card">
      {/* Header with back navigation, single lot/site identity, and overflow actions */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-row-hover hover:text-foreground"
            aria-label="Back to lot list"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-sm font-semibold leading-tight text-foreground">
                {lotLabel(lot)}
              </h2>
              {isArchived && (
                <Badge variant="muted" shape="pill">
                  Archived
                </Badge>
              )}
            </div>
            <p className="truncate text-[11px] text-muted-foreground">{lot.location}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isRegistered && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:bg-row-hover hover:text-foreground"
                  aria-label="Lot actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  disabled={isExportingPdf}
                  icon={
                    isExportingPdf ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )
                  }
                  onSelect={handleExportPdf}
                >
                  Export PDF report
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {isArchived ? (
                  <>
                    <DropdownMenuItem
                      disabled={unarchiveState.status === 'pending'}
                      icon={<ArchiveRestore className="h-4 w-4" />}
                      onSelect={() => runUnarchive(lot.property_id)}
                    >
                      Restore lot
                    </DropdownMenuItem>
                    {isSystemAdmin && (
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={!eligibility.isEligibleForDelete}
                        icon={<Trash2 className="h-4 w-4" />}
                        onSelect={() => {
                          if (eligibility.isEligibleForDelete) {
                            setIsDeleteDialogOpen(true);
                          }
                        }}
                      >
                        {eligibility.isEligibleForDelete
                          ? 'Delete lot'
                          : `Delete (${eligibility.tooltipReason ?? 'locked'})`}
                      </DropdownMenuItem>
                    )}
                  </>
                ) : (
                  <DropdownMenuItem
                    disabled={archiveState.status === 'pending'}
                    icon={<Archive className="h-4 w-4" />}
                    onSelect={() => runArchive(lot.property_id)}
                  >
                    Archive lot
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:bg-row-hover hover:text-foreground"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto p-4">
        {/* Top Region: Structured Basic Lot Details (ClientDetailSidebar style) */}
        <Card className="overflow-hidden">
          <div className="space-y-0.5 p-1.5">
            {/* Area Size Row */}
            <div className="group flex items-center justify-between gap-2 rounded-lg p-2 transition-colors hover:bg-row-hover">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <Maximize2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Area size</p>
                  <p className="truncate text-sm font-medium text-foreground">
                    {AREA.format(currentArea)} sqm
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => handleCopy(`${AREA.format(currentArea)} sqm`, 'area')}
                  aria-label="Copy area size"
                >
                  {copiedId === 'area' ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
                <LotMetricFloatingEditor
                  title="Edit area size"
                  label="Area size (sqm)"
                  initialValue={currentArea}
                  placeholder="250"
                  onSave={handleUpdateArea}
                />
              </div>
            </div>

            {/* Price per Sqm Row */}
            <div className="group flex items-center justify-between gap-2 rounded-lg p-2 transition-colors hover:bg-row-hover">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Price per sqm</p>
                  <p className="truncate text-sm font-medium text-foreground">
                    {PESO.format(currentPrice)}/sqm
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => handleCopy(PESO.format(currentPrice), 'price')}
                  aria-label="Copy price per sqm"
                >
                  {copiedId === 'price' ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
                <LotMetricFloatingEditor
                  title="Edit price per sqm"
                  label="Price per sqm (₱)"
                  initialValue={currentPrice}
                  placeholder="6500"
                  onSave={handleUpdatePrice}
                />
              </div>
            </div>

            {/* Computed Base Price Row */}
            <div className="group flex items-center justify-between gap-2 rounded-lg border-t border-border p-2 transition-colors hover:bg-row-hover">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <DollarSign className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Base contract price
                  </p>
                  <p className="truncate text-sm font-bold text-foreground">
                    {PESO.format(calculatedTotal)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {AREA.format(currentArea)} sqm × {PESO.format(currentPrice)}/sqm
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => handleCopy(PESO.format(calculatedTotal), 'total')}
                  aria-label="Copy base contract price"
                >
                  {copiedId === 'total' ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="border-t border-border" />

        {/* Bottom Region: Status-Dependent Section with contextual status badge */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-foreground">
              {displayStatus === 'Reserved'
                ? 'Reservation & ledger'
                : displayStatus === 'Sold'
                  ? 'Ownership & land title'
                  : displayStatus === 'Forfeited'
                    ? 'Forfeiture & grace period'
                    : 'Client assignment'}
            </h3>
            {displayStatus === 'Closed' ? (
              <Badge variant="muted" shape="pill">
                Closed
              </Badge>
            ) : (
              <Badge variant={PROPERTY_STATUS_VARIANT[displayStatus]} shape="pill" dot>
                {displayStatus}
              </Badge>
            )}
          </div>

          {(displayStatus === 'Closed' || displayStatus === 'Open') && (
            <Card padding="sm" className="space-y-3 bg-row-hover">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  {displayStatus === 'Closed'
                    ? 'Plot not yet opened for sale'
                    : 'Available for acquisition'}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {displayStatus === 'Closed'
                    ? 'Choose a client to automatically open this subdivision plot and start the property assignment workflow, or open the lot for sale first.'
                    : 'No client is assigned to this lot. Select a client to start the property assignment workflow.'}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsAssignModalOpen(true)}
                  className="w-full gap-1.5 text-xs"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Assign Client</span>
                </Button>

                {displayStatus === 'Closed' && (
                  <Button
                    type="button"
                    variant="quiet"
                    size="sm"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="w-full gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Open for Sale</span>
                  </Button>
                )}
              </div>
            </Card>
          )}

          {displayStatus === 'Forfeited' && (
            <>
              {lot.client && (
                <Card padding="sm" className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <IconBox size="md" shape="rounded-xl" className="shrink-0 font-semibold">
                      {initials(lot.client.full_name) || <UserRound className="h-4 w-4" />}
                    </IconBox>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {lot.client.full_name}
                        </p>
                        <Badge variant="purple" shape="pill" className="text-[10px]">
                          Previous Buyer
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {lot.client.address || 'Forfeited buyer'}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="quiet" size="sm" className="h-7 shrink-0 gap-1 text-xs">
                    <Link href={`/dashboard/clients/${lot.client.client_id}`}>
                      <span>Profile</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </Card>
              )}

              <Card padding="sm" className="space-y-3 bg-row-hover">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">
                      {isGracePeriodActive ? 'Grace Period Active' : 'Grace Period Ended'}
                    </p>
                    <Badge variant={isGracePeriodActive ? 'purple' : 'success'} shape="pill">
                      {isGracePeriodActive
                        ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`
                        : 'Eligible for resale'}
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {isGracePeriodActive
                      ? `This lot was forfeited${
                          lot.forfeited_account?.forfeited_at
                            ? ` on ${new Date(lot.forfeited_account.forfeited_at).toLocaleDateString()}`
                            : ''
                        }. A 30-day legal grace period applies before returning to Open inventory.`
                      : 'The 30-day redemption grace period has passed. The lot can now be reopened for sale.'}
                  </p>
                  {lot.forfeited_account?.forfeiture_reason && (
                    <p className="text-xs italic text-muted-foreground">
                      Reason: {lot.forfeited_account.forfeiture_reason}
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsReopenDialogOpen(true)}
                  className="w-full gap-1.5 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reopen Lot for Sale</span>
                </Button>
              </Card>
            </>
          )}

          {displayStatus === 'Reserved' && (
            <>
              {/* Assigned Client Card (Read-only with profile link) */}
              {lot.client ? (
                <Card padding="sm" className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <IconBox size="md" shape="rounded-xl" className="shrink-0 font-semibold">
                      {initials(lot.client.full_name) || <UserRound className="h-4 w-4" />}
                    </IconBox>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {lot.client.full_name}
                        </p>
                        <Badge variant="outline" shape="pill" className="text-[10px]">
                          {lot.client.status}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {lot.client.address || 'Principal Buyer'}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="quiet" size="sm" className="h-7 shrink-0 gap-1 text-xs">
                    <Link href={`/dashboard/clients/${lot.client.client_id}`}>
                      <span>Profile</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </Card>
              ) : (
                <Card padding="sm" className="text-xs text-muted-foreground">
                  Reserved lot — buyer record linked via installment ledger.
                </Card>
              )}

              {/* Active Installment Ledger Details */}
              {lot.active_account && (
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border bg-row-hover px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Receipt className="h-3.5 w-3.5 text-primary" />
                      <span>Installment Ledger</span>
                    </div>
                    <Badge
                      variant={ACCOUNT_STATUS_VARIANT[lot.active_account.status] ?? 'muted'}
                      shape="pill"
                    >
                      {lot.active_account.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 text-xs">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Total Contract Price</p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">
                        {PESO.format(lot.active_account.total_contract_price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Remaining Balance</p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">
                        {PESO.format(lot.active_account.remaining_balance)}
                      </p>
                    </div>
                  </div>

                  {lot.active_account.parties && lot.active_account.parties.length > 0 && (
                    <div className="border-t border-border px-3 py-2 space-y-1.5">
                      <p className="text-[11px] font-medium text-muted-foreground">Account Parties</p>
                      {lot.active_account.parties.map((party) => (
                        <div
                          key={party.client_id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="truncate font-medium text-foreground">
                            {party.client?.full_name ?? 'Buyer'}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {party.role} ({party.ownership_percentage}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </>
          )}

          {displayStatus === 'Sold' && (
            <>
              {/* Assigned Client Card (Read-only with profile link) */}
              {lot.client ? (
                <Card padding="sm" className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <IconBox size="md" shape="rounded-xl" className="shrink-0 font-semibold">
                      {initials(lot.client.full_name) || <UserRound className="h-4 w-4" />}
                    </IconBox>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {lot.client.full_name}
                        </p>
                        <Badge variant="outline" shape="pill" className="text-[10px]">
                          {lot.client.status}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {lot.client.address || 'Registered Owner'}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="quiet" size="sm" className="h-7 shrink-0 gap-1 text-xs">
                    <Link href={`/dashboard/clients/${lot.client.client_id}`}>
                      <span>Profile</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </Card>
              ) : (
                <Card padding="sm" className="text-xs text-muted-foreground">
                  Sold lot — owner record linked via land title.
                </Card>
              )}
            </>
          )}

          {/* Land Title (TCT) Details Card for Open, Reserved, Sold, and Forfeited */}
          {(displayStatus === 'Open' ||
            displayStatus === 'Reserved' ||
            displayStatus === 'Sold' ||
            displayStatus === 'Forfeited') && (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-row-hover px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Award className="h-3.5 w-3.5 text-primary" />
                  <span>Land Title</span>
                </div>
                {lot.title ? (
                  <Badge variant="info" shape="pill">
                    {lot.title.status}
                  </Badge>
                ) : currentTitle ? (
                  <Badge variant="outline" shape="pill" className="text-[10px]">
                    TCT Recorded
                  </Badge>
                ) : null}
              </div>

              <div className="group flex items-center justify-between gap-2 p-3 transition-colors hover:bg-row-hover">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Title Number</p>
                  <p className="truncate text-sm font-semibold text-foreground font-mono">
                    {currentTitle || (
                      <span className="italic font-normal font-sans text-muted-foreground">
                        No TCT recorded
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  {currentTitle && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => handleCopy(currentTitle, 'title_number')}
                      aria-label="Copy title number"
                    >
                      {copiedId === 'title_number' ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                  <LotTitleFloatingEditor
                    title="Edit title number"
                    label="Transfer Certificate of Title (TCT)"
                    initialValue={currentTitle}
                    placeholder="e.g. T-123456"
                    onSave={handleUpdateTitle}
                  />
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <ClientAssignModal
        open={isAssignModalOpen}
        onOpenChange={setIsAssignModalOpen}
        lot={effectiveLotForModal}
        onEnsureRegistered={handleEnsureRegistered}
      />

      {!isRegistered && (
        <CreatePropertyLotModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          sites={sites}
          initialValues={{
            site_id: lot.site_id ?? undefined,
            block_number: lot.block_number,
            lot_number: lot.lot_number,
            area_size: currentArea,
            price_per_sqm: currentPrice,
            title_number: currentTitle ?? undefined,
          }}
        />
      )}

      {isRegistered && (
        <DeletePropertyLotDialog
          lot={lot}
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          onSuccess={() => onBack()}
        />
      )}

      <AlertDialog
        open={isReopenDialogOpen}
        onOpenChange={(open) => !isReopening && setIsReopenDialogOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isGracePeriodActive ? 'Reopen Lot Early?' : 'Reopen Lot for Sale?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isGracePeriodActive
                ? `The legal 30-day grace period is still active (${daysRemaining} day${
                    daysRemaining === 1 ? '' : 's'
                  } remaining). Reopening early will terminate the holding window and make this lot immediately available for new buyers. Proceed anyway?`
                : 'The 30-day grace period has elapsed. This lot will be restored to Open status and made available for new buyers.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReopening}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmReopen();
              }}
              disabled={isReopening}
            >
              {isReopening && <Loader2 className="h-4 w-4 animate-spin" />}
              {isGracePeriodActive ? 'Reopen Lot Early' : 'Reopen Lot'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
