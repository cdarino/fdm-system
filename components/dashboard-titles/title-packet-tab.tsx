'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CircleDashed,
  Download,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FileTree, FileTreeFolder, FileTreeItem } from '@/components/ui/file-tree';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { GenerateDeedModal } from './generate-deed-modal';
import { TitlePacketDownloadDialog } from './title-packet-download-dialog';
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
import { formatActivityTime } from '@/lib/format-activity-time';
import { formatDocumentName, getDocumentEffectiveLabel } from '@/lib/format-document-name';
import { formatMediumDate } from '@/lib/format-date';
import { useLandTitles } from '@/lib/hooks/use-land-titles';
import { useOcrQueue } from '@/lib/hooks/use-ocr-queue';
import { getDocPrepState, getReleasedDate } from '@/lib/title-progress';
import { DOCUMENT_FILE_ACCEPT } from '@/lib/validations/document';
import {
  DOC_TYPE_LABEL,
  getDocumentTypeLabel,
  type ClientDocument,
} from '@/lib/types/client';
import {
  RELEASE_DOCUMENT_TYPES,
  type LandTitle,
  type ReleaseDocumentType,
  type TitleStatus,
} from '@/lib/types/title';

interface TitlePacketTabProps {
  title: LandTitle;
  documents: ClientDocument[];
  referenceDocuments?: ClientDocument[];
  onDocumentsChange: (docs: ClientDocument[]) => void;
  isLoadingDocs: boolean;
  isExecutiveSigned: boolean;
  setIsExecutiveSigned: (val: boolean) => void;
  onStatusChange: (nextStatus: TitleStatus, reason?: string) => void;
  isUpdatingStatus: boolean;
}

const FOLDER_IDS = ['packet', 'reference'] as const;

export function TitlePacketTab({
  title,
  documents,
  referenceDocuments = [],
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
    canEdit,
  } = useLandTitles();
  const { enqueueFile } = useOcrQueue();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTypeRef = useRef<ReleaseDocumentType | null>(null);

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [busyDocType, setBusyDocType] = useState<string | null>(null);
  const [docToRemove, setDocToRemove] = useState<ClientDocument | null>(null);
  const [isGenerateDeedOpen, setIsGenerateDeedOpen] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);

  const [revertTarget, setRevertTarget] = useState<'Document Preparation' | 'For Review' | null>(null);
  const [revertReason, setRevertReason] = useState('');

  const isReleased = title.status === 'Released';
  const releasedAt = getReleasedDate(title);
  const releasedDateStr = releasedAt ? formatMediumDate(releasedAt) : '';

  const latestDocsByType = useMemo(() => {
    const map = new Map<string, ClientDocument>();
    for (const doc of documents) {
      if (!map.has(doc.document_type)) map.set(doc.document_type, doc);
    }
    return map;
  }, [documents]);

  const refCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of referenceDocuments) {
      counts.set(doc.document_type, (counts.get(doc.document_type) ?? 0) + 1);
    }
    return counts;
  }, [referenceDocuments]);

  const hasValidId = useMemo(
    () => referenceDocuments.some((doc) => !doc.property_id && doc.document_type === 'Valid ID'),
    [referenceDocuments]
  );

  const prep = getDocPrepState(title, documents, isExecutiveSigned);
  const {
    step1Done,
    requiredCount: requiredDocsCount,
    missingCount: missingDocsCount,
    hasRecordedTct,
  } = prep;

  const uploadedRequiredCount = requiredDocsCount - missingDocsCount;
  const totalDownloadableCount = uploadedRequiredCount + referenceDocuments.length;

  const areAllExpanded = FOLDER_IDS.every((id) => expandedFolders[id] ?? true);

  function isFolderExpanded(folderId: string): boolean {
    return expandedFolders[folderId] ?? true;
  }

  function toggleFolder(folderId: string) {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !(prev[folderId] ?? true),
    }));
  }

  function toggleAllFolders() {
    const nextState = !areAllExpanded;
    const updated: Record<string, boolean> = {};
    for (const id of FOLDER_IDS) updated[id] = nextState;
    setExpandedFolders(updated);
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
    setOpeningId(doc.document_id);
    try {
      const url = await getDocumentUrl(doc.document_id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Failed to open document');
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div className="space-y-4">
      {isReleased && (
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-[color-mix(in_srgb,var(--success)_8%,var(--card))] px-3.5 py-2.5 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          <span>Title released{releasedDateStr ? ` on ${releasedDateStr}` : ''}.</span>
        </div>
      )}

      {/* Top-Docked Stage Management Action Strip */}
      {!isReleased && canEdit && (
        <div className="rounded-lg border border-border bg-card p-3">
          {title.status === 'Cleared by Billing' && (
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Badge variant="outline" shape="pill">Cleared by Billing</Badge>
                <span className="text-xs text-muted-foreground">Ready to start collecting requirements</span>
              </div>
              <Button
                size="sm"
                disabled={isUpdatingStatus}
                onClick={() => onStatusChange('Document Preparation')}
                className="h-8 shrink-0 gap-1.5 self-end px-3 text-xs font-medium sm:self-center"
              >
                {isUpdatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                Begin Document Preparation
              </Button>
            </div>
          )}

          {title.status === 'Document Preparation' && (
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info" shape="pill" dot>Document Preparation</Badge>
                <span className="text-xs text-muted-foreground">
                  {step1Done
                    ? 'All requirements recorded. Ready for supervisor review.'
                    : missingDocsCount > 0
                      ? `${missingDocsCount} file${missingDocsCount > 1 ? 's' : ''} missing`
                      : 'Requirements incomplete'}
                </span>
              </div>
              <Button
                size="sm"
                disabled={!step1Done || isUpdatingStatus}
                onClick={() => onStatusChange('For Review')}
                className="h-8 shrink-0 gap-1.5 self-end px-3 text-xs font-medium sm:self-center"
              >
                {isUpdatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                Submit for Review
              </Button>
            </div>
          )}

          {title.status === 'For Review' && (
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Badge variant="warning" shape="pill" dot>Supervisor Review</Badge>
                <span className="text-xs text-muted-foreground">Verify parcel technical description &amp; files</span>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  disabled={isUpdatingStatus}
                  onClick={() => {
                    setRevertTarget('Document Preparation');
                    setRevertReason('');
                  }}
                  className="h-8 gap-1.5 px-3 text-xs font-medium text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Revert
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isUpdatingStatus}
                  onClick={() => onStatusChange('For Signature')}
                  className="h-8 gap-1.5 px-3 text-xs font-medium"
                >
                  {isUpdatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Approve Review &amp; Advance
                </Button>
              </div>
            </div>
          )}

          {title.status === 'For Signature' && (
            <div className="space-y-3">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
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
                    className="cursor-pointer select-none text-xs font-medium text-foreground"
                  >
                    Executive Management Signature &amp; Notarization Confirmed
                  </label>
                </div>

                <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                  <Button
                    type="button"
                    variant="quiet"
                    size="sm"
                    disabled={isUpdatingStatus}
                    onClick={() => {
                      setRevertTarget('For Review');
                      setRevertReason('');
                    }}
                    className="h-8 gap-1.5 px-3 text-xs font-medium text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Revert
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!isExecutiveSigned || isUpdatingStatus}
                    onClick={() => onStatusChange('Clearance Period')}
                    className="h-8 gap-1.5 px-3 text-xs font-medium"
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

      {!hasRecordedTct && !isReleased && (
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-warning bg-[color-mix(in_srgb,var(--warning)_8%,var(--card))] px-3.5 py-3 text-xs text-foreground sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="font-semibold text-foreground">Property Title Number (TCT) missing</p>
              <p className="text-muted-foreground">
                A title number has not been recorded for this property lot. Record it on the property page before advancing the turnover packet.
              </p>
            </div>
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 shrink-0 gap-1.5 self-start text-xs sm:self-center"
          >
            <Link href={`/dashboard/properties/map?lot=${encodeURIComponent(title.property_id)}`}>
              <span>Edit on Property Page</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}

      {/* Document Explorer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold text-foreground">Turnover Packet</h4>
          <Badge variant="secondary">
            {isLoadingDocs && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {uploadedRequiredCount} of {requiredDocsCount} required
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="quiet"
            disabled={isLoadingDocs || totalDownloadableCount === 0}
            onClick={() => setIsDownloadOpen(true)}
            className="h-8 gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="quiet"
            onClick={toggleAllFolders}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {areAllExpanded ? (
              <>
                <Folder className="h-3.5 w-3.5" />
                Collapse all
              </>
            ) : (
              <>
                <FolderOpen className="h-3.5 w-3.5" />
                Expand all
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2-Folder FileTree: Legal Packet Requirements + Read-Only Client Reference Docs */}
      <TooltipProvider delayDuration={300}>
        <FileTree>
          <FileTreeFolder
            depth={0}
            label="Turnover Packet Requirements"
            meta={`${uploadedRequiredCount} of ${requiredDocsCount} uploaded`}
            expanded={isFolderExpanded('packet')}
            onToggle={() => toggleFolder('packet')}
          >
            {RELEASE_DOCUMENT_TYPES.map((type) => {
              const isSkipped = type === 'Deed of Sale' && title.is_legacy_transferred;
              const doc = latestDocsByType.get(type);
              const isBusy = busyDocType === type;
              const canMutate = !isSkipped && canEdit && !isReleased;

              const icon = isSkipped ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : doc ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              ) : (
                <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" />
              );

              return (
                <FileTreeItem
                  key={type}
                  depth={1}
                  icon={icon}
                  label={DOC_TYPE_LABEL[type]}
                  secondaryLabel={doc?.label ? doc.label : undefined}
                  badge={
                    isSkipped ? (
                      <Badge variant="muted" shape="pill" className="py-0 text-[10px]">
                        Omitted — Prior Transfer
                      </Badge>
                    ) : undefined
                  }
                  loading={Boolean(doc && openingId === doc.document_id)}
                  onClick={doc ? () => void handleViewDoc(doc) : undefined}
                  hoverActions={
                    doc ? (
                      <>
                        <span className="hidden select-none text-xs text-muted-foreground sm:inline">
                          {doc.is_autogenerated ? 'Autogenerated' : 'Uploaded'}{' '}
                          {formatActivityTime(doc.uploaded_at)}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => void handleViewDoc(doc)}
                                disabled={openingId === doc.document_id}
                                aria-label="Open document"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              >
                                {openingId === doc.document_id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <ExternalLink className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open document</TooltipContent>
                          </Tooltip>

                          {type === 'Deed of Sale' && canMutate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setIsGenerateDeedOpen(true)}
                                  aria-label="Generate Deed of Sale template (.docx)"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Template (.docx)</TooltipContent>
                            </Tooltip>
                          )}

                          {canMutate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  disabled={isBusy}
                                  onClick={() => pickFile(type)}
                                  aria-label="Replace document"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                >
                                  {isBusy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Upload className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Replace file</TooltipContent>
                            </Tooltip>
                          )}

                          {canMutate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setDocToRemove(doc)}
                                  aria-label="Remove document"
                                  className="h-7 w-7 text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove document</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </>
                    ) : undefined
                  }
                  pinnedActions={
                    !doc && canMutate ? (
                      <>
                        {type === 'Deed of Sale' && (
                          <Button
                            type="button"
                            variant="quiet"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={() => setIsGenerateDeedOpen(true)}
                            title="Generate editable Word Deed of Sale (.docx)"
                          >
                            <FileText className="h-3 w-3" />
                            Template (.docx)
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="quiet"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          disabled={isBusy}
                          onClick={() => pickFile(type)}
                        >
                          {isBusy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Upload className="h-3 w-3" />
                          )}
                          Upload
                        </Button>
                      </>
                    ) : undefined
                  }
                />
              );
            })}
          </FileTreeFolder>

          <FileTreeFolder
            depth={0}
            label="Client Reference Documents"
            sublabel="Read-only"
            meta={`${referenceDocuments.length} ${referenceDocuments.length === 1 ? 'file' : 'files'}`}
            expanded={isFolderExpanded('reference')}
            onToggle={() => toggleFolder('reference')}
            actions={
              <Button
                asChild
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Link href={`/dashboard/clients/${encodeURIComponent(title.client_id)}`}>
                  Client profile
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            }
          >
            {referenceDocuments.length === 0 ? (
              <div className="flex items-center justify-between py-1.5 pl-10 pr-3 text-xs italic text-muted-foreground">
                <span>No Valid ID or additional client files on record</span>
                <Button
                  asChild
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs font-normal not-italic text-primary hover:text-primary"
                >
                  <Link
                    href={`/dashboard/clients/${encodeURIComponent(title.client_id)}?uploadType=${encodeURIComponent('Valid ID')}`}
                  >
                    Upload Valid ID
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                {!hasValidId && (
                  <div className="flex items-center justify-between py-1.5 pl-10 pr-3 text-xs italic text-muted-foreground">
                    <span>No Valid ID uploaded for this client yet</span>
                    <Button
                      asChild
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs font-normal not-italic text-primary hover:text-primary"
                    >
                      <Link
                        href={`/dashboard/clients/${encodeURIComponent(title.client_id)}?uploadType=${encodeURIComponent('Valid ID')}`}
                      >
                        Upload Valid ID
                      </Link>
                    </Button>
                  </div>
                )}
                {referenceDocuments.map((doc) => {
                  const countInCategory = refCategoryCounts.get(doc.document_type) ?? 0;
                  const showLabel = countInCategory >= 2 || Boolean(doc.label);
                  const secondaryLabel = showLabel ? getDocumentEffectiveLabel(doc) : undefined;

                  return (
                    <FileTreeItem
                      key={doc.document_id}
                      depth={1}
                      label={getDocumentTypeLabel(doc.document_type)}
                      secondaryLabel={secondaryLabel}
                      loading={openingId === doc.document_id}
                      onClick={() => void handleViewDoc(doc)}
                      hoverActions={
                        <>
                          <span className="hidden select-none text-xs text-muted-foreground sm:inline">
                            {doc.is_autogenerated ? 'Autogenerated' : 'Uploaded'}{' '}
                            {formatActivityTime(doc.uploaded_at)}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => void handleViewDoc(doc)}
                                disabled={openingId === doc.document_id}
                                aria-label="Open document"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              >
                                {openingId === doc.document_id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <ExternalLink className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open document</TooltipContent>
                          </Tooltip>
                        </>
                      }
                    />
                  );
                })}
              </>
            )}
          </FileTreeFolder>
        </FileTree>
      </TooltipProvider>

      <input
        ref={fileInputRef}
        type="file"
        accept={DOCUMENT_FILE_ACCEPT}
        className="hidden"
        onChange={handleFileChosen}
      />

      {/* Customizable Print / Download PDF Bundle Modal */}
      <TitlePacketDownloadDialog
        open={isDownloadOpen}
        onOpenChange={setIsDownloadOpen}
        title={title}
        packetDocuments={documents}
        referenceDocuments={referenceDocuments}
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
              className="bg-destructive text-destructive-foreground hover:bg-[color-mix(in_srgb,var(--destructive)_85%,black)]"
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
              className="bg-destructive text-destructive-foreground hover:bg-[color-mix(in_srgb,var(--destructive)_85%,black)]"
            >
              {isUpdatingStatus ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Confirm Revert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GenerateDeedModal
        open={isGenerateDeedOpen}
        onOpenChange={setIsGenerateDeedOpen}
        title={title}
      />
    </div>
  );
}
