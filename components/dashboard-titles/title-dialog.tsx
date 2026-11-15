'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isStageReachable } from '@/lib/title-progress';
import { useLandTitles, type TitleDialogItem } from '@/lib/hooks/use-land-titles';
import { useMutation } from '@/lib/hooks/use-mutation';
import type { ClientDocument } from '@/lib/types/client';
import type { LandTitle, LandTitleNotice, TitleStatus } from '@/lib/types/title';
import { TitleDialogHeader } from './title-dialog-header';
import {
  TitleTimelineView,
  normalizeLifecycleStage,
} from './title-timeline-view';
import { TitleIntakeTab } from './title-intake-tab';
import { TitlePacketTab } from './title-packet-tab';
import { TitleClearanceTab } from './title-clearance-tab';
import { TitleNoticesTab } from './title-notices-tab';
import { TitleReleasedTab } from './title-released-tab';

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

  /*
    Which stage's page the right column shows.

    `selectedStage` can only ever name a stage the record has reached — the rail
    disables the rest — but it is also reset by the effects above, and those run
    against `activeTitle` a render behind in the cases where a status change
    arrives from a stage page. Clamping here means a stale selection can never
    paint a page for a stage the record is not in, whatever order the updates
    land in.
  */
  const shownStage: TitleStatus = isStageReachable(activeItem, selectedStage)
    ? selectedStage
    : currentStageStatus;

  const activeContent = (() => {
    if (shownStage === 'Cleared by Billing') {
      return (
        <TitleIntakeTab
          item={activeItem}
          onStartedProcessing={handleStartedProcessing}
        />
      );
    }
    if (shownStage === 'Clearance Period' && activeTitle) {
      return (
        <TitleClearanceTab
          title={activeTitle}
          onStatusChange={(status) => void runUpdateStatus(status)}
          isUpdatingStatus={isUpdatingStatus}
        />
      );
    }
    if (shownStage === 'Ready for Claim' && activeTitle) {
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
    if (shownStage === 'Released' && activeTitle) {
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
        {/*
          The header carries identity and nothing else; the five-step strip and
          the status badge that used to share this row are both below it now —
          the strip in the rail, the status in the band. See
          `title-dialog-header.tsx` for what each cost the layout and why
          removing them was the fix rather than shrinking anything.
        */}
        <DialogHeader className="shrink-0 border-b border-border bg-card text-left sm:text-left gap-0 pr-12 sm:pr-14">
          <TitleDialogHeader item={activeItem} />
        </DialogHeader>

        {/* Mobile Tab Switcher */}
        <div className="md:hidden flex-1 min-h-0 overflow-y-auto px-5 pt-2 pb-5">
          <Tabs
            value={mobileTab}
            onValueChange={(val) => setMobileTab(val as 'timeline' | 'content')}
          >
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="timeline" className="text-sm">Timeline</TabsTrigger>
              <TabsTrigger value="content" className="text-sm">
                {shownStage === 'Ready for Claim'
                  ? 'Notices & Actions'
                  : shownStage === 'Cleared by Billing'
                  ? 'Intake Details'
                  : shownStage === 'Clearance Period'
                  ? 'Clearance Details'
                  : shownStage === 'Released'
                  ? 'Turnover Dossier'
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

        {/*
          The page gutter. `px-6 py-6` and an 8-unit column gap, from `px-6 py-5`
          and 6: the rail's rows and the stage page's cards had 20px of air
          against the dialog edge and 24px between the two columns, which read
          as the two sides crowding each other. The right column's `pr-1` is
          what the scroll container needs so a raised shadow is not clipped —
          the extra gutter is on the left of it, so the visible space between
          the rail's border and the first card is the grid gap plus this.
        */}
        {/* Desktop Two-Column Layout */}
        <div className="hidden md:grid md:grid-cols-12 gap-8 flex-1 min-h-0 px-6 py-6 overflow-hidden">
          {/*
            No `border-r` down this column. The rail's rows are already a
            bordered, divided list, so a rule beside them is a third vertical
            edge in a 350px column — and it ran the full height of the grid cell
            while the list beside it ended after five rows, which made the
            divider look like it belonged to the page rather than to either
            column. The 8-unit grid gap and the rail's own border separate the
            two sides without a line drawn between them.
          */}
          <div className="md:col-span-5 lg:col-span-4 pr-7 overflow-y-auto h-full min-h-0">
            <TitleTimelineView
              item={activeItem}
              selectedStage={selectedStage}
              onSelectStage={setSelectedStage}
              documents={documents}
              notices={notices}
              isExecutiveSigned={isExecutiveSigned}
            />
          </div>
          <div className="md:col-span-7 lg:col-span-8 overflow-y-auto h-full min-h-0 pr-1">
            {activeContent}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
