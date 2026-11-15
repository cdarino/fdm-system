'use client';

import { useRef, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { SectionCard } from '@/components/ui/section-card';
import { GenerateDeedModal } from './generate-deed-modal';
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
import { formatDocumentName } from '@/lib/format-document-name';
import { formatMediumDate } from '@/lib/format-date';
import { useLandTitles } from '@/lib/hooks/use-land-titles';
import { useOcrQueue } from '@/lib/hooks/use-ocr-queue';
import { useMutation } from '@/lib/hooks/use-mutation';
import { getDocPrepState, getReleasedDate } from '@/lib/title-progress';
import { DOCUMENT_FILE_ACCEPT } from '@/lib/validations/document';
import { DOC_TYPE_LABEL, type ClientDocument } from '@/lib/types/client';
import {
  RELEASE_DOCUMENT_TYPES,
  type LandTitle,
  type ReleaseDocumentType,
  type TitleStatus,
} from '@/lib/types/title';

interface TitlePacketTabProps {
  title: LandTitle;
  documents: ClientDocument[];
  onDocumentsChange: (docs: ClientDocument[]) => void;
  isLoadingDocs: boolean;
  isExecutiveSigned: boolean;
  setIsExecutiveSigned: (val: boolean) => void;
  onStatusChange: (nextStatus: TitleStatus, reason?: string) => void;
  isUpdatingStatus: boolean;
}

export function TitlePacketTab({
  title,
  documents,
  onDocumentsChange,
  isLoadingDocs,
  isExecutiveSigned,
  setIsExecutiveSigned,
  onStatusChange,
  isUpdatingStatus,
}: TitlePacketTabProps) {
  const {
    uploadDocument,
    removeDocument,
    getDocumentUrl,
    updateTitleNumber,
    canEdit,
  } = useLandTitles();
  const { enqueueFile } = useOcrQueue();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTypeRef = useRef<ReleaseDocumentType | null>(null);

  const [busyDocType, setBusyDocType] = useState<string | null>(null);
  const [docToRemove, setDocToRemove] = useState<ClientDocument | null>(null);
  const [isGenerateDeedOpen, setIsGenerateDeedOpen] = useState(false);

  const [revertTarget, setRevertTarget] = useState<'Document Preparation' | 'For Review' | null>(null);
  const [revertReason, setRevertReason] = useState('');

  const currentTct = title.property?.title_number ?? '';
  const [titleNumberInput, setTitleNumberInput] = useState(currentTct);
  const [isEditingTct, setIsEditingTct] = useState(false);

  const isReleased = title.status === 'Released';
  const releasedAt = getReleasedDate(title);
  const releasedDateStr = releasedAt ? formatMediumDate(releasedAt) : '';

  const latestDocsByType = new Map<string, ClientDocument>();
  for (const doc of documents) {
    if (!latestDocsByType.has(doc.document_type)) latestDocsByType.set(doc.document_type, doc);
  }

  const prep = getDocPrepState(title, documents, isExecutiveSigned);
  const {
    step1Done,
    requiredCount: requiredDocsCount,
    missingCount: missingDocsCount,
    hasRecordedTct,
  } = prep;

  const { state: tctState, execute: runSaveTct } = useMutation(
    async (newTitleNumber: string) => {
      await updateTitleNumber(title.property_id, newTitleNumber);
    },
    {
      onSuccess: () => {
        toast.success('Title number saved');
        setIsEditingTct(false);
      },
    }
  );

  const isSavingTct = tctState.status === 'pending';

  function handleSaveTct(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = titleNumberInput.trim();
    if (!trimmed) {
      toast.error('Title number cannot be empty');
      return;
    }
    void runSaveTct(trimmed);
  }

  function pickFile(type: ReleaseDocumentType) {
    pendingTypeRef.current = type;
    fileInputRef.current?.click();
  }

  async function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const type = pendingTypeRef.current;
    event.target.value = '';
    if (!file || !type) return;

    setBusyDocType(type);
    try {
      const saved = await uploadDocument(title.title_id, type, file);
      onDocumentsChange([saved, ...documents.filter((d) => d.document_id !== saved.document_id)]);
      toast.success(`${DOC_TYPE_LABEL[type]} uploaded`);

      // Enqueue document into background OCR worker for search indexing.
      enqueueFile({
        attachmentId: saved.document_id,
        file,
        fileName: file.name,
        entityType: 'land_title',
        keywords: [DOC_TYPE_LABEL[type], title.client?.full_name].filter(Boolean).join(' '),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusyDocType(null);
      pendingTypeRef.current = null;
    }
  }

  async function handleConfirmRemoveDoc() {
    if (!docToRemove) return;
    setBusyDocType(docToRemove.document_type as ReleaseDocumentType);
    try {
      await removeDocument(docToRemove);
      onDocumentsChange(documents.filter((d) => d.document_id !== docToRemove.document_id));
      toast.success('Document removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setBusyDocType(null);
      setDocToRemove(null);
    }
  }

  async function handleViewDoc(doc: ClientDocument) {
    try {
      const url = await getDocumentUrl(doc.document_id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Failed to open document');
    }
  }

  return (
    <div className="space-y-4">
      {/* Release Status Banner */}
      {isReleased && (
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-[color-mix(in_srgb,var(--success)_8%,var(--card))] px-3.5 py-2.5 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <span>Title released{releasedDateStr ? ` on ${releasedDateStr}` : ''}.</span>
        </div>
      )}

      {/* Top-Docked Stage Management Action Strip */}
      {!isReleased && canEdit && (
        <div className="rounded-lg border border-border bg-card p-3">
          {/* Stage: Cleared by Billing */}
          {title.status === 'Cleared by Billing' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" shape="pill">Cleared by Billing</Badge>
                <span className="text-xs text-muted-foreground">Ready to start collecting requirements</span>
              </div>
              <Button
                size="sm"
                disabled={isUpdatingStatus}
                onClick={() => onStatusChange('Document Preparation')}
                className="text-xs gap-1.5 h-8 px-3 font-medium shrink-0 self-end sm:self-center"
              >
                {isUpdatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                Begin Document Preparation
              </Button>
            </div>
          )}

          {/* Stage: Document Preparation */}
          {title.status === 'Document Preparation' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="info" shape="pill" dot>Document Preparation</Badge>
                <span className="text-xs text-muted-foreground">
                  {step1Done
                    ? 'All requirements recorded. Ready for supervisor review.'
                    : `${missingDocsCount > 0 ? `${missingDocsCount} file${missingDocsCount > 1 ? 's' : ''} missing` : ''}${!hasRecordedTct ? `${missingDocsCount > 0 ? ' • ' : ''}TCT number required` : ''}`}
                </span>
              </div>
              <Button
                size="sm"
                disabled={!step1Done || isUpdatingStatus}
                onClick={() => onStatusChange('For Review')}
                className="text-xs gap-1.5 h-8 px-3 font-medium shrink-0 self-end sm:self-center"
              >
                {isUpdatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                Submit for Review
              </Button>
            </div>
          )}

          {/* Stage: For Review */}
          {title.status === 'For Review' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="warning" shape="pill" dot>Supervisor Review</Badge>
                <span className="text-xs text-muted-foreground">Verify parcel technical description &amp; files</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  disabled={isUpdatingStatus}
                  onClick={() => {
                    setRevertTarget('Document Preparation');
                    setRevertReason('');
                  }}
                  className="text-xs gap-1.5 h-8 px-3 font-medium text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Revert
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isUpdatingStatus}
                  onClick={() => onStatusChange('For Signature')}
                  className="text-xs gap-1.5 h-8 px-3 font-medium"
                >
                  {isUpdatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Approve Review &amp; Advance
                </Button>
              </div>
            </div>
          )}

          {/* Stage: For Signature */}
          {title.status === 'For Signature' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    id="stage-exec-signed"
                    checked={isExecutiveSigned}
                    disabled={isUpdatingStatus}
                    onCheckedChange={(checked) => setIsExecutiveSigned(Boolean(checked))}
                    className="h-4 w-4"
                  />
                  <label
                    htmlFor="stage-exec-signed"
                    className="text-xs font-medium text-foreground cursor-pointer select-none"
                  >
                    Executive Management Signature &amp; Notarization Confirmed
                  </label>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    type="button"
                    variant="quiet"
                    size="sm"
                    disabled={isUpdatingStatus}
                    onClick={() => {
                      setRevertTarget('For Review');
                      setRevertReason('');
                    }}
                    className="text-xs gap-1.5 h-8 px-3 font-medium text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Revert
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!isExecutiveSigned || isUpdatingStatus}
                    onClick={() => onStatusChange('Clearance Period')}
                    className="text-xs gap-1.5 h-8 px-3 font-medium"
                  >
                    {isUpdatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
                    Start 30-Day Clearance
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Release Packet Workbench Card */}
      <SectionCard className="space-y-4">
        {/* Header Toolbar: Document count + Integrated TCT quick-edit */}
        <div className="flex flex-col gap-3 pb-2 border-b border-border sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-foreground">Turnover Packet Requirements</h4>
            <Badge variant="outline" shape="pill" className="text-xs font-normal">
              {isLoadingDocs && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              {requiredDocsCount - missingDocsCount} of {requiredDocsCount} files uploaded
            </Badge>
          </div>

          {/* Integrated TCT Editor in Toolbar */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-xs text-muted-foreground">TCT:</span>
            {!isEditingTct ? (
              <div className="flex items-center gap-1.5">
                {title.property?.title_number ? (
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted border border-border text-foreground">
                    {title.property.title_number}
                  </span>
                ) : (
                  <Badge variant="warning" shape="pill" dot className="text-xs">
                    Missing TCT
                  </Badge>
                )}
                {canEdit && !isReleased && (
                  <Button
                    type="button"
                    variant="quiet"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setTitleNumberInput(currentTct);
                      setIsEditingTct(true);
                    }}
                    title="Edit TCT Number"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ) : (
              <form onSubmit={handleSaveTct} className="flex items-center gap-1.5">
                <Input
                  value={titleNumberInput}
                  onChange={(e) => setTitleNumberInput(e.target.value)}
                  placeholder="e.g. T-123456"
                  className="h-7 w-28 font-mono text-xs px-2"
                  autoFocus
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-7 px-2.5 text-xs font-medium"
                  disabled={isSavingTct || !titleNumberInput.trim()}
                >
                  {isSavingTct ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                </Button>
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setTitleNumberInput(currentTct);
                    setIsEditingTct(false);
                  }}
                >
                  Cancel
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Dense Document Rows */}
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {RELEASE_DOCUMENT_TYPES.map((type) => {
            const isSkipped = type === 'Deed of Sale' && title.is_legacy_transferred;
            const doc = latestDocsByType.get(type);
            const isBusy = busyDocType === type;

            return (
              <div
                key={type}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-row-hover transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isSkipped ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : doc ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-xs text-foreground truncate">
                        {DOC_TYPE_LABEL[type]}
                      </p>
                      {isSkipped ? (
                        <Badge variant="muted" shape="pill" className="text-[10px] py-0">Omitted - Prior Transfer</Badge>
                      ) : doc ? (
                        <Badge variant="success" shape="pill" dot className="text-[10px] py-0">Complete</Badge>
                      ) : (
                        <Badge variant="warning" shape="pill" dot className="text-[10px] py-0">Missing</Badge>
                      )}
                    </div>
                    {doc && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 font-mono">
                        {formatDocumentName(doc.file_path)} • {formatMediumDate(doc.uploaded_at)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {doc && (
                    <>
                      <Button
                        type="button"
                        variant="quiet"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => void handleViewDoc(doc)}
                        title="View document"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      {canEdit && !isReleased && (
                        <Button
                          type="button"
                          variant="quiet"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)]"
                          onClick={() => setDocToRemove(doc)}
                          title="Remove document"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </>
                  )}
                  {type === 'Deed of Sale' && !isSkipped && canEdit && !isReleased && (
                    <Button
                      type="button"
                      variant="quiet"
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1"
                      onClick={() => setIsGenerateDeedOpen(true)}
                      title="Generate editable Word Deed of Sale (.docx)"
                    >
                      <FileText className="h-3 w-3" />
                      Template (.docx)
                    </Button>
                  )}
                  {!isSkipped && canEdit && !isReleased && (
                    <Button
                      type="button"
                      variant="quiet"
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1"
                      disabled={isBusy}
                      onClick={() => pickFile(type)}
                    >
                      {isBusy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      {doc ? 'Replace' : 'Upload'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <input
        ref={fileInputRef}
        type="file"
        accept={DOCUMENT_FILE_ACCEPT}
        className="hidden"
        onChange={handleFileChosen}
      />

      {/* Confirmation Alert to Remove Document */}
      <AlertDialog open={docToRemove !== null} onOpenChange={(open) => !open && setDocToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove document?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to remove &quot;
              {docToRemove ? formatDocumentName(docToRemove.file_path) : 'this document'}
              &quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmRemoveDoc()}
              className="bg-destructive text-destructive-foreground hover:opacity-90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revert Stage Dialog */}
      <AlertDialog
        open={revertTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevertTarget(null);
            setRevertReason('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Revert stage to {revertTarget === 'Document Preparation' ? 'Document Preparation' : 'Legal Supervisor Review'}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {revertTarget === 'Document Preparation'
                ? 'This will return this title packet back to Document Preparation for revisions or missing files.'
                : 'This will return this title packet back to Legal Supervisor Review.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5 py-1">
            <label htmlFor="revert-reason" className="text-xs font-medium text-foreground">
              Reason for revert (optional)
            </label>
            <Input
              id="revert-reason"
              value={revertReason}
              onChange={(e) => setRevertReason(e.target.value)}
              placeholder="e.g. Discrepancy in deed of sale, technical corrections..."
              className="h-9 text-sm"
              autoFocus
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingStatus}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isUpdatingStatus}
              onClick={(e) => {
                e.preventDefault();
                if (!revertTarget) return;
                const target = revertTarget;
                const reason = revertReason.trim();
                setRevertTarget(null);
                setRevertReason('');
                onStatusChange(target, reason || undefined);
              }}
              className="bg-destructive text-destructive-foreground hover:opacity-90"
            >
              {isUpdatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Confirm Revert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal to configure and download Deed of Sale (.docx) */}
      <GenerateDeedModal
        open={isGenerateDeedOpen}
        onOpenChange={setIsGenerateDeedOpen}
        title={title}
      />
    </div>
  );
}
