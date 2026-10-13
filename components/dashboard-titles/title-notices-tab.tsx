'use client';

import { useRef, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  MoreVertical,
  Paperclip,
  RotateCcw,
  Send,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatActivityTime } from '@/lib/format-activity-time';
import { useLandTitles, lotRefLabel } from '@/lib/hooks/use-land-titles';
import { useMutation } from '@/lib/hooks/use-mutation';
import { TitleReleaseDialog } from './title-release-dialog';
import { generateNoticePdf } from '@/lib/reports/pdf-notice-letter';
import { calculateStorageFee } from '@/lib/storage-fee';
import { DOCUMENT_FILE_ACCEPT } from '@/lib/validations/document';
import type { LandTitle, LandTitleNotice, TitleStatus } from '@/lib/types/title';

const DATE_FORMAT = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });

interface TitleNoticesTabProps {
  title: LandTitle;
  notices: LandTitleNotice[];
  onNoticesChange: (notices: LandTitleNotice[]) => void;
  isLoadingNotices: boolean;
  onStatusChange: (status: TitleStatus) => void;
  isUpdatingStatus: boolean;
  onTitleReleased?: (updated: LandTitle) => void;
}

export function TitleNoticesTab({
  title,
  notices,
  onNoticesChange,
  isLoadingNotices,
  onStatusChange,
  isUpdatingStatus,
  onTitleReleased,
}: TitleNoticesTabProps) {
  const {
    recordNotice,
    resolveNotice,
    undoNoticeStatus,
    uploadNoticeRts,
    getNoticeRtsUrl,
    getNoticeProofUrl,
    deleteNoticeRts,
    canEdit,
  } = useLandTitles();

  const statusFileInputRef = useRef<HTMLInputElement>(null);

  const [confirmReleaseOpen, setConfirmReleaseOpen] = useState(false);
  const [confirmStartNotice, setConfirmStartNotice] = useState<1 | 2 | 3 | null>(null);
  const [confirmUndoNotice, setConfirmUndoNotice] = useState<1 | 2 | 3 | null>(null);

  const [noticeStatusChoice, setNoticeStatusChoice] = useState<'received' | 'returned_to_sender'>('received');
  const [statusNotesInput, setStatusNotesInput] = useState('');
  const [statusFileInput, setStatusFileInput] = useState<File | null>(null);

  const [isGeneratingNotice, setIsGeneratingNotice] = useState<number | null>(null);

  const storageFee = calculateStorageFee(title);
  const isReleased = title.status === 'Released';
  const releasedEntry = title.history?.slice().reverse().find((h) => h.status === 'Released');
  const releasedDate = releasedEntry
    ? new Date(releasedEntry.changed_at)
    : title.updated_at
    ? new Date(title.updated_at)
    : null;
  const releasedDateStr = releasedDate ? DATE_FORMAT.format(releasedDate) : '';

  const canEditNotices = canEdit && !isReleased;

  const clientName = title.client?.full_name ?? 'Client Account';
  const propertyRef = lotRefLabel(title.property);
  const propertyLocation = title.property?.location ?? '';

  function getNoticeTitle(num: number): string {
    if (num === 1) return '1st Notice';
    if (num === 2) return '2nd Notice';
    return 'Final Notice';
  }

  function formatStageTime(timestamp?: string | null): string | null {
    if (!timestamp) return null;
    const d = new Date(timestamp);
    return Number.isNaN(d.getTime()) ? null : formatActivityTime(d);
  }

  async function handleGenerateNotice(noticeNumber: 1 | 2 | 3) {
    setIsGeneratingNotice(noticeNumber);
    try {
      generateNoticePdf({
        noticeNumber,
        clientName,
        clientAddress: title.client?.address ?? null,
        propertyLocation,
        lotDescription: propertyRef,
        titleNumber: title.property?.title_number ?? null,
        titleId: title.title_id,
      });

      const existingNotice = notices.find((n) => n.notice_number === noticeNumber);
      if (!existingNotice) {
        const savedNotice = await recordNotice(title.title_id, noticeNumber);
        onNoticesChange([
          ...notices.filter((n) => n.notice_number !== noticeNumber),
          savedNotice,
        ]);
      }
      toast.success(
        `${noticeNumber === 1 ? '1st' : noticeNumber === 2 ? '2nd' : 'Final'} Notice downloaded`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate notice');
    } finally {
      setIsGeneratingNotice(null);
    }
  }

  const { state: startState, execute: runStartNotice } = useMutation(
    async (noticeNumber: 1 | 2 | 3) => {
      const created = await recordNotice(title.title_id, noticeNumber);
      onNoticesChange([
        ...notices.filter((n) => n.notice_number !== noticeNumber),
        created,
      ]);
      setConfirmStartNotice(null);
      return created;
    },
    {
      onSuccess: (created) => {
        toast.success(
          `${created.notice_number === 1 ? '1st' : created.notice_number === 2 ? '2nd' : 'Final'} Notice started`
        );
      },
    }
  );

  const { state: resolveState, execute: runResolveNotice } = useMutation(
    async (noticeNumber: 1 | 2 | 3) => {
      if (!statusFileInput) return;
      let updated: LandTitleNotice;
      if (resolveNotice) {
        updated = await resolveNotice(
          title.title_id,
          noticeNumber,
          noticeStatusChoice,
          statusFileInput,
          statusNotesInput.trim() || null
        );
      } else {
        updated = await uploadNoticeRts(
          title.title_id,
          noticeNumber,
          statusFileInput,
          statusNotesInput.trim() || null
        );
      }
      onNoticesChange([
        ...notices.filter((n) => n.notice_number !== noticeNumber),
        updated,
      ]);
      setStatusFileInput(null);
      setStatusNotesInput('');
      return updated;
    },
    {
      onSuccess: (updated) => {
        if (!updated) return;
        toast.success(
          `Notice ${updated.notice_number} marked as ${
            noticeStatusChoice === 'received' ? 'Received' : 'Returned to Sender'
          }`
        );
      },
    }
  );

  const { state: undoState, execute: runUndoNotice } = useMutation(
    async (noticeNumber: 1 | 2 | 3) => {
      if (undoNoticeStatus) {
        await undoNoticeStatus(title.title_id, noticeNumber);
      } else {
        await deleteNoticeRts(title.title_id, noticeNumber);
      }
      onNoticesChange(
        notices.map((n) =>
          n.notice_number === noticeNumber
            ? {
                ...n,
                status: 'ongoing',
                rts_attachment_id: null,
                rts_attachment: null,
                rts_reason: null,
                tracking_number: null,
                status_updated_at: null,
              }
            : n
        )
      );
      setConfirmUndoNotice(null);
    },
    {
      onSuccess: () => {
        toast.success('Notice status reverted to Ongoing');
      },
    }
  );

  const isStartingNotice = startState.status === 'pending';
  const isResolvingNotice = resolveState.status === 'pending';
  const isUndoingNotice = undoState.status === 'pending';

  async function handleViewNoticeProof(attachmentId: string) {
    try {
      const url = getNoticeProofUrl
        ? await getNoticeProofUrl(attachmentId)
        : await getNoticeRtsUrl(attachmentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Failed to open proof document');
    }
  }

  const sortedNotices = [...notices].sort((a, b) => a.notice_number - b.notice_number);
  const ongoingNotice = sortedNotices.find((n) => n.status === 'ongoing');
  const resolvedNotices = sortedNotices.filter((n) => n.status !== 'ongoing');
  const latestNotice = sortedNotices.length > 0 ? sortedNotices[sortedNotices.length - 1] : null;
  const latestNoticeNumber = latestNotice ? latestNotice.notice_number : 0;
  const nextNoticeNumber = (latestNoticeNumber + 1) as 1 | 2 | 3;

  return (
    <div className="space-y-4">
      {/* Release Status Banner */}
      {isReleased && (
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-row-hover px-3.5 py-2.5 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <span>Title released{releasedDateStr ? ` on ${releasedDateStr}` : ''}.</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Ready for Claim Header & Turnover Release Button */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5 bg-card">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold text-foreground">Client Outreach &amp; Notice Letters</span>
          </div>
          {title.status === 'Ready for Claim' && canEditNotices && (
            <Button
              size="sm"
              disabled={isUpdatingStatus}
              onClick={() => setConfirmReleaseOpen(true)}
              className="text-sm gap-2 h-9 px-4 shrink-0"
            >
              <CheckCircle2 className="h-4 w-4" />
              Record Release to Buyer
            </Button>
          )}
        </div>

        {/* Storage Fee Assessment */}
        {storageFee && storageFee.isApplicable && (
          <div
            className={`rounded-lg border p-3.5 space-y-2 ${
              storageFee.isOverdue
                ? 'border-warning bg-[color-mix(in_srgb,var(--warning)_8%,var(--card))]'
                : 'border-border bg-card'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Coins className={`h-4 w-4 ${storageFee.isOverdue ? 'text-warning' : 'text-primary'}`} />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Storage Fee
                </span>
              </div>
              {storageFee.isOverdue ? (
                <Badge variant="warning" shape="pill" dot className="text-xs">
                  {storageFee.monthsOverdue} {storageFee.monthsOverdue === 1 ? 'month' : 'months'} overdue
                </Badge>
              ) : (
                <Badge variant="info" shape="pill" dot className="text-xs">
                  Within 1-year grace period
                </Badge>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pt-0.5">
              <div>
                <p className="text-base font-semibold text-foreground">
                  {storageFee.isOverdue
                    ? `₱${storageFee.accruedFee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                    : '₱0.00'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {storageFee.isOverdue
                    ? `1-year grace period ended on ${storageFee.gracePeriodEndDate ? DATE_FORMAT.format(storageFee.gracePeriodEndDate) : 'N/A'}. Rate: ₱540.00/month.`
                    : storageFee.gracePeriodEndDate
                    ? `Grace period ends on ${DATE_FORMAT.format(storageFee.gracePeriodEndDate)} (${storageFee.daysRemainingInGrace} days remaining).`
                    : '1-year grace period active.'}
                </p>
              </div>
              {storageFee.readyForClaimDate && (
                <div className="text-[11px] text-muted-foreground shrink-0 sm:text-right">
                  Ready since {DATE_FORMAT.format(storageFee.readyForClaimDate)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notices Stack */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between pb-0.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              Notice Escalation
              {isLoadingNotices && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </h4>
            <span className="text-xs text-muted-foreground font-medium">
              {sortedNotices.length === 0
                ? 'Not started'
                : ongoingNotice
                ? `Notice ${ongoingNotice.notice_number} ongoing`
                : latestNoticeNumber === 3
                ? 'Cycle complete'
                : `Notice ${latestNoticeNumber} resolved`}
            </span>
          </div>

          {/* 1. Resolved notices rendered chronologically */}
          {resolvedNotices.map((n) => {
            const isReceived = n.status === 'received';
            const hasSubsequentNotice = sortedNotices.some(
              (other) => other.notice_number > n.notice_number
            );
            const nthLabel = n.notice_number === 1 ? '1st' : n.notice_number === 2 ? '2nd' : 'Final';
            const startedStr = formatStageTime(n.generated_at);
            const resolvedStr = formatStageTime(n.status_updated_at ?? n.updated_at);
            const noteText = n.tracking_number ?? n.rts_reason;

            return (
              <div
                key={n.notice_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-border bg-card shadow-2xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {getNoticeTitle(n.notice_number)}
                    </span>
                    {isReceived ? (
                      <Badge variant="success" shape="pill" dot className="text-xs">
                        Received
                      </Badge>
                    ) : (
                      <Badge variant="warning" shape="pill" dot className="text-xs">
                        Returned to Sender
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>Started {startedStr ?? DATE_FORMAT.format(new Date(n.generated_at))}</span>
                    <span>•</span>
                    <span className={isReceived ? 'text-success font-medium' : 'text-warning font-medium'}>
                      Marked {isReceived ? 'Received' : 'RTS'} {resolvedStr ?? DATE_FORMAT.format(new Date(n.status_updated_at ?? n.updated_at))}
                    </span>
                    {noteText && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-xs text-foreground font-mono">
                          {noteText}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {n.rts_attachment_id ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-sm gap-2 h-9 px-3.5"
                      onClick={() => void handleViewNoticeProof(n.rts_attachment_id!)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View {isReceived ? 'Waybill' : 'RTS Scan'}
                    </Button>
                  ) : null}

                  {canEditNotices && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuItem
                          disabled={hasSubsequentNotice}
                          onClick={() => setConfirmUndoNotice(n.notice_number as 1 | 2 | 3)}
                          className="gap-2 cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                          Undo this status
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void handleGenerateNotice(n.notice_number as 1 | 2 | 3)}
                          className="gap-2 cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5 text-muted-foreground" />
                          Generate {nthLabel} notice again
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}

          {/* 2. Ongoing notice */}
          {ongoingNotice && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-border bg-card shadow-2xs">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {getNoticeTitle(ongoingNotice.notice_number)}
                    </span>
                    <Badge variant="info" shape="pill" dot className="text-xs">
                      Ongoing
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Started {formatStageTime(ongoingNotice.generated_at) ?? DATE_FORMAT.format(new Date(ongoingNotice.generated_at))}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    size="sm"
                    className="text-sm gap-2 h-9 px-4"
                    disabled={isGeneratingNotice === ongoingNotice.notice_number}
                    onClick={() => void handleGenerateNotice(ongoingNotice.notice_number as 1 | 2 | 3)}
                  >
                    {isGeneratingNotice === ongoingNotice.notice_number ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Generate PDF
                  </Button>
                </div>
              </div>

              {/* Status update to ongoing notice */}
              {canEditNotices && (
                <div className="rounded-lg border border-dashed border-border p-3 bg-card flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shadow-2xs">
                  <div className="w-full sm:w-48 shrink-0">
                    <Select
                      value={noticeStatusChoice}
                      onValueChange={(val) => {
                        setNoticeStatusChoice(val as 'received' | 'returned_to_sender');
                        setStatusFileInput(null);
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="received">Received (Waybill)</SelectItem>
                        <SelectItem value="returned_to_sender">Returned to Sender</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <input
                    ref={statusFileInputRef}
                    type="file"
                    accept={DOCUMENT_FILE_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setStatusFileInput(file);
                      e.target.value = '';
                    }}
                  />

                  {!statusFileInput ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => statusFileInputRef.current?.click()}
                      className="h-9 text-sm gap-2 px-3.5 shrink-0"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload {noticeStatusChoice === 'received' ? 'Waybill' : 'RTS Scan'}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-border bg-muted text-xs shrink-0 max-w-[200px]">
                      <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate text-foreground font-mono text-xs" title={statusFileInput.name}>
                        {statusFileInput.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setStatusFileInput(null)}
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded-xs"
                        title="Remove file"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  <Input
                    placeholder={
                      noticeStatusChoice === 'received'
                        ? 'Waybill # / Notes (Optional)'
                        : 'RTS Reason (Optional)'
                    }
                    value={statusNotesInput}
                    onChange={(e) => setStatusNotesInput(e.target.value)}
                    className="h-9 text-sm flex-1 min-w-[140px]"
                  />

                  <Button
                    size="sm"
                    disabled={!statusFileInput || isResolvingNotice}
                    onClick={() => void runResolveNotice(ongoingNotice.notice_number as 1 | 2 | 3)}
                    className="h-9 text-sm gap-2 px-4 shrink-0"
                  >
                    {isResolvingNotice ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Save Status
                  </Button>
                </div>
              )}
            </>
          )}

          {/* 3. If there is no ongoing notice */}
          {!ongoingNotice && (
            <>
              {sortedNotices.length === 0 ? (
                isReleased ? (
                  <div className="rounded-lg border border-border p-3.5 bg-row-hover text-xs text-muted-foreground">
                    No notice letters dispatched. Title was claimed directly.
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-3.5 bg-card flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">Start 1st Notice</span>
                      <Badge variant="muted" shape="pill" className="text-xs">
                        Pending
                      </Badge>
                    </div>
                    {canEditNotices && (
                      <Button
                        size="sm"
                        className="text-sm gap-2 h-9 px-4 shrink-0"
                        onClick={() => setConfirmStartNotice(1)}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Start 1st Notice
                      </Button>
                    )}
                  </div>
                )
              ) : latestNoticeNumber < 3 ? (
                canEditNotices && (
                  <div className="rounded-lg border border-dashed border-border p-3.5 bg-card flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        Start {nextNoticeNumber === 2 ? '2nd' : 'Final'} Notice
                      </span>
                      <Badge variant="muted" shape="pill" className="text-xs">
                        Pending
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      className="text-sm gap-2 h-9 px-4 shrink-0"
                      onClick={() => setConfirmStartNotice(nextNoticeNumber)}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Start {nextNoticeNumber === 2 ? '2nd' : 'Final'} Notice
                    </Button>
                  </div>
                )
              ) : (
                <div className="rounded-lg border border-border p-3.5 bg-[color-mix(in_srgb,var(--card)_70%,var(--background))] flex items-center gap-2.5 text-sm text-muted-foreground">
                  <ShieldAlert className="h-4 w-4 text-warning shrink-0" />
                  <span>Notice cycle concluded. Title packet queued for legal counsel referral.</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialog to Record Release to Buyer */}
      <TitleReleaseDialog
        open={confirmReleaseOpen}
        onOpenChange={setConfirmReleaseOpen}
        title={title}
        onReleased={(updated) => {
          if (onTitleReleased) {
            onTitleReleased(updated);
          } else {
            onStatusChange('Released');
          }
        }}
      />

      {/* Confirmation Alert to Start Notice */}
      <AlertDialog
        open={confirmStartNotice !== null}
        onOpenChange={(open) => !open && setConfirmStartNotice(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Start {confirmStartNotice === 1 ? '1st' : confirmStartNotice === 2 ? '2nd' : 'Final Demand'} Notice?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This will mark the title claim with the{' '}
              {confirmStartNotice === 1 ? 'first' : confirmStartNotice === 2 ? 'second' : 'final demand'}{' '}
              notice and start the outreach tracking cycle. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStartingNotice}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isStartingNotice}
              onClick={() => {
                if (confirmStartNotice) {
                  void runStartNotice(confirmStartNotice);
                }
              }}
              className="bg-primary text-primary-foreground hover:opacity-90"
            >
              {isStartingNotice ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              Start Notice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Alert to Undo Notice Status */}
      <AlertDialog
        open={confirmUndoNotice !== null}
        onOpenChange={(open) => !open && setConfirmUndoNotice(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo Notice {confirmUndoNotice} Status?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This will revert Notice {confirmUndoNotice} status back to Ongoing and remove the uploaded proof document. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUndoingNotice}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isUndoingNotice}
              onClick={() => {
                if (confirmUndoNotice) {
                  void runUndoNotice(confirmUndoNotice);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:opacity-90"
            >
              {isUndoingNotice ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              Undo Status
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
