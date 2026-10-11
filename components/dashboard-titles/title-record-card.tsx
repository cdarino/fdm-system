'use client';

import {
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatActivityTime } from '@/lib/format-activity-time';
import { lotRefLabel } from '@/lib/hooks/use-land-titles';
import { calculateStorageFee } from '@/lib/storage-fee';
import { TITLE_STATUS_VARIANT } from '@/lib/status-colors';
import {
  documentsForLot,
  getMissingReleaseDocuments,
  getRequiredReleaseDocuments,
} from '@/lib/utils/release-requirements';
import type { AccountAwaitingTitle, LandTitle } from '@/lib/types/title';

const DATE_FORMAT = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function getClearanceProgress(startedAt?: string | null) {
  if (!startedAt) return { targetDate: null, daysRemaining: 0, isComplete: false };
  const start = new Date(startedAt).getTime();
  const target = new Date(start + 30 * MS_PER_DAY);
  const now = Date.now();
  const daysRemaining = Math.ceil((target.getTime() - now) / MS_PER_DAY);
  return {
    targetDate: target,
    daysRemaining,
    isComplete: daysRemaining <= 0,
  };
}

function getStatusChangedAt(title: LandTitle): string {
  if (title.status === 'Clearance Period' && title.clearance_started_at) {
    return title.clearance_started_at;
  }
  const entry = title.history?.slice().reverse().find((h) => h.status === title.status);
  if (entry) return entry.changed_at;
  if (title.status === 'Document Preparation') return title.created_at;
  return title.updated_at || title.created_at || new Date().toISOString();
}

interface TitleRecordCardProps {
  item:
    | { type: 'awaiting'; data: AccountAwaitingTitle }
    | { type: 'title'; data: LandTitle };
  onClick: () => void;
}

export function TitleRecordCard({ item, onClick }: TitleRecordCardProps) {
  if (item.type === 'awaiting') {
    const account = item.data;
    const clientName = account.client?.full_name ?? 'Unknown client';
    const hasTct = Boolean(account.property.title_number?.trim());

    return (
      <Card
        variant="interactive"
        padding="none"
        onClick={onClick}
        className="group flex flex-col justify-between p-3.5 transition-all duration-150 hover:border-primary"
      >
        <div className="space-y-2.5">
          <div>
            <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {clientName}
            </h3>
            {account.co_buyers.length > 0 && (
              <p className="truncate text-xs text-muted-foreground mt-0.5">
                With {account.co_buyers.join(', ')}
              </p>
            )}
          </div>

          <div className="min-w-0">
            <Badge variant="outline" className="text-xs font-normal gap-1 text-muted-foreground max-w-full">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{lotRefLabel(account.property)} • {account.property.location}</span>
            </Badge>
          </div>

          <div>
            {hasTct ? (
              <Badge variant="outline" className="font-mono text-xs gap-1 text-foreground">
                <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span>TCT {account.property.title_number}</span>
              </Badge>
            ) : (
              <Badge variant="warning" className="text-[11px]">
                No TCT on Lot
              </Badge>
            )}
          </div>
        </div>

        {/* Consolidated status footer */}
        <div className="mt-3.5 border-t border-border pt-2.5 space-y-1.5">
          <Badge variant="info" shape="pill" dot className="shrink-0">
            Cleared by Billing
          </Badge>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">
              Since {DATE_FORMAT.format(new Date(account.cleared_at))} ({formatActivityTime(account.cleared_at)})
            </span>
          </div>
        </div>
      </Card>
    );
  }

  const title = item.data;
  const clientName = title.client?.full_name ?? 'Unknown client';
  const hasTct = Boolean(title.property?.title_number?.trim());

  const uploaded = documentsForLot(title.client?.documents ?? [], title.property_id).map(
    (d) => d.document_type
  );
  const required = getRequiredReleaseDocuments(title.is_legacy_transferred).length;
  const missing = getMissingReleaseDocuments(title.is_legacy_transferred, uploaded).length;
  const docsDone = required - missing;
  const isPacketComplete = missing === 0 && hasTct;

  const clearance = getClearanceProgress(title.clearance_started_at);
  const storageFee = calculateStorageFee(title);

  let statusTimeString: string;
  if (title.status === 'Clearance Period') {
    if (clearance.targetDate) {
      const daysCount = Math.max(0, clearance.daysRemaining);
      const daysText = `${daysCount} ${daysCount === 1 ? 'day' : 'days'} remaining`;
      statusTimeString = `Clears ${DATE_FORMAT.format(clearance.targetDate)} (${daysText})`;
    } else {
      const changedAt = getStatusChangedAt(title);
      statusTimeString = `Since ${DATE_FORMAT.format(new Date(changedAt))} (${formatActivityTime(changedAt)})`;
    }
  } else {
    const changedAt = getStatusChangedAt(title);
    statusTimeString = `Since ${DATE_FORMAT.format(new Date(changedAt))} (${formatActivityTime(changedAt)})`;
  }

  const showDocumentProgress =
    title.status === 'Document Preparation' ||
    title.status === 'For Review' ||
    title.status === 'For Signature';

  return (
    <Card
      variant="interactive"
      padding="none"
      onClick={onClick}
      className="group flex flex-col justify-between p-3.5 transition-all duration-150 hover:border-primary"
    >
      <div className="space-y-2.5">
        <div>
          <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {clientName}
          </h3>
          <p className="truncate text-xs text-muted-foreground mt-0.5">
            {title.client?.address ?? 'No address recorded'}
          </p>
        </div>

        <div className="min-w-0">
          <Badge variant="outline" className="text-xs font-normal gap-1 text-muted-foreground max-w-full">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{lotRefLabel(title.property)} • {title.property?.location ?? ''}</span>
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {hasTct ? (
            <Badge variant="outline" className="font-mono text-xs gap-1 text-foreground">
              <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span>TCT {title.property?.title_number}</span>
            </Badge>
          ) : (
            <Badge variant="warning" className="text-[11px]">
              Needs TCT
            </Badge>
          )}
          {title.is_legacy_transferred && (
            <Badge variant="outline" className="text-[10px]">
              Legacy Title
            </Badge>
          )}
        </div>

        {showDocumentProgress && (
          <div className="text-xs text-muted-foreground pt-0.5">
            {isPacketComplete ? (
              <span className="text-success font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Packet complete
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {docsDone} of {required} documents {!hasTct && '• Needs TCT'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Consolidated status footer */}
      <div className="mt-3.5 border-t border-border pt-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant={TITLE_STATUS_VARIANT[title.status] ?? 'muted'}
            shape="pill"
            dot
            className="shrink-0"
          >
            {title.status}
          </Badge>
          {title.status === 'Ready for Claim' && storageFee.isOverdue && (
            <Badge variant="warning" shape="pill" dot className="shrink-0 text-[11px]">
              {storageFee.monthsOverdue} {storageFee.monthsOverdue === 1 ? 'mo' : 'mos'} overdue
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">{statusTimeString}</span>
        </div>
      </div>
    </Card>
  );
}
