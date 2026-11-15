"use client";

import { LedgerSummary } from "@/lib/types/billing";
import {
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  AlertOctagon,
  Ban,
} from "lucide-react";

interface LedgerStatusBadgeProps {
  summary: LedgerSummary;
  compact?: boolean;
}

const NOTICE_STAGE_META = {
  first_notice: {
    label: "1st Notice",
    Icon: FileText,
    toneClass: "text-amber-700 dark:text-amber-300",
  },
  second_notice: {
    label: "2nd Notice",
    Icon: AlertTriangle,
    toneClass: "text-orange-700 dark:text-orange-300",
  },
  final_demand: {
    label: "Final Demand",
    Icon: AlertOctagon,
    toneClass: "text-destructive",
  },
} as const;

export function LedgerStatusBadge({ summary, compact = true }: LedgerStatusBadgeProps) {
  const stage = summary.ledger.overdueEscalation?.currentStage || "none";
  const isForfeited = summary.ledger.status === "Forfeited" || stage === "forfeited";

  if (summary.ledger.clearedAt) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
        Cleared for Legal
      </span>
    );
  }

  if (isForfeited) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-foreground text-background border border-foreground">
        <Ban className="w-3.5 h-3.5 mr-1 text-rose-400" />
        Forfeited
      </span>
    );
  }

  if (summary.status === "settled") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-card text-muted-foreground border border-border-warm shadow-2xs">
        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
        {compact ? "Settled" : "Fully Settled"}
      </span>
    );
  }

  if (summary.status === "overdue") {
    const noticeMeta =
      stage === "first_notice" || stage === "second_notice" || stage === "final_demand"
        ? NOTICE_STAGE_META[stage]
        : null;

    if (noticeMeta) {
      const { label, Icon, toneClass } = noticeMeta;
      return (
        <span className="inline-flex flex-col items-start gap-0.5 px-2 py-1 rounded border bg-destructive/10 text-destructive border-destructive/20">
          <span className="inline-flex items-center text-xs font-semibold leading-tight">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive mr-1.5 animate-pulse shrink-0" />
            {summary.monthsOverdue}m Overdue
          </span>
          <span className={`inline-flex items-center text-[10px] font-medium leading-tight pl-3 ${toneClass}`}>
            <Icon className="w-2.5 h-2.5 mr-1 shrink-0" />
            {label}
          </span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
        <span className="w-1.5 h-1.5 rounded-full bg-destructive mr-1.5 animate-pulse" />
        {summary.monthsOverdue}m Overdue
      </span>
    );
  }

  if (summary.status === "due_soon") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
        <Clock className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400" />
        {compact ? `${summary.daysUntilDue}d Due` : `Due in ${summary.daysUntilDue} days`}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
      Current
    </span>
  );
}
