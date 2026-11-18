'use client';

import { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  MoreVertical,
  Paperclip,
  RotateCcw,
  Send,
  ShieldAlert,
  Upload,
  Vault,
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
import { SectionCard } from '@/components/ui/section-card';
import { formatMediumDate } from '@/lib/format-date';
import { useLandTitles, lotRefLabel } from '@/lib/hooks/use-land-titles';
import { useOcrQueue } from '@/lib/hooks/use-ocr-queue';
import { useMutation } from '@/lib/hooks/use-mutation';
import { TitleReleaseDialog } from './title-release-dialog';
import { generateNoticePdf } from '@/lib/reports/pdf-notice-letter';
import { calculateStorageFee } from '@/lib/storage-fee';
import { getReleasedDate, noticeOrdinal } from '@/lib/title-progress';
import {
  DOCUMENT_FILE_ACCEPT,
  DOCUMENT_SIZE_ERROR,
  DOCUMENT_SIZE_HINT,
  MAX_DOCUMENT_BYTES,
} from '@/lib/validations/document';
import type { LandTitle, LandTitleNotice, TitleStatus } from '@/lib/types/title';

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
  const { enqueueFile } = useOcrQueue();

  const statusFileInputRef = useRef<HTMLInputElement>(null);

  const [confirmReleaseOpen, setConfirmReleaseOpen] = useState(false);
  const [confirmStartNotice, setConfirmStartNotice] = useState<1 | 2 | 3 | null>(null);
  const [confirmUndoNotice, setConfirmUndoNotice] = useState<1 | 2 | 3 | null>(null);

  const [noticeStatusChoice, setNoticeStatusChoice] = useState<'received' | 'returned_to_sender'>('received');
  const [statusNotesInput, setStatusNotesInput] = useState('');
  const [statusFileInput, setStatusFileInput] = useState<File | null>(null);
  const [statusFileError, setStatusFileError] = useState<string | null>(null);

  const [isGeneratingNotice, setIsGeneratingNotice] = useState<number | null>(null);

  const storageFee = calculateStorageFee(title);
  const isReleased = title.status === 'Released';
  const releasedDate = getReleasedDate(title);
  const releasedDateStr = releasedDate ? formatMediumDate(releasedDate) : '';

  const canEditNotices = canEdit && !isReleased;

  const clientName = title.client?.full_name ?? 'Client Account';
  const propertyRef = lotRefLabel(title.property);
  const propertyLocation = title.property?.location ?? '';

  function getNoticeTitle(num: number): string {
    return `${noticeOrdinal(num)} Notice`;
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
      const fileToUpload = statusFileInput;
      let updated: LandTitleNotice;
      if (resolveNotice) {
        updated = await resolveNotice(
          title.title_id,
          noticeNumber,
          noticeStatusChoice,
          fileToUpload,
          statusNotesInput.trim() || null
        );
      } else {
        updated = await uploadNoticeRts(
          title.title_id,
          noticeNumber,
          fileToUpload,
          statusNotesInput.trim() || null
        );
      }
      onNoticesChange([
        ...notices.filter((n) => n.notice_number !== noticeNumber),
        updated,
      ]);
      setStatusFileInput(null);
      setStatusNotesInput('');

      // Enqueue notice attachment into background OCR worker for search indexing.
      if (updated.rts_attachment_id) {
        enqueueFile({
          attachmentId: updated.rts_attachment_id,
          file: fileToUpload,
          fileName: fileToUpload.name,
          entityType: 'land_title_notice',
          keywords: [`Notice ${noticeNumber} RTS`, title.client?.full_name].filter(Boolean).join(' '),
        });
      }

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
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-[color-mix(in_srgb,var(--success)_8%,var(--card))] px-3.5 py-2.5 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <span>Title released{releasedDateStr ? ` on ${releasedDateStr}` : ''}.</span>
        </div>
      )}

      {/* Top-Docked Primary Milestone Bar: Vault Status & Record Release CTA */}
      {title.status === 'Ready for Claim' && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-primary font-medium text-xs">
              <Vault className="h-4 w-4" />
              <span>Title Ready in Vault</span>
            </div>
            <Badge variant="success" shape="pill" dot className="text-xs">
              Eligible for Release
            </Badge>

            {/* Inline Storage Fee Summary Chip */}
            {storageFee && storageFee.isApplicable && (
              storageFee.isOverdue ? (
                <Badge variant="warning" shape="pill" dot className="text-xs">
                  Storage Overdue: ₱{storageFee.accruedFee.toLocaleString('en-PH', { minimumFractionDigits: 2 })} ({storageFee.monthsOverdue} mo)
                </Badge>
              ) : (
                <Badge variant="info" shape="pill" dot className="text-xs">
                  Grace Period Active {storageFee.daysRemainingInGrace !== null ? `(${storageFee.daysRemainingInGrace}d remaining)` : ''}
                </Badge>
              )
            )}
          </div>

          {canEditNotices && (
            <Button
              size="sm"
              disabled={isUpdatingStatus}
              onClick={() => setConfirmReleaseOpen(true)}
              className="text-xs gap-1.5 h-8 px-3.5 font-medium shrink-0 self-end sm:self-center"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Record Release to Buyer
            </Button>
          )}
        </div>
      )}

      {/* Notices Escalation Section */}
      <SectionCard className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">Formal Notice Escalation</h4>
            <span className="text-xs text-muted-foreground font-medium">
              {isLoadingNotices && <Loader2 className="h-3 w-3 animate-spin inline mr-1" />}
              {sortedNotices.length === 0
                ? 'No notices issued'
                : ongoingNotice
                  ? `Notice ${ongoingNotice.notice_number} ongoing`
                  : latestNoticeNumber === 3
                    ? '3 of 3 notices complete'
                    : `${latestNoticeNumber} of 3 resolved`}
            </span>
          </div>

          {!ongoingNotice && latestNoticeNumber < 3 && canEditNotices && (
            <Button
              size="sm"
              variant="quiet"
              className="text-xs gap-1.5 h-7 px-2.5 font-medium"
              onClick={() => setConfirmStartNotice(nextNoticeNumber)}
            >
              <Send className="h-3 w-3" />
              Start {nextNoticeNumber === 1 ? '1st' : nextNoticeNumber === 2 ? '2nd' : 'Final'} Notice
            </Button>
          )}
        </div>

        {/* Chronological Resolved Notices Audit Log */}
        {resolvedNotices.length > 0 && (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {resolvedNotices.map((n) => {
              const isReceived = n.status === 'received';
              const hasSubsequentNotice = sortedNotices.some(
                (other) => other.notice_number > n.notice_number
              );
              const nthLabel = n.notice_number === 1 ? '1st' : n.notice_number === 2 ? '2nd' : 'Final';
              const resolvedDate = n.status_updated_at ?? n.updated_at;
              const noteText = n.tracking_number ?? n.rts_reason;

              return (
                <div
                  key={n.notice_id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-row-hover transition-colors"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {getNoticeTitle(n.notice_number)}
                      </span>
                      {isReceived ? (
                        <Badge variant="success" shape="pill" dot className="text-[10px] py-0">
                          Received
                        </Badge>
                      ) : (
                        <Badge variant="warning" shape="pill" dot className="text-[10px] py-0">
                          Returned to Sender
                        </Badge>
                      )}
                      {resolvedDate && (
                        <span className="text-muted-foreground text-[11px]">
                          • {formatMediumDate(resolvedDate)}
                        </span>
                      )}
                    </div>
                    {noteText && (
                      <p className="text-muted-foreground font-mono text-[11px] truncate max-w-sm">
                        {noteText}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {n.rts_attachment_id ? (
                      <Button
                        size="sm"
                        variant="quiet"
                        className="text-xs gap-1 h-7 px-2"
                        onClick={() => void handleViewNoticeProof(n.rts_attachment_id!)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Proof
                      </Button>
                    ) : null}

                    {canEditNotices && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="quiet" size="icon" className="h-7 w-7 p-0">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-xs">
                          <DropdownMenuItem
                            disabled={hasSubsequentNotice}
                            onClick={() => setConfirmUndoNotice(n.notice_number as 1 | 2 | 3)}
                            className="gap-2 cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                            Undo status
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => void handleGenerateNotice(n.notice_number as 1 | 2 | 3)}
                            className="gap-2 cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5 text-muted-foreground" />
                            Re-download {nthLabel} notice PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ongoing Notice Resolution Panel */}
        {ongoingNotice && (
          <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {getNoticeTitle(ongoingNotice.notice_number)} Dispatched
                </span>
                <Badge variant="info" shape="pill" dot className="text-[10px] py-0">Ongoing</Badge>
                {ongoingNotice.generated_at && (
                  <span className="text-xs text-muted-foreground">
                    • {formatMediumDate(ongoingNotice.generated_at)}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="quiet"
                className="text-xs gap-1 h-7 px-2 shrink-0"
                disabled={isGeneratingNotice === ongoingNotice.notice_number}
                onClick={() => void handleGenerateNotice(ongoingNotice.notice_number as 1 | 2 | 3)}
              >
                {isGeneratingNotice === ongoingNotice.notice_number ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                Download PDF
              </Button>
            </div>

            {canEditNotices && (
              <div className="space-y-1.5 pt-0.5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="w-full sm:w-44 shrink-0">
                    <Select
                      value={noticeStatusChoice}
                      onValueChange={(val) => {
                        setNoticeStatusChoice(val as 'received' | 'returned_to_sender');
                        setStatusFileInput(null);
                        setStatusFileError(null);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
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
                      e.target.value = '';
                      if (file && file.size > MAX_DOCUMENT_BYTES) {
                        setStatusFileInput(null);
                        setStatusFileError(DOCUMENT_SIZE_ERROR);
                        return;
                      }
                      setStatusFileError(null);
                      setStatusFileInput(file);
                    }}
                  />

                  {!statusFileInput ? (
                    <Button
                      type="button"
                      variant="quiet"
                      size="sm"
                      onClick={() => statusFileInputRef.current?.click()}
                      className="h-8 text-xs gap-1 px-2.5 shrink-0 border border-border"
                    >
                      <Upload className="h-3 w-3" />
                      Upload {noticeStatusChoice === 'received' ? 'Waybill' : 'RTS Scan'}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5 h-8 px-2 rounded-md border border-border bg-muted text-xs shrink-0 max-w-[180px]">
                      <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate text-foreground font-mono text-[11px]" title={statusFileInput.name}>
                        {statusFileInput.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFileInput(null);
                          setStatusFileError(null);
                        }}
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
                        ? 'Waybill # / remarks'
                        : 'RTS reason / remarks'
                    }
                    value={statusNotesInput}
                    onChange={(e) => setStatusNotesInput(e.target.value)}
                    className="h-8 text-xs flex-1 min-w-[120px]"
                  />

                  <Button
                    size="sm"
                    disabled={!statusFileInput || isResolvingNotice}
                    onClick={() => void runResolveNotice(ongoingNotice.notice_number as 1 | 2 | 3)}
                    className="h-8 text-xs gap-1.5 px-3 shrink-0 font-medium"
                  >
                    {isResolvingNotice ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Save Status
                  </Button>
                </div>
                {statusFileError ? (
                  <p role="alert" className="text-xs text-destructive">
                    {statusFileError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {DOCUMENT_SIZE_HINT}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty state when no notices and cycle concluded */}
        {sortedNotices.length === 0 && !ongoingNotice && (
          <p className="text-xs text-muted-foreground italic py-2 text-center">
            {isReleased ? 'Title was claimed directly without formal notice escalation.' : 'No notices dispatched yet.'}
          </p>
        )}

        {latestNoticeNumber === 3 && !ongoingNotice && (
          <div className="flex items-center gap-2 p-2.5 rounded-md border border-border bg-muted/30 text-xs text-muted-foreground">
            <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
            <span>Notice cycle complete (Final Demand issued).</span>
          </div>
        )}
      </SectionCard>

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
              This will record the {confirmStartNotice === 1 ? 'first' : confirmStartNotice === 2 ? 'second' : 'final demand'} notice and begin courier tracking.
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
              This will revert Notice {confirmUndoNotice} status back to Ongoing and remove the uploaded proof document.
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
