'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Circle,
  CircleDashed,
  Download,
  ExternalLink,
  FileCheck,
  Inbox,
  Loader2,
  Mail,
  MoreVertical,
  Paperclip,
  Pencil,
  RotateCcw,
  Send,
  ShieldAlert,
  Target,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatActivityTime } from '@/lib/format-activity-time';
import { formatDocumentName } from '@/lib/format-document-name';
import { lotRefLabel } from '@/lib/hooks/use-land-titles';
import { useSession } from '@/lib/hooks/use-session';
import { TITLE_STATUS_VARIANT } from '@/lib/status-colors';
import { generateNoticePdf } from '@/lib/reports/pdf-notice-letter';
import { getClearanceProgress } from './title-record-card';
import {
  getMissingReleaseDocuments,
  getRequiredReleaseDocuments,
  isReleasePacketComplete,
} from '@/lib/utils/release-requirements';
import { DOCUMENT_FILE_ACCEPT } from '@/lib/validations/document';
import { DOC_TYPE_LABEL, type ClientDocument } from '@/lib/types/client';
import type {
  AccountAwaitingTitle,
  LandTitle,
  LandTitleNotice,
  ReleaseDocumentType,
  TitleStatus,
} from '@/lib/types/title';
import { RELEASE_DOCUMENT_TYPES } from '@/lib/types/title';

const DATE_FORMAT = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });
const TIME_FORMAT = new Intl.DateTimeFormat('en-PH', { dateStyle: 'short', timeStyle: 'short' });

const LIFECYCLE_STAGES: { status: TitleStatus; label: string; desc: string }[] = [
  { status: 'Cleared by Billing', label: 'Cleared by Billing', desc: 'Account verified & cleared as fully paid' },
  { status: 'Document Preparation', label: 'Document Preparation', desc: 'Packet assembly, review & signing' },
  { status: 'Clearance Period', label: 'Clearance Period', desc: '30-day internal clearance before release' },
  { status: 'Ready for Claim', label: 'Ready for Claim', desc: 'Original title & DOAS in vault awaiting buyer' },
  { status: 'Released', label: 'Released', desc: 'Physical packet turned over to buyer' },
];

function normalizeLifecycleStage(status: TitleStatus): TitleStatus {
  if (status === 'For Review' || status === 'For Signature') {
    return 'Document Preparation';
  }
  return status;
}

interface TitleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItem:
    | { type: 'awaiting'; data: AccountAwaitingTitle }
    | { type: 'title'; data: LandTitle }
    | null;
  canCreate: boolean;
  canEdit: boolean;
  onStartProcessing: (account: AccountAwaitingTitle) => Promise<LandTitle | void>;
  onReturnToBilling: (account: AccountAwaitingTitle) => Promise<void>;
  onUpdateTitle: (
    titleId: string,
    updates: { status?: TitleStatus; clearance_started_at?: string | null }
  ) => Promise<void>;
  onUpdateTitleNumber: (propertyId: string, titleNumber: string) => Promise<void>;
  loadDocuments: (titleId: string) => Promise<ClientDocument[]>;
  uploadDocument: (
    titleId: string,
    type: ReleaseDocumentType,
    file: File
  ) => Promise<ClientDocument>;
  removeDocument: (document: ClientDocument) => Promise<void>;
  getDocumentUrl: (documentId: string) => Promise<string>;
  loadNotices: (titleId: string) => Promise<LandTitleNotice[]>;
  recordNotice: (titleId: string, noticeNumber: number) => Promise<LandTitleNotice>;
  resolveNotice?: (
    titleId: string,
    noticeNumber: number,
    status: 'received' | 'returned_to_sender',
    file: File,
    notes?: string | null
  ) => Promise<LandTitleNotice>;
  undoNoticeStatus?: (titleId: string, noticeNumber: number) => Promise<void>;
  uploadNoticeRts: (
    titleId: string,
    noticeNumber: number,
    file: File,
    reason?: string | null
  ) => Promise<LandTitleNotice>;
  getNoticeRtsUrl: (attachmentId: string) => Promise<string>;
  getNoticeProofUrl?: (attachmentId: string) => Promise<string>;
  deleteNoticeRts: (titleId: string, noticeNumber: number) => Promise<void>;
}

export function TitleDialog({
  open,
  onOpenChange,
  selectedItem,
  canCreate,
  canEdit,
  onStartProcessing,
  onReturnToBilling,
  onUpdateTitle,
  onUpdateTitleNumber,
  loadDocuments,
  uploadDocument,
  removeDocument,
  getDocumentUrl,
  loadNotices,
  recordNotice,
  resolveNotice,
  undoNoticeStatus,
  uploadNoticeRts,
  getNoticeRtsUrl,
  getNoticeProofUrl,
  deleteNoticeRts,
}: TitleDialogProps) {
  const { hasPermission } = useSession();
  const isAdmin = hasPermission('system.update');

  const [activeItem, setActiveItem] = useState(selectedItem);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [busyDocType, setBusyDocType] = useState<string | null>(null);
  const [docToRemove, setDocToRemove] = useState<ClientDocument | null>(null);

  const [notices, setNotices] = useState<LandTitleNotice[]>([]);
  const [isLoadingNotices, setIsLoadingNotices] = useState(false);
  const [rtsModalNotice, setRtsModalNotice] = useState<1 | 2 | 3 | null>(null);
  const [rtsReasonInput, setRtsReasonInput] = useState('');
  const [isUploadingRts, setIsUploadingRts] = useState(false);
  const [rtsFileInput, setRtsFileInput] = useState<File | null>(null);
  const [isGeneratingNotice, setIsGeneratingNotice] = useState<number | null>(null);

  const [confirmReleaseOpen, setConfirmReleaseOpen] = useState(false);
  const [confirmReadyForClaimOpen, setConfirmReadyForClaimOpen] = useState(false);
  const [confirmStartNotice, setConfirmStartNotice] = useState<1 | 2 | 3 | null>(null);
  const [confirmUndoNotice, setConfirmUndoNotice] = useState<1 | 2 | 3 | null>(null);
  const [noticeStatusChoice, setNoticeStatusChoice] = useState<'received' | 'returned_to_sender'>('received');
  const [statusNotesInput, setStatusNotesInput] = useState('');
  const [statusFileInput, setStatusFileInput] = useState<File | null>(null);
  const [isResolvingNotice, setIsResolvingNotice] = useState(false);
  const [isStartingNotice, setIsStartingNotice] = useState(false);
  const [isUndoingNotice, setIsUndoingNotice] = useState(false);

  const [titleNumberInput, setTitleNumberInput] = useState('');
  const [isSavingTct, setIsSavingTct] = useState(false);
  const [isEditingTct, setIsEditingTct] = useState(false);

  const [isStartingProcessing, setIsStartingProcessing] = useState(false);
  const [isReturningToBilling, setIsReturningToBilling] = useState(false);
  const [confirmReturnAccount, setConfirmReturnAccount] = useState<AccountAwaitingTitle | null>(
    null
  );
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [mobileTab, setMobileTab] = useState<'timeline' | 'content'>('content');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTypeRef = useRef<ReleaseDocumentType | null>(null);
  const statusFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActiveItem(selectedItem);
  }, [selectedItem]);

  const activeTitle = activeItem?.type === 'title' ? activeItem.data : null;
  const activeAwaiting = activeItem?.type === 'awaiting' ? activeItem.data : null;

  const currentStageStatus: TitleStatus = activeTitle
    ? normalizeLifecycleStage(activeTitle.status)
    : 'Cleared by Billing';
  const currentStageIdx = LIFECYCLE_STAGES.findIndex((s) => s.status === currentStageStatus);

  const [selectedStage, setSelectedStage] = useState<TitleStatus>(currentStageStatus);
  const [isExecutiveSigned, setIsExecutiveSigned] = useState(false);

  useEffect(() => {
    setSelectedStage(
      activeTitle ? normalizeLifecycleStage(activeTitle.status) : 'Cleared by Billing'
    );
  }, [activeTitle, activeAwaiting?.account_id, open]);

  useEffect(() => {
    setIsExecutiveSigned(false);
  }, [activeTitle?.title_id]);

  const currentTct =
    activeTitle?.property?.title_number ?? activeAwaiting?.property?.title_number ?? '';

  useEffect(() => {
    setTitleNumberInput(currentTct);
    setIsEditingTct(!currentTct);
  }, [currentTct, open]);

  // Load release documents for the active title
  useEffect(() => {
    if (!open || !activeTitle?.title_id) return;
    let cancelled = false;
    setDocuments([]);
    setIsLoadingDocs(true);
    loadDocuments(activeTitle.title_id)
      .then((docs) => !cancelled && setDocuments(docs))
      .catch((err) => !cancelled && toast.error(err instanceof Error ? err.message : 'Failed to load docs'))
      .finally(() => !cancelled && setIsLoadingDocs(false));
    return () => {
      cancelled = true;
    };
  }, [open, activeTitle?.title_id, loadDocuments]);

  // Load notice records and RTS attachments
  useEffect(() => {
    if (!open || !activeTitle?.title_id) return;
    let cancelled = false;
    setNotices([]);
    setIsLoadingNotices(true);
    loadNotices(activeTitle.title_id)
      .then((data) => !cancelled && setNotices(data))
      .catch((err) => !cancelled && toast.error(err instanceof Error ? err.message : 'Failed to load notices'))
      .finally(() => !cancelled && setIsLoadingNotices(false));
    return () => {
      cancelled = true;
    };
  }, [open, activeTitle?.title_id, loadNotices]);

  if (!activeItem) return null;

  async function handleStartLegalProcessing() {
    if (!activeAwaiting) return;
    setIsStartingProcessing(true);
    try {
      const created = await onStartProcessing(activeAwaiting);
      if (created) {
        setActiveItem({ type: 'title', data: created });
        setSelectedStage('Document Preparation');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start legal processing');
    } finally {
      setIsStartingProcessing(false);
    }
  }

  async function handleConfirmReturnToBilling() {
    if (!confirmReturnAccount) return;
    setIsReturningToBilling(true);
    try {
      await onReturnToBilling(confirmReturnAccount);
      setConfirmReturnAccount(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to return to billing');
    } finally {
      setIsReturningToBilling(false);
    }
  }

  async function handleSaveTct(e: React.FormEvent) {
    e.preventDefault();
    const propertyId = activeTitle?.property_id ?? activeAwaiting?.property?.property_id;
    if (!propertyId) return;

    const trimmed = titleNumberInput.trim();
    if (!trimmed) {
      toast.error('Title number cannot be empty');
      return;
    }
    setIsSavingTct(true);
    try {
      await onUpdateTitleNumber(propertyId, trimmed);
      // Immediately reflect saved title number in local dialog state
      setActiveItem((prev) => {
        if (!prev) return prev;
        if (prev.type === 'title') {
          return {
            ...prev,
            data: {
              ...prev.data,
              property: prev.data.property
                ? { ...prev.data.property, title_number: trimmed }
                : {
                    property_id: propertyId,
                    block_number: 0,
                    lot_number: 0,
                    location: '',
                    title_number: trimmed,
                  },
            },
          };
        }
        if (prev.type === 'awaiting') {
          return {
            ...prev,
            data: {
              ...prev.data,
              property: {
                ...prev.data.property,
                title_number: trimmed,
              },
            },
          };
        }
        return prev;
      });
      setIsEditingTct(false);
      toast.success('Title number saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save title number');
    } finally {
      setIsSavingTct(false);
    }
  }

  function pickFile(type: ReleaseDocumentType) {
    pendingTypeRef.current = type;
    fileInputRef.current?.click();
  }

  async function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const type = pendingTypeRef.current;
    event.target.value = '';
    if (!file || !type || !activeTitle) return;

    setBusyDocType(type);
    try {
      const saved = await uploadDocument(activeTitle.title_id, type, file);
      setDocuments((prev) => [saved, ...prev.filter((d) => d.document_id !== saved.document_id)]);
      toast.success(`${DOC_TYPE_LABEL[type]} uploaded`);
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
      setDocuments((prev) => prev.filter((d) => d.document_id !== docToRemove.document_id));
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

  async function handleStatusChange(nextStatus: TitleStatus) {
    if (!activeTitle) return;
    setIsUpdatingStatus(true);
    try {
      const updates: { status: TitleStatus; clearance_started_at?: string | null } = {
        status: nextStatus,
      };
      if (nextStatus === 'Clearance Period') {
        updates.clearance_started_at = new Date().toISOString();
      }
      await onUpdateTitle(activeTitle.title_id, updates);
      const newHistory = [
        ...(activeTitle.history ?? []),
        {
          history_id: `temp-${Date.now()}`,
          title_id: activeTitle.title_id,
          status: nextStatus,
          changed_at: new Date().toISOString(),
          changed_by: null,
        },
      ];
      setActiveItem({
        type: 'title',
        data: {
          ...activeTitle,
          status: nextStatus,
          clearance_started_at: updates.clearance_started_at ?? activeTitle.clearance_started_at,
          history: newHistory,
        },
      });
      setSelectedStage(normalizeLifecycleStage(nextStatus));
      toast.success(`Status updated to "${nextStatus}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  // Generate Notice Letter and download A4 PDF directly
  async function handleGenerateNotice(noticeNumber: 1 | 2 | 3) {
    if (!activeTitle) return;
    setIsGeneratingNotice(noticeNumber);
    try {
      generateNoticePdf({
        noticeNumber,
        clientName,
        clientAddress: activeTitle.client?.address ?? null,
        propertyLocation,
        lotDescription: propertyRef,
        titleNumber: activeTitle.property?.title_number ?? null,
        titleId: activeTitle.title_id,
      });

      const existingNotice = notices.find((n) => n.notice_number === noticeNumber);
      if (!existingNotice) {
        const savedNotice = await recordNotice(activeTitle.title_id, noticeNumber);
        setNotices((prev) => [
          ...prev.filter((n) => n.notice_number !== noticeNumber),
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

  async function handleConfirmStartNotice(noticeNumber: 1 | 2 | 3) {
    if (!activeTitle) return;
    setIsStartingNotice(true);
    try {
      const created = await recordNotice(activeTitle.title_id, noticeNumber);
      setNotices((prev) => [
        ...prev.filter((n) => n.notice_number !== noticeNumber),
        created,
      ]);
      toast.success(
        `${noticeNumber === 1 ? '1st' : noticeNumber === 2 ? '2nd' : 'Final'} Notice started`
      );
      setConfirmStartNotice(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start notice');
    } finally {
      setIsStartingNotice(false);
    }
  }

  async function handleConfirmResolveNotice(noticeNumber: 1 | 2 | 3) {
    if (!activeTitle || !statusFileInput) return;
    setIsResolvingNotice(true);
    try {
      let updated: LandTitleNotice;
      if (resolveNotice) {
        updated = await resolveNotice(
          activeTitle.title_id,
          noticeNumber,
          noticeStatusChoice,
          statusFileInput,
          statusNotesInput.trim() || null
        );
      } else {
        updated = await uploadNoticeRts(
          activeTitle.title_id,
          noticeNumber,
          statusFileInput,
          statusNotesInput.trim() || null
        );
      }
      setNotices((prev) => [
        ...prev.filter((n) => n.notice_number !== noticeNumber),
        updated,
      ]);
      setStatusFileInput(null);
      setStatusNotesInput('');
      toast.success(
        `Notice ${noticeNumber} marked as ${
          noticeStatusChoice === 'received' ? 'Received' : 'Returned to Sender'
        }`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update notice status');
    } finally {
      setIsResolvingNotice(false);
    }
  }

  async function handleConfirmUndoNotice(noticeNumber: 1 | 2 | 3) {
    if (!activeTitle) return;
    setIsUndoingNotice(true);
    try {
      if (undoNoticeStatus) {
        await undoNoticeStatus(activeTitle.title_id, noticeNumber);
      } else {
        await deleteNoticeRts(activeTitle.title_id, noticeNumber);
      }
      setNotices((prev) =>
        prev.map((n) =>
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
      toast.success(`Notice ${noticeNumber} status reverted to Ongoing`);
      setConfirmUndoNotice(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to undo notice status');
    } finally {
      setIsUndoingNotice(false);
    }
  }

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

  async function handleConfirmUploadRts() {
    if (!rtsModalNotice || !rtsFileInput || !activeTitle) return;
    setIsUploadingRts(true);
    try {
      const updated = await uploadNoticeRts(
        activeTitle.title_id,
        rtsModalNotice,
        rtsFileInput,
        rtsReasonInput.trim() || null
      );
      setNotices((prev) => [
        ...prev.filter((n) => n.notice_number !== rtsModalNotice),
        updated,
      ]);
      toast.success(`Notice ${rtsModalNotice} RTS uploaded`);
      setRtsModalNotice(null);
      setRtsFileInput(null);
      setRtsReasonInput('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload RTS');
    } finally {
      setIsUploadingRts(false);
    }
  }

  const latestDocsByType = new Map<string, ClientDocument>();
  for (const doc of documents) {
    if (!latestDocsByType.has(doc.document_type)) latestDocsByType.set(doc.document_type, doc);
  }

  const requiredDocs = activeTitle ? getRequiredReleaseDocuments(activeTitle.is_legacy_transferred) : [];
  const missingDocs = activeTitle
    ? getMissingReleaseDocuments(activeTitle.is_legacy_transferred, latestDocsByType.keys())
    : [];
  const hasRecordedTct = Boolean(activeTitle?.property?.title_number?.trim());
  const packetIsComplete =
    activeTitle &&
    isReleasePacketComplete(activeTitle.is_legacy_transferred, latestDocsByType.keys(), hasRecordedTct);

  const clearance = getClearanceProgress(activeTitle?.clearance_started_at);

  const reviewSubmittedEntry = activeTitle?.history?.find((h) => h.status === 'For Review');
  const reviewApprovedEntry = activeTitle?.history?.find((h) => h.status === 'For Signature');
  const clearanceStartedEntry = activeTitle?.history?.find((h) => h.status === 'Clearance Period');

  const reviewSubmittedDate = reviewSubmittedEntry
    ? DATE_FORMAT.format(new Date(reviewSubmittedEntry.changed_at))
    : (activeTitle?.status === 'For Review' ? DATE_FORMAT.format(new Date(activeTitle.updated_at)) : null);

  const reviewApprovedDate = reviewApprovedEntry
    ? DATE_FORMAT.format(new Date(reviewApprovedEntry.changed_at))
    : (activeTitle?.status === 'For Signature' ? DATE_FORMAT.format(new Date(activeTitle.updated_at)) : null);

  const signedDate = clearanceStartedEntry
    ? DATE_FORMAT.format(new Date(clearanceStartedEntry.changed_at))
    : (isExecutiveSigned ? DATE_FORMAT.format(new Date()) : reviewApprovedDate);

  const isPastDocPrep = currentStageIdx > LIFECYCLE_STAGES.findIndex((s) => s.status === 'Document Preparation');
  const step1Done = Boolean(packetIsComplete);
  const step2Done = isPastDocPrep || activeTitle?.status === 'For Review' || activeTitle?.status === 'For Signature';
  const step3Done = isPastDocPrep || activeTitle?.status === 'For Signature';
  const step4Done = isPastDocPrep || (activeTitle?.status === 'For Signature' && isExecutiveSigned);

  function renderDocPrepLifecycleChecklist() {
    if (!step1Done && !step2Done) {
      const missingDesc = [
        missingDocs.length > 0 ? `${missingDocs.length} file${missingDocs.length > 1 ? 's' : ''} missing` : '',
        !hasRecordedTct ? 'Title number missing' : '',
      ].filter(Boolean).join(' • ');

      return (
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Circle className="h-3.5 w-3.5 shrink-0" />
          <span>{missingDesc || 'Missing required documents'}</span>
        </div>
      );
    }

    return (
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2 text-success font-medium">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>Release packet complete ({requiredDocs.length}/{requiredDocs.length})</span>
        </div>

        {step2Done ? (
          <div className="flex items-center gap-2 text-success font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Submitted for review ({reviewSubmittedDate ?? 'On record'})</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Circle className="h-3.5 w-3.5 shrink-0" />
            <span>Awaiting submission</span>
          </div>
        )}

        {step2Done && (
          step3Done ? (
            <div className="flex items-center gap-2 text-success font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Legal review approved ({reviewApprovedDate ?? 'On record'})</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Circle className="h-3.5 w-3.5 shrink-0" />
              <span>Pending legal supervisor review</span>
            </div>
          )
        )}

        {step3Done && (
          step4Done ? (
            <div className="flex items-center gap-2 text-success font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Signed by Executive Management ({signedDate ?? 'On record'})</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Circle className="h-3.5 w-3.5 shrink-0" />
              <span>Awaiting signature</span>
            </div>
          )
        )}
      </div>
    );
  }

  function getStageTimestamp(stageStatus: TitleStatus): string | null {
    if (stageStatus === 'Cleared by Billing') {
      if (activeAwaiting?.cleared_at) return activeAwaiting.cleared_at;
      const entry = activeTitle?.history?.find((h) => h.status === 'Cleared by Billing');
      return entry?.changed_at ?? activeTitle?.created_at ?? null;
    }
    const entry = activeTitle?.history?.find((h) => h.status === stageStatus);
    if (entry) return entry.changed_at;
    if (stageStatus === 'Document Preparation' && activeTitle) return activeTitle.created_at;
    if (stageStatus === 'Clearance Period' && activeTitle?.clearance_started_at) {
      return activeTitle.clearance_started_at;
    }
    return null;
  }

  function formatStageTime(timestamp: string | null): string | null {
    if (!timestamp) return null;
    const d = new Date(timestamp);
    return Number.isNaN(d.getTime()) ? null : formatActivityTime(d);
  }

  function formatFullStageTime(timestamp: string | null): string | null {
    if (!timestamp) return null;
    const d = new Date(timestamp);
    return Number.isNaN(d.getTime()) ? null : TIME_FORMAT.format(d);
  }

  const clientName = activeTitle?.client?.full_name ?? activeAwaiting?.client?.full_name ?? 'Client Account';
  const propertyRef = lotRefLabel(activeTitle?.property ?? activeAwaiting?.property);
  const propertyLocation = activeTitle?.property?.location ?? activeAwaiting?.property?.location ?? '';

  const reachedStages = LIFECYCLE_STAGES.slice(0, Math.max(0, currentStageIdx) + 1);
  const timelineStages = [...reachedStages].reverse();

  function formatDaysAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'ended today';
    if (diffDays === 1) return 'ended 1 day ago';
    return `ended ${diffDays} days ago`;
  }

  function getDynamicStageDescription(stageStatus: TitleStatus): string {
    if (stageStatus === 'Cleared by Billing') {
      const clearedAt =
        activeAwaiting?.cleared_at ??
        activeTitle?.history?.find((h) => h.status === 'Cleared by Billing')?.changed_at ??
        activeTitle?.created_at;
      return clearedAt
        ? `Cleared by Billing on ${DATE_FORMAT.format(new Date(clearedAt))}`
        : 'Account verified & cleared as fully paid';
    }

    if (stageStatus === 'Document Preparation') {
      return 'Packet assembly, supervisor review & executive signing';
    }

    if (stageStatus === 'Clearance Period') {
      if (clearance.isComplete && clearance.targetDate) {
        return `Clearance window ${formatDaysAgo(clearance.targetDate)}`;
      }
      if (clearance.isComplete) {
        return 'Clearance window ended';
      }
      if (activeTitle?.clearance_started_at) {
        return `${clearance.daysRemaining} days remaining in 30-day window`;
      }
      return '30-day internal clearance before release';
    }

    if (stageStatus === 'Ready for Claim') {
      if (notices.length > 0) {
        const sorted = [...notices].sort((a, b) => b.notice_number - a.notice_number);
        const latest = sorted[0];
        const nth =
          latest.notice_number === 1
            ? '1st'
            : latest.notice_number === 2
            ? '2nd'
            : 'Final';
        if (latest.status === 'returned_to_sender') {
          const timeStr = formatStageTime(latest.status_updated_at ?? latest.updated_at);
          return `${nth} notice returned to sender on ${timeStr ?? 'record'}`;
        }
        if (latest.status === 'received') {
          const timeStr = formatStageTime(latest.status_updated_at ?? latest.updated_at);
          return `${nth} notice received on ${timeStr ?? 'record'}`;
        }
        const timeStr = formatStageTime(latest.generated_at ?? latest.created_at);
        return `${nth} notice ongoing (started ${timeStr ?? 'record'})`;
      }
      return 'Original title & DOAS in vault awaiting buyer';
    }

    if (stageStatus === 'Released') {
      const releaseEntry = activeTitle?.history?.find((h) => h.status === 'Released');
      return releaseEntry
        ? `Physical packet released on ${DATE_FORMAT.format(new Date(releaseEntry.changed_at))}`
        : 'Physical packet turned over to buyer';
    }

    return 'Workflow stage';
  }

  // Left Column Lifecycle Progress navigation
  const timelineColumnContent = (
    <div className="space-y-3 pb-2">
      <div className="sticky top-0 bg-card z-10 flex items-center justify-between pb-2 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Lifecycle Progress
        </span>
        {selectedStage !== currentStageStatus && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedStage(currentStageStatus)}
            className="h-8 text-xs px-2.5 text-primary hover:text-primary gap-1.5"
          >
            <Target className="h-3.5 w-3.5" />
            Jump to Current
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {timelineStages.map((stage) => {
          const isCurrent = stage.status === currentStageStatus;
          const isSelected = stage.status === selectedStage;
          const timestamp = getStageTimestamp(stage.status);
          const formattedTime = formatStageTime(timestamp);
          const fullTime = formatFullStageTime(timestamp);
          const dynamicDesc = getDynamicStageDescription(stage.status);

          return (
            <div
              key={stage.status}
              className={cn(
                'rounded-xl border p-4 space-y-2 bg-card transition-shadow',
                isCurrent
                  ? 'border-border shadow-sm ring-1 ring-border/60'
                  : 'border-border/70'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isCurrent ? (
                    <span className="flex h-2 w-2 shrink-0 rounded-full bg-primary" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  )}
                  <span className="text-sm font-semibold text-foreground truncate">
                    {stage.label}
                  </span>
                </div>
                {isCurrent && (
                  <Badge variant="outline" className="text-xs font-normal shrink-0">
                    Current
                  </Badge>
                )}
              </div>

              {stage.status === 'Document Preparation' ? (
                <div className="pt-0.5">
                  {renderDocPrepLifecycleChecklist()}
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {dynamicDesc}
                  </p>

                  {formattedTime && (
                    <p
                      className="text-xs text-muted-foreground font-medium"
                      title={fullTime ?? undefined}
                    >
                      {formattedTime}
                    </p>
                  )}
                </>
              )}

              {!isSelected && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-sm gap-2 h-9 px-3.5 font-medium mt-1.5"
                  onClick={() => {
                    setSelectedStage(stage.status);
                    setMobileTab('content');
                  }}
                >
                  View {stage.label.toLowerCase()}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // Intake Queue Overview View
  const intakeColumnContent = (
    <div className="space-y-5">
      <Alert variant="info">
        <Inbox className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Billing cleared this account as fully paid
          {activeAwaiting?.cleared_at ? (
            <>
              {' '}on{' '}
              <span className="font-semibold text-foreground">
                {DATE_FORMAT.format(new Date(activeAwaiting.cleared_at))}
              </span>
            </>
          ) : null}
          . {activeAwaiting ? 'Accept this account to start document preparation, or return it to billing if there is a discrepancy.' : 'Account intake completed.'}
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Account Intake Overview
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Principal Buyer:</span>
            <p className="font-medium text-foreground">{clientName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Co-Buyers:</span>
            <p className="font-medium text-foreground">
              {activeAwaiting && activeAwaiting.co_buyers.length > 0
                ? activeAwaiting.co_buyers.join(', ')
                : 'None'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Property Lot:</span>
            <p className="font-medium text-foreground">{propertyRef}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Title Number on Lot:</span>
            <p className="font-mono text-foreground">
              {activeTitle?.property?.title_number ?? activeAwaiting?.property.title_number ?? 'Not yet recorded'}
            </p>
          </div>
        </div>
      </div>

      {activeAwaiting && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          {canEdit && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={isReturningToBilling || isStartingProcessing}
              onClick={() => setConfirmReturnAccount(activeAwaiting)}
              className="text-sm h-9 px-4 gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Send back to Billing
            </Button>
          )}
          {canCreate && (
            <Button
              type="button"
              size="sm"
              className="gap-2 ml-auto text-sm h-9 px-4"
              disabled={isStartingProcessing || isReturningToBilling}
              onClick={() => void handleStartLegalProcessing()}
            >
              {isStartingProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Start Legal Processing
            </Button>
          )}
        </div>
      )}
    </div>
  );

  function getNoticeTitle(num: number): string {
    if (num === 1) return '1st Notice';
    if (num === 2) return '2nd Notice';
    return 'Final Notice';
  }

  // Client Outreach & Notice Letters View (Ready for Claim)
  const noticesColumnContent = (() => {
    const sortedNotices = [...notices].sort((a, b) => a.notice_number - b.notice_number);
    const ongoingNotice = sortedNotices.find((n) => n.status === 'ongoing');
    const resolvedNotices = sortedNotices.filter((n) => n.status !== 'ongoing');
    const latestNotice = sortedNotices.length > 0 ? sortedNotices[sortedNotices.length - 1] : null;
    const latestNoticeNumber = latestNotice ? latestNotice.notice_number : 0;
    const nextNoticeNumber = (latestNoticeNumber + 1) as 1 | 2 | 3;

    return (
      <div className="space-y-4">
        {/* Ready for Claim Header & Turnover Release Button */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5 bg-card">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold text-foreground">Client Outreach &amp; Notice Letters</span>
          </div>
          {activeTitle?.status === 'Ready for Claim' && canEdit && (
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

        {/* Notices Stack in Single Column */}
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

          {/* 1. All resolved notices rendered chronologically */}
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
                {/* Left: Title, badge, and plain inline metadata */}
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

                {/* Right: Action buttons inline */}
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

                  {canEdit && (
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

          {/* 2. If there is an ONGOING notice: show Card 1 (ongoing) & Card 2 (update status) */}
          {ongoingNotice && (
            <>
              {/* Card 1: Ongoing notice */}
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

              {/* Card 2: Option to provide status update to the ongoing notice */}
              {canEdit && (
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
                    onClick={() => void handleConfirmResolveNotice(ongoingNotice.notice_number as 1 | 2 | 3)}
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

          {/* 3. If there is NO ongoing notice: */}
          {!ongoingNotice && (
            <>
              {sortedNotices.length === 0 ? (
                /* Initial State: Single card with 'Start 1st Notice' */
                <div className="rounded-lg border border-dashed border-border p-3.5 bg-card flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Start 1st Notice</span>
                    <Badge variant="muted" shape="pill" className="text-xs">
                      Pending
                    </Badge>
                  </div>
                  {canEdit && (
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
              ) : latestNoticeNumber < 3 ? (
                /* Escalation State: Next notice start button card */
                canEdit && (
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
                /* Final Notice Concluded: Static message card */
                <div className="rounded-lg border border-border p-3.5 bg-[color-mix(in_srgb,var(--card)_70%,var(--background))] flex items-center gap-2.5 text-sm text-muted-foreground">
                  <ShieldAlert className="h-4 w-4 text-warning shrink-0" />
                  <span>Notice cycle concluded. Title packet queued for legal counsel referral.</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  })();

  // Released / Finalized Turnover View
  const releasedColumnContent = (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg border border-border p-4 bg-card text-success">
        <CheckCircle2 className="h-6 w-6 shrink-0" />
        <div>
          <h4 className="text-base font-semibold text-foreground">Finalized &amp; Turned Over to Buyer</h4>
          <p className="text-sm text-muted-foreground">
            Original title certificate and notarized Deed of Absolute Sale (DOAS) have been formally handed over to the client.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Turnover Summary
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Client:</span>
            <p className="font-medium text-foreground">{clientName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Property Lot:</span>
            <p className="font-medium text-foreground">{propertyRef}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Title Number:</span>
            <p className="font-mono text-foreground">{activeTitle?.property?.title_number ?? 'N/A'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Location:</span>
            <p className="font-medium text-foreground">{propertyLocation}</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Clearance Period View
  const clearanceColumnContent = (
    <div className="space-y-5">
      <div className="rounded-xl border border-border p-5 bg-card space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">30-Day Clearance Period</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              {clearance.isComplete
                ? 'Clearance window has ended. Title is eligible to be marked ready for claim.'
                : clearance.targetDate
                ? `Clears on ${DATE_FORMAT.format(clearance.targetDate)} (${Math.max(0, clearance.daysRemaining)} days remaining)`
                : 'Clearance period active'}
            </p>
          </div>

          {activeTitle?.status === 'Clearance Period' && canEdit && (
            <Button
              size="sm"
              disabled={isUpdatingStatus || (!clearance.isComplete && !isAdmin)}
              onClick={() => setConfirmReadyForClaimOpen(true)}
              className="text-sm gap-2 h-9 px-4 shrink-0"
            >
              <FileCheck className="h-4 w-4" />
              Mark Ready for Claim
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  // Release Packet Workflow View (Doc Prep, Review, Signature)
  const packetColumnContent = (
    <div className="space-y-5">
      {activeTitle && (
        <>
          {/* Stage action controls at the top */}
          {activeTitle.status === 'Cleared by Billing' && canEdit && (
            <div className="rounded-lg border border-border p-3.5 bg-card">
              <Button
                size="sm"
                disabled={isUpdatingStatus}
                onClick={() => void handleStatusChange('Document Preparation')}
                className="w-full text-sm gap-2 h-9 px-4"
              >
                <ArrowRight className="h-4 w-4" />
                Begin Document Preparation
              </Button>
            </div>
          )}

          {/* Document Preparation Workflow Checklist */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <div className="space-y-0.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Document Preparation & Verification Workflow
                </h4>
                <p className="text-xs text-muted-foreground">
                  Track packet readiness, supervisor review, and executive sign-off.
                </p>
              </div>
              {isUpdatingStatus && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="space-y-3 pt-1">
              {/* Step 1: Release Packet Complete */}
              <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border/70 bg-card">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    {step1Done ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      Release Packet Documents & Title Number
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {step1Done
                        ? `Complete (${requiredDocs.length}/${requiredDocs.length} documents uploaded • Title number recorded)`
                        : `${missingDocs.length > 0 ? `${missingDocs.length} file${missingDocs.length > 1 ? 's' : ''} missing` : ''}${!hasRecordedTct ? (missingDocs.length > 0 ? ' • Title number missing' : 'Title number missing') : ''}`}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={step1Done ? 'success' : 'outline'}
                  shape="pill"
                  className="text-xs shrink-0"
                >
                  {step1Done ? 'Complete' : 'Incomplete'}
                </Badge>
              </div>

              {/* Step 2: Submitted for Review */}
              <div className={cn(
                'flex items-start justify-between gap-3 p-3 rounded-lg border transition-colors',
                step2Done ? 'border-border bg-card' : 'border-border/70 bg-card'
              )}>
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    <Checkbox
                      id="step-submitted-review"
                      checked={step2Done}
                      disabled={isUpdatingStatus || !canEdit || !step1Done || isPastDocPrep}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          void handleStatusChange('For Review');
                        } else if (activeTitle?.status === 'For Review') {
                          void handleStatusChange('Document Preparation');
                        }
                      }}
                      className="h-4 w-4"
                    />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <label
                      htmlFor="step-submitted-review"
                      className="text-sm font-semibold text-foreground cursor-pointer"
                    >
                      Submitted for Review
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {step2Done
                        ? `Submitted for legal review on ${reviewSubmittedDate ?? 'record'}`
                        : step1Done
                        ? 'Ready for submission to legal supervisor'
                        : 'Requires complete release packet and title number'}
                    </p>
                  </div>
                </div>
                {step2Done && reviewSubmittedDate && (
                  <span className="text-xs font-medium text-muted-foreground shrink-0 self-center">
                    {reviewSubmittedDate}
                  </span>
                )}
              </div>

              {/* Step 3: Legal Supervisor Review Approved */}
              <div className={cn(
                'flex items-start justify-between gap-3 p-3 rounded-lg border transition-colors',
                step3Done ? 'border-border bg-card' : 'border-border/70 bg-card'
              )}>
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    <Checkbox
                      id="step-review-approved"
                      checked={step3Done}
                      disabled={isUpdatingStatus || !canEdit || !step2Done || isPastDocPrep}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          void handleStatusChange('For Signature');
                        } else if (activeTitle?.status === 'For Signature') {
                          void handleStatusChange('For Review');
                        }
                      }}
                      className="h-4 w-4"
                    />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <label
                      htmlFor="step-review-approved"
                      className="text-sm font-semibold text-foreground cursor-pointer"
                    >
                      Legal Supervisor Review Approved
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {step3Done
                        ? `Supervisor review verified on ${reviewApprovedDate ?? 'record'}`
                        : step2Done
                        ? 'Pending supervisor verification of technical description'
                        : 'Awaiting submission for review'}
                    </p>
                  </div>
                </div>
                {step3Done && reviewApprovedDate && (
                  <span className="text-xs font-medium text-muted-foreground shrink-0 self-center">
                    {reviewApprovedDate}
                  </span>
                )}
              </div>

              {/* Step 4: Executive Management Signature */}
              <div className={cn(
                'p-3 rounded-lg border transition-colors space-y-3',
                step4Done ? 'border-border bg-card' : 'border-border/70 bg-card'
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      <Checkbox
                        id="step-executive-signature"
                        checked={step4Done}
                        disabled={isUpdatingStatus || !canEdit || !step3Done || isPastDocPrep}
                        onCheckedChange={(checked) => {
                          setIsExecutiveSigned(Boolean(checked));
                        }}
                        className="h-4 w-4"
                      />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <label
                        htmlFor="step-executive-signature"
                        className="text-sm font-semibold text-foreground cursor-pointer"
                      >
                        Signed by Executive Management
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {step4Done
                          ? `Signed & notarized on ${signedDate ?? 'record'}`
                          : step3Done
                          ? 'Awaiting executive management sign-off & notarization'
                          : 'Awaiting legal supervisor approval'}
                      </p>
                    </div>
                  </div>
                  {step4Done && signedDate && (
                    <span className="text-xs font-medium text-muted-foreground shrink-0 self-center">
                      {signedDate}
                    </span>
                  )}
                </div>

                {/* Button to start 30-Day Clearance once signed */}
                {step4Done && activeTitle?.status === 'For Signature' && canEdit && (
                  <div className="pt-2 pl-7 flex items-center justify-between gap-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      All preparation steps complete. Begin 30-day clearance window:
                    </span>
                    <Button
                      size="sm"
                      disabled={isUpdatingStatus}
                      onClick={() => void handleStatusChange('Clearance Period')}
                      className="text-sm gap-2 h-9 px-4 shrink-0 font-medium"
                    >
                      <Calendar className="h-4 w-4" />
                      Start 30-Day Clearance
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Title Number Card */}
          <div className="rounded-lg border border-border p-4 bg-card space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Title number on {[propertyRef, propertyLocation].filter(Boolean).join(', ')}
                </span>
                {!isEditingTct && activeTitle.property?.title_number ? (
                  <p className="font-mono text-sm font-semibold text-foreground mt-0.5">
                    {activeTitle.property.title_number}
                  </p>
                ) : !isEditingTct ? (
                  <p className="text-sm text-warning font-medium mt-0.5">
                    No title number recorded on lot (Required to submit for review)
                  </p>
                ) : null}
              </div>
              {canEdit && !isEditingTct && (
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  onClick={() => setIsEditingTct(true)}
                  className="gap-1.5 text-sm h-8.5 px-3"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </div>

            {isEditingTct && (
              <form onSubmit={handleSaveTct} className="mt-2 flex items-center gap-2">
                <Input
                  value={titleNumberInput}
                  onChange={(e) => setTitleNumberInput(e.target.value)}
                  placeholder="e.g. T-123456"
                  className="h-9 font-mono text-sm flex-1"
                  autoFocus
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-9 px-4 text-sm"
                  disabled={isSavingTct || !titleNumberInput.trim()}
                >
                  {isSavingTct ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                </Button>
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  className="h-9 px-4 text-sm"
                  onClick={() => setIsEditingTct(false)}
                >
                  Cancel
                </Button>
              </form>
            )}
          </div>

          {/* Release Packet Checklist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                Release Packet Documents
                {isLoadingDocs && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </h4>
              <span className="text-sm text-muted-foreground">
                {requiredDocs.length - missingDocs.length} of {requiredDocs.length} uploaded
              </span>
            </div>

            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {RELEASE_DOCUMENT_TYPES.map((type) => {
                const isSkipped = type === 'Deed of Sale' && activeTitle.is_legacy_transferred;
                const doc = latestDocsByType.get(type);
                const isBusy = busyDocType === type;

                return (
                  <div
                    key={type}
                    className="flex items-center justify-between gap-3 p-3.5 text-sm hover:bg-row-hover transition-colors"
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
                        <p className="font-medium text-foreground truncate">
                          {DOC_TYPE_LABEL[type]}
                        </p>
                        {isSkipped ? (
                          <p className="text-xs text-muted-foreground italic">
                            Omitted — Title already in client name
                          </p>
                        ) : doc ? (
                          <p className="text-xs text-muted-foreground truncate">
                            {formatDocumentName(doc.file_path)} • {DATE_FORMAT.format(new Date(doc.uploaded_at))}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Required for turnover</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {doc && (
                        <>
                          <Button
                            type="button"
                            variant="quiet"
                            size="sm"
                            className="h-8.5 w-8.5 p-0"
                            onClick={() => void handleViewDoc(doc)}
                            title="View document"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          {canEdit && (
                            <Button
                              type="button"
                              variant="quiet"
                              size="sm"
                              className="h-8.5 w-8.5 p-0 text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)]"
                              onClick={() => setDocToRemove(doc)}
                              title="Remove document"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                      {!isSkipped && canEdit && (
                        <Button
                          type="button"
                          variant="quiet"
                          size="sm"
                          className="h-8.5 px-3.5 text-sm gap-1.5"
                          disabled={isBusy}
                          onClick={() => pickFile(type)}
                        >
                          {isBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                          {doc ? 'Replace' : 'Upload'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // Route active content based on selectedStage
  const activeContent = (() => {
    if (selectedStage === 'Cleared by Billing') {
      return intakeColumnContent;
    }
    if (selectedStage === 'Clearance Period') {
      return clearanceColumnContent;
    }
    if (selectedStage === 'Ready for Claim') {
      return noticesColumnContent;
    }
    if (selectedStage === 'Released') {
      return releasedColumnContent;
    }
    return packetColumnContent;
  })();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl w-[95vw] h-[90vh] max-h-[90vh] flex flex-col p-6 sm:p-8 overflow-hidden">
          <DialogHeader className="pb-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <Badge
                variant={TITLE_STATUS_VARIANT[currentStageStatus] ?? 'muted'}
                shape="pill"
                dot
              >
                {currentStageStatus}
              </Badge>
              {activeTitle?.is_legacy_transferred && (
                <Badge variant="outline" className="text-xs">
                  Legacy Pre-Transferred
                </Badge>
              )}
            </div>
            <DialogTitle className="text-xl">
              {propertyRef} <span className="text-muted-foreground font-normal">• {propertyLocation}</span>
            </DialogTitle>
            <DialogDescription className="text-sm">
              {clientName}
            </DialogDescription>
          </DialogHeader>

          {/* Mobile Tab Switcher */}
          <div className="md:hidden flex-1 min-h-0 overflow-y-auto pt-2">
            <Tabs
              value={mobileTab}
              onValueChange={(val) => setMobileTab(val as 'timeline' | 'content')}
            >
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="timeline" className="text-sm">Timeline</TabsTrigger>
                <TabsTrigger value="content" className="text-sm">
                  {selectedStage === 'Ready for Claim'
                    ? 'Notices & Actions'
                    : selectedStage === 'Cleared by Billing'
                    ? 'Intake Details'
                    : selectedStage === 'Clearance Period'
                    ? 'Clearance Details'
                    : 'Document Preparation'}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="timeline" className="pt-4">
                {timelineColumnContent}
              </TabsContent>
              <TabsContent value="content" className="pt-4">
                {activeContent}
              </TabsContent>
            </Tabs>
          </div>

          {/* Desktop Two-Column Layout with Independent Scrolling */}
          <div className="hidden md:grid md:grid-cols-12 gap-8 flex-1 min-h-0 pt-4 overflow-hidden">
            <div className="md:col-span-5 lg:col-span-4 border-r border-border pr-4 lg:pr-6 overflow-y-auto h-full min-h-0">
              {timelineColumnContent}
            </div>
            <div className="md:col-span-7 lg:col-span-8 pl-1 lg:pl-3 pr-2 overflow-y-auto h-full min-h-0">
              {activeContent}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        accept={DOCUMENT_FILE_ACCEPT}
        className="hidden"
        onChange={handleFileChosen}
      />

      {/* RTS Upload Dialog */}
      <Dialog
        open={rtsModalNotice !== null}
        onOpenChange={(isOpen) => !isOpen && setRtsModalNotice(null)}
      >
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Upload Return to Sender (RTS) Scan</DialogTitle>
            <DialogDescription className="text-sm">
              Upload courier or postal proof of non-delivery for Notice {rtsModalNotice}. This unlocks subsequent notice letters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <label className="font-medium text-foreground">RTS Reason (Optional)</label>
              <Input
                placeholder="e.g. Unclaimed, Moved / Incomplete address, Refused to receive"
                value={rtsReasonInput}
                onChange={(e) => setRtsReasonInput(e.target.value)}
                className="h-8.5 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-medium text-foreground">Scan Document (PDF, JPEG, PNG)</label>
              <Input
                type="file"
                accept={DOCUMENT_FILE_ACCEPT}
                onChange={(e) => setRtsFileInput(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="quiet"
              size="sm"
              onClick={() => setRtsModalNotice(null)}
              disabled={isUploadingRts}
              className="text-sm h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!rtsFileInput || isUploadingRts}
              onClick={() => void handleConfirmUploadRts()}
              className="text-sm gap-2 h-9 px-4"
            >
              {isUploadingRts ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload RTS
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Confirmation Alert to Return Account to Billing */}
      <AlertDialog
        open={confirmReturnAccount !== null}
        onOpenChange={(open) => !open && setConfirmReturnAccount(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return account to Billing?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This will remove this account from Legal intake and return it to Billing as uncleared.
              Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmReturnToBilling()}
              className="bg-destructive text-destructive-foreground hover:opacity-90"
            >
              Confirm Return
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Alert to Mark Ready for Claim */}
      <AlertDialog
        open={confirmReadyForClaimOpen}
        onOpenChange={setConfirmReadyForClaimOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {clearance.isComplete
                ? 'Mark Title Ready for Claim?'
                : 'Mark Ready for Claim (Early Clearance)?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {clearance.isComplete
                ? 'The 30-day internal clearance period has concluded. This will move the title to Ready for Claim in the vault and enable client notice letters or turnover to the buyer.'
                : `The 30-day clearance period is still ongoing (${Math.max(0, clearance.daysRemaining)} days remaining). Marking this ready now will bypass the remaining clearance window and make the title ready for client release. Are you sure you want to proceed?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingStatus}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isUpdatingStatus}
              onClick={() => {
                setConfirmReadyForClaimOpen(false);
                void handleStatusChange('Ready for Claim');
              }}
              className="bg-primary text-primary-foreground hover:opacity-90"
            >
              {isUpdatingStatus ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Alert to Record Release to Buyer */}
      <AlertDialog open={confirmReleaseOpen} onOpenChange={setConfirmReleaseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Title Release to Buyer</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to record the physical turnover of this title to the buyer?
              This marks the title packet as officially Released and concludes the titling workflow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmReleaseOpen(false);
                void handleStatusChange('Released');
              }}
              className="bg-primary text-primary-foreground hover:opacity-90"
            >
              Confirm Release
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                  void handleConfirmStartNotice(confirmStartNotice);
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
                  void handleConfirmUndoNotice(confirmUndoNotice);
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
    </>
  );
}
