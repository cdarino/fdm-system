'use client';

import { useEffect, useState } from 'react';
import { Check, ClipboardCheck, FileText, PenLine, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TITLE_STATUS_VARIANT } from '@/lib/status-colors';
import {
  useLandTitles,
  lotRefLabel,
  type TitleDialogItem,
} from '@/lib/hooks/use-land-titles';
import { useMutation } from '@/lib/hooks/use-mutation';
import type { ClientDocument } from '@/lib/types/client';
import type { LandTitle, LandTitleNotice, TitleStatus } from '@/lib/types/title';
import {
  TitleTimelineView,
  normalizeLifecycleStage,
} from './title-timeline-view';
import { TitleIntakeTab } from './title-intake-tab';
import { TitlePacketTab } from './title-packet-tab';
import { TitleClearanceTab } from './title-clearance-tab';
import { TitleNoticesTab } from './title-notices-tab';
import { TitleReleasedTab } from './title-released-tab';

const COMPANY_WORKFLOW_STEPS = [
  { label: 'Account settlement', shortLabel: 'Payment', icon: Wallet },
  { label: 'Document preparation', shortLabel: 'Preparation', icon: FileText },
  { label: 'Legal verification', shortLabel: 'Verification', icon: ClipboardCheck },
  { label: 'Executive signature', shortLabel: 'Signature', icon: PenLine },
  { label: 'Title release', shortLabel: 'Release', icon: Check },
] as const;

function getCompanyWorkflowStep(status: TitleStatus, isExecutiveSigned: boolean) {
  switch (status) {
    case 'Cleared by Billing':
      return 0;
    case 'Document Preparation':
      return 1;
    case 'For Review':
      return 2;
    case 'For Signature':
      return isExecutiveSigned ? 4 : 3;
    case 'Clearance Period':
    case 'Ready for Claim':
      return 4;
    case 'Released':
      return COMPANY_WORKFLOW_STEPS.length;
  }
}

function CompanyWorkflowProgress({
  status,
  isExecutiveSigned,
}: {
  status: TitleStatus;
  isExecutiveSigned: boolean;
}) {
  const currentStep = getCompanyWorkflowStep(status, isExecutiveSigned);
  const detail =
    status === 'Clearance Period'
      ? 'Executive signature confirmed · 30-day internal clearance is underway'
      : status === 'Ready for Claim'
        ? 'Cleared for claim · title and DOAS are awaiting physical handover'
        : status === 'Released'
          ? 'Physical title packet has been handed over'
          : status === 'For Review'
            ? 'Legal supervisor is checking the document packet'
            : status === 'For Signature'
              ? isExecutiveSigned
                ? 'Executive signature confirmed · start internal clearance to continue'
                : 'Awaiting executive signature and notarization'
              : status === 'Document Preparation'
                ? 'Legal is compiling the buyer file and turnover documents'
                : 'Billing has verified and cleared the account';

  return (
    <section aria-label="Title claim workflow" className="shrink-0 border-b border-border bg-muted/20 px-4 py-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Title claim workflow
        </p>
        <p className="text-xs text-muted-foreground" aria-live="polite">{detail}</p>
      </div>
      <ol className="grid grid-cols-5 gap-1 sm:gap-3">
        {COMPANY_WORKFLOW_STEPS.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep && currentStep < COMPANY_WORKFLOW_STEPS.length;
          const Icon = isComplete ? Check : step.icon;

          return (
            <li
              key={step.label}
              aria-current={isCurrent ? 'step' : undefined}
              className="relative min-w-0 text-center"
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-4 z-0 h-0.5 w-full ${isComplete ? 'bg-success' : 'bg-border'}`}
                />
              )}
              <span
                className={`relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full border bg-card ${
                  isComplete
                    ? 'border-success bg-success text-success-foreground'
                    : isCurrent
                      ? 'border-primary text-primary ring-4 ring-[color-mix(in_srgb,var(--primary)_12%,white)]'
                      : 'border-border text-muted-foreground'
                }`}
              >
                {currentStep === COMPANY_WORKFLOW_STEPS.length && index === COMPANY_WORKFLOW_STEPS.length - 1 ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
              <span className={`mt-1.5 block truncate text-[10px] font-medium sm:hidden ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.shortLabel}
              </span>
              <span className={`mt-1.5 hidden text-xs font-medium sm:block ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
              <span className="sr-only">
                {isComplete ? 'Complete' : isCurrent ? 'Current step' : 'Not started'}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

interface TitleDialogProps {
  open: boolean;
  dialogItem?: TitleDialogItem | null;
  onOpenChange?: (open: boolean) => void;
}

export function TitleDialog({
  open,
  dialogItem,
  onOpenChange,
}: TitleDialogProps) {
  const {
    activeDialog,
    closeDialog,
    updateActiveDialogItem,
    loadDocuments,
    loadNotices,
    updateTitle,
  } = useLandTitles();

  const currentItem = dialogItem ?? (activeDialog?.type === 'detail' ? activeDialog.item : null);
  const [activeItem, setActiveItem] = useState<TitleDialogItem | null>(currentItem);

  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  const [notices, setNotices] = useState<LandTitleNotice[]>([]);
  const [isLoadingNotices, setIsLoadingNotices] = useState(false);

  const [isExecutiveSigned, setIsExecutiveSigned] = useState(false);
  const [mobileTab, setMobileTab] = useState<'timeline' | 'content'>('content');

  useEffect(() => {
    setActiveItem(currentItem);
  }, [currentItem]);

  const activeTitle = activeItem?.type === 'title' ? activeItem.data : null;
  const activeAwaiting = activeItem?.type === 'awaiting' ? activeItem.data : null;

  const currentStageStatus: TitleStatus = activeTitle
    ? normalizeLifecycleStage(activeTitle.status)
    : 'Cleared by Billing';

  const [selectedStage, setSelectedStage] = useState<TitleStatus>(currentStageStatus);

  useEffect(() => {
    setSelectedStage(
      activeTitle ? normalizeLifecycleStage(activeTitle.status) : 'Cleared by Billing'
    );
  }, [activeTitle, activeAwaiting?.account_id, open]);

  useEffect(() => {
    setIsExecutiveSigned(false);
  }, [activeTitle?.title_id]);

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

  const { state: updateStatusState, execute: runUpdateStatus } = useMutation(
    async (arg: TitleStatus | { nextStatus: TitleStatus; reason?: string }) => {
      if (!activeTitle) return;
      const nextStatus = typeof arg === 'string' ? arg : arg.nextStatus;
      const reason = typeof arg === 'string' ? undefined : arg.reason;

      const updates: { status: TitleStatus; clearance_started_at?: string | null } = {
        status: nextStatus,
      };
      if (nextStatus === 'Clearance Period') {
        updates.clearance_started_at = new Date().toISOString();
      }
      const res = await updateTitle(activeTitle.title_id, updates);
      if (!res.success) throw new Error(res.error);

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

      const updatedTitle: LandTitle = {
        ...activeTitle,
        status: nextStatus,
        clearance_started_at: updates.clearance_started_at ?? activeTitle.clearance_started_at,
        history: newHistory,
      };

      const newItem: TitleDialogItem = { type: 'title', data: updatedTitle };
      setActiveItem(newItem);
      updateActiveDialogItem(newItem);
      setSelectedStage(normalizeLifecycleStage(nextStatus));
      return { updatedTitle, reason };
    },
    {
      onSuccess: (result) => {
        if (!result) return;
        const { updatedTitle, reason } = result;
        if (reason) {
          toast.info(`Status updated to "${updatedTitle.status}"`, {
            description: `Reason: ${reason}`,
          });
        } else {
          toast.success(`Status updated to "${updatedTitle.status}"`);
        }
      },
    }
  );

  const isUpdatingStatus = updateStatusState.status === 'pending';

  if (!activeItem) return null;

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      closeDialog();
      onOpenChange?.(false);
    }
  }

  function handleStartedProcessing(created: LandTitle) {
    const newItem: TitleDialogItem = { type: 'title', data: created };
    setActiveItem(newItem);
    updateActiveDialogItem(newItem);
    setSelectedStage('Document Preparation');
  }

  function handleTitleReleased(released: LandTitle) {
    const newItem: TitleDialogItem = { type: 'title', data: released };
    setActiveItem(newItem);
    updateActiveDialogItem(newItem);
    setSelectedStage('Released');
  }

  const clientName = activeTitle?.client?.full_name ?? activeAwaiting?.client?.full_name ?? 'Client Account';
  const propertyRef = lotRefLabel(activeTitle?.property ?? activeAwaiting?.property);
  const propertyLocation = activeTitle?.property?.location ?? activeAwaiting?.property?.location ?? '';

  const activeContent = (() => {
    if (selectedStage === 'Cleared by Billing') {
      return (
        <TitleIntakeTab
          item={activeItem}
          onStartedProcessing={handleStartedProcessing}
        />
      );
    }
    if (selectedStage === 'Clearance Period' && activeTitle) {
      return (
        <TitleClearanceTab
          title={activeTitle}
          onStatusChange={(status) => void runUpdateStatus(status)}
          isUpdatingStatus={isUpdatingStatus}
        />
      );
    }
    if (selectedStage === 'Ready for Claim' && activeTitle) {
      return (
        <TitleNoticesTab
          title={activeTitle}
          notices={notices}
          onNoticesChange={setNotices}
          isLoadingNotices={isLoadingNotices}
          onStatusChange={(status) => void runUpdateStatus(status)}
          isUpdatingStatus={isUpdatingStatus}
          onTitleReleased={handleTitleReleased}
        />
      );
    }
    if (selectedStage === 'Released' && activeTitle) {
      return <TitleReleasedTab title={activeTitle} />;
    }
    if (activeTitle) {
      return (
        <TitlePacketTab
          title={activeTitle}
          documents={documents}
          onDocumentsChange={setDocuments}
          isLoadingDocs={isLoadingDocs}
          isExecutiveSigned={isExecutiveSigned}
          setIsExecutiveSigned={setIsExecutiveSigned}
          onStatusChange={(status, reason) => void runUpdateStatus({ nextStatus: status, reason })}
          isUpdatingStatus={isUpdatingStatus}
        />
      );
    }
    return null;
  })();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl w-[95vw] h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 sm:px-7 sm:pt-7 shrink-0">
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

        <CompanyWorkflowProgress
          status={activeTitle?.status ?? 'Cleared by Billing'}
          isExecutiveSigned={isExecutiveSigned}
        />

        {/* Mobile Tab Switcher */}
        <div className="md:hidden flex-1 min-h-0 overflow-y-auto px-5 pt-2 pb-5">
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
              <TitleTimelineView
                item={activeItem}
                selectedStage={selectedStage}
                onSelectStage={(stage) => {
                  setSelectedStage(stage);
                  setMobileTab('content');
                }}
                documents={documents}
                notices={notices}
                isExecutiveSigned={isExecutiveSigned}
              />
            </TabsContent>
            <TabsContent value="content" className="pt-4">
              {activeContent}
            </TabsContent>
          </Tabs>
        </div>

        {/* Desktop Two-Column Layout */}
        <div className="hidden md:grid md:grid-cols-12 gap-6 flex-1 min-h-0 px-6 py-5 overflow-hidden">
          <div className="md:col-span-5 lg:col-span-4 border-r border-border pr-4 lg:pr-6 overflow-y-auto h-full min-h-0">
            <TitleTimelineView
              item={activeItem}
              selectedStage={selectedStage}
              onSelectStage={setSelectedStage}
              documents={documents}
              notices={notices}
              isExecutiveSigned={isExecutiveSigned}
            />
          </div>
          <div className="md:col-span-7 lg:col-span-8 pl-1 lg:pl-3 pr-2 overflow-y-auto h-full min-h-0">
            {activeContent}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
