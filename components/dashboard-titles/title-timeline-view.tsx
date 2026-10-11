'use client';

import { ArrowRight, CheckCircle2, Circle, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatActivityTime } from '@/lib/format-activity-time';
import { getClearanceProgress } from './title-record-card';
import {
  getMissingReleaseDocuments,
  getRequiredReleaseDocuments,
  isReleasePacketComplete,
} from '@/lib/utils/release-requirements';
import type { TitleDialogItem } from '@/lib/hooks/use-land-titles';
import type { ClientDocument } from '@/lib/types/client';
import type { LandTitleNotice, TitleStatus } from '@/lib/types/title';

const DATE_FORMAT = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });
const TIME_FORMAT = new Intl.DateTimeFormat('en-PH', { dateStyle: 'short', timeStyle: 'short' });

export const LIFECYCLE_STAGES: { status: TitleStatus; label: string; desc: string }[] = [
  { status: 'Cleared by Billing', label: 'Cleared by Billing', desc: 'Account verified & cleared as fully paid' },
  { status: 'Document Preparation', label: 'Document Preparation', desc: 'Packet assembly, review & signing' },
  { status: 'Clearance Period', label: 'Clearance Period', desc: '30-day internal clearance before release' },
  { status: 'Ready for Claim', label: 'Ready for Claim', desc: 'Original title & DOAS in vault awaiting buyer' },
  { status: 'Released', label: 'Released', desc: 'Physical packet turned over to buyer' },
];

export function normalizeLifecycleStage(status: TitleStatus): TitleStatus {
  if (status === 'For Review' || status === 'For Signature') return 'Document Preparation';
  return status;
}

interface TitleTimelineViewProps {
  item: TitleDialogItem;
  selectedStage: TitleStatus;
  onSelectStage: (stage: TitleStatus) => void;
  documents: ClientDocument[];
  notices: LandTitleNotice[];
  isExecutiveSigned?: boolean;
}

export function TitleTimelineView({
  item,
  selectedStage,
  onSelectStage,
  documents,
  notices,
  isExecutiveSigned = false,
}: TitleTimelineViewProps) {
  const activeTitle = item.type === 'title' ? item.data : null;
  const activeAwaiting = item.type === 'awaiting' ? item.data : null;

  const currentStageStatus: TitleStatus = activeTitle
    ? normalizeLifecycleStage(activeTitle.status)
    : 'Cleared by Billing';
  const currentStageIdx = LIFECYCLE_STAGES.findIndex((s) => s.status === currentStageStatus);

  const clearance = getClearanceProgress(activeTitle?.clearance_started_at);

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

  function formatDaysAgo(date: Date): string {
    const diffMs = Date.now() - date.getTime();
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

  const reachedStages = LIFECYCLE_STAGES.slice(0, Math.max(0, currentStageIdx) + 1);
  const timelineStages = [...reachedStages].reverse();

  return (
    <div className="space-y-3 pb-2">
      <div className="sticky top-0 bg-card z-10 flex items-center justify-between pb-2 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Lifecycle Progress
        </span>
        {selectedStage !== currentStageStatus && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectStage(currentStageStatus)}
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
                  ? 'border-border shadow-2xs ring-1 ring-border/60'
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
                  onClick={() => onSelectStage(stage.status)}
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
}
