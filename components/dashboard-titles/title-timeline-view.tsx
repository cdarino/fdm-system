'use client';

import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatActivityTimestamp } from '@/lib/format-activity-time';
import { formatMediumDate } from '@/lib/format-date';
import {
  buildStageRows,
  getDocPrepState,
  getDocPrepSteps,
  isStageReachable,
} from '@/lib/title-progress';
import type { TitleDialogItem } from '@/lib/hooks/use-land-titles';
import type { ClientDocument } from '@/lib/types/client';
import type { LandTitleNotice, TitleStatus } from '@/lib/types/title';

// Re-exported so the dialog keeps importing both from here. The definitions
// moved to `lib/title-progress.ts` because they are domain facts, not drawing.
export { LIFECYCLE_STAGES, normalizeLifecycleStage } from '@/lib/title-progress';

interface TitleTimelineViewProps {
  item: TitleDialogItem;
  selectedStage: TitleStatus;
  onSelectStage: (stage: TitleStatus) => void;
  documents: ClientDocument[];
  notices: LandTitleNotice[];
  isExecutiveSigned?: boolean;
}

/**
 * The lifecycle rail.
 *
 * The previous rail rendered only the stages already reached, newest first, one
 * bordered card each with its own "View …" button. A record in Document
 * Preparation therefore saw two cards and no indication that three stages
 * followed — the column answered "where has this been" when the question is
 * "where is this going".
 *
 * This version always shows all five stages as a connected index, so the
 * remaining work is visible without scrolling, and marks the current one
 * against its position in the list. The preparation sub-steps stay inside the
 * preparation row rather than becoming rows of their own, because they are
 * sub-steps of one stage and the rail's job is the stage.
 */
export function TitleTimelineView({
  item,
  selectedStage,
  onSelectStage,
  documents,
  notices,
  isExecutiveSigned = false,
}: TitleTimelineViewProps) {
  const activeTitle = item.type === 'title' ? item.data : null;

  const rows = buildStageRows(item, notices);

  const prep = activeTitle ? getDocPrepState(activeTitle, documents, isExecutiveSigned) : null;

  /**
   * The four preparation sub-steps, shown inside the preparation row.
   *
   * These are the same four rows the preparation page renders, from the same
   * derivation — including the pending-vs-past-tense labels, so a sub-step that
   * has not happened says what it is waiting for rather than claiming it is
   * done. Only the drawing differs, because the rail is 300px wide and the page
   * is not.
   */
  function renderPrepSteps() {
    if (!activeTitle || !prep) return null;

    const missing = [
      prep.missingCount > 0
        ? `${prep.missingCount} file${prep.missingCount > 1 ? 's' : ''} missing`
        : '',
      !prep.hasRecordedTct ? 'title number missing' : '',
    ]
      .filter(Boolean)
      .join(' • ');

    const steps = getDocPrepSteps(activeTitle, documents, isExecutiveSigned, missing);

    return (
      /*
        No indent and no rule down the left. The list sits flush in the stage
        row's own padding, so each sub-step's marker lines up with the stage's
        checkbox above it and the whole thing reads as one indented-under-a-
        heading list rather than a second column. The marker is a small dot
        against the stage's 16px box, which is what carries the subordination;
        an extra 12px of margin said the same thing a second time and cost the
        first line its width. Each line carries `py-1` for the rhythm of the
        stages above it — packed as `space-y-1.5` on 12px lines it read as one
        block, not as four steps.
      */
      <ol className="mt-2 space-y-px">
        {steps.map((step) => {
          const isDone = step.state === 'done';
          const hasMissingDetail = !isDone && step.id === 'packet' && Boolean(missing);

          return (
            <li key={step.id} className="flex items-start gap-2.5 py-1 text-xs">
              <span
                aria-hidden="true"
                className={cn(
                  'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                  isDone ? 'bg-success' : step.state === 'current' ? 'bg-primary' : 'border border-muted-foreground'
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 font-medium text-foreground">
                    {isDone ? step.title : step.pendingTitle}
                  </span>
                  {isDone && step.timestamp ? (
                    <span className="shrink-0 text-muted-foreground">{step.timestamp}</span>
                  ) : null}
                </div>
                {hasMissingDetail && (
                  <p className="text-[11px] leading-snug text-muted-foreground mt-0.5">
                    {missing}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div>
      {/*
        No heading, and no rule above the rows.

        "Lifecycle Progress" labelled a column whose contents are five numbered
        stage names — the one thing in the dialog that needs no label, because
        the rows say what they are before you reach the top of the list. It cost
        a line of vertical space and a second horizontal rule 16px above the
        nav's own border, which is two rules doing one job.

        No "Jump to Current" button either. It existed because the rail used to
        list only the stages already reached, so the current one could be
        scrolled off; with all five always present and the current row marked,
        the way back is the row itself, a few lines up a column that never
        scrolls far.
      */}
      {/*
        Two sizes, not six. The rows were `text-[9px]`, `text-[10px]` and
        `text-[11px]` in one column — the stage number, the date, the "Current"
        pill and the description all a different size, none of them on the
        scale. The stage name is `text-sm` and its supporting line is `text-xs`.

        An upcoming row is dimmed with `text-muted-foreground` on its name
        rather than `opacity-55` on the whole row: opacity takes the border and
        the chevron down with the text, and a stage that has not happened yet is
        unstarted, not disabled.

        It carries no description line. A record sitting in preparation has
        three unstarted stages, and each one used to spend two lines saying what
        it was waiting for — text about a stage, under a stage already named
        directly above it, on the one row a reader is least likely to be
        reading. Hiding the line leaves the unstarted rows as a plain numbered
        index of what is still ahead, which is what the rail is for, and gives
        the reached stages the column's only prose.

        The leading marker is a checkbox in every state — ticked when the stage
        is done, half-filled when it is current, empty when it has not started.
        It carried the stage's number for a while, which made the column an
        index but read as a second control: a filled disc with a "2" in it looks
        like something to press, and it duplicated the number already written
        into "2. Document Preparation" beside it. A checkbox says the one thing
        the marker is for — whether this stage happened — without competing with
        the label, and it is the same vocabulary the preparation sub-steps
        inside the row already use.

        Pending markers use `border-muted-foreground`, not
        `border-muted-foreground/60`. Tokens here are hex, so the slash-opacity
        form compiles to `rgb(#hex / 0.6)` and is dropped by the browser — the
        border then falls back to `--border` at #E2E7EC, which is why every
        unstarted step in this column read as an empty gap.
      */}
      <nav aria-label="Title lifecycle" className="divide-y divide-border rounded-lg border border-border">
        {rows.map((row, index) => {
          const isCurrent = row.state === 'current';
          const isSelected = row.status === selectedStage;
          const isPrep = row.status === 'Document Preparation';
          const timestamp = row.timestamp ? formatMediumDate(row.timestamp) : null;
          const fullTimestamp = row.timestamp
            ? formatActivityTimestamp(row.timestamp)
            : undefined;
          /*
            Only the reached stages open. See `isStageReachable` — an unstarted
            stage has no page of its own, only a set of status-gated controls
            that do not apply yet, and the rail's job for those rows is to show
            that they exist.
          */
          const isReachable = isStageReachable(item, row.status);

          return (
            <button
              key={row.status}
              type="button"
              disabled={!isReachable}
              onClick={() => onSelectStage(row.status)}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors first:rounded-t-lg last:rounded-b-lg',
                isReachable ? (isSelected ? 'bg-sidebar-accent' : 'hover:bg-row-hover') : 'cursor-default'
              )}
            >
              {/*
                A square box rather than a disc, and the same shape as the
                `StepChecklist` markers the preparation sub-steps below use, so
                the column reads as one checklist at two levels. Half-filled
                marks the stage in progress the way a partially-ticked box does;
                the fill is a smaller rounded square so the ring stays visible
                at 16px.

                `mt-px` rather than a nudge of several pixels: the label beside
                it is `text-sm` on a `leading-tight` line, so centring a 16px box
                on that line needs one pixel, not four. The old `mt-0.5` was
                off-centre against a `text-xs` label and stayed put when the
                label grew.
              */}
              <span
                aria-hidden="true"
                className={cn(
                  'mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px]',
                  row.state === 'complete'
                    ? 'bg-success text-success-foreground'
                    : isCurrent
                      ? 'border-2 border-primary'
                      : 'border border-muted-foreground'
                )}
              >
                {row.state === 'complete' ? (
                  <Check className="h-3 w-3" strokeWidth={3.5} />
                ) : isCurrent ? (
                  <span className="h-1.5 w-1.5 rounded-[1px] bg-primary" />
                ) : null}
              </span>

              <span className="min-w-0 flex-1 space-y-1">
                {/*
                  The stage name gets the line to itself. It shares the 229px of
                  text column this row actually has with nothing: the timestamp
                  moved below it, and now the "Current" pill did too. With the
                  pill on the same line, "2. Document Preparation" at `text-sm`
                  had 158px for a name that needs 186, so the current stage —
                  the one row a reader looks at first — was the only one whose
                  name wrapped or truncated.

                  The name does not truncate at all. It is a lifecycle stage,
                  and the five of them are the vocabulary of this dialog;
                  "Document Preparat…" is not a stage anyone can act on.

                  The label keeps a number in front of it because the number
                  belongs to the stage's *name* — "3. Clearance Period" is how
                  the stage is referred to out loud — not to the control beside
                  it.
                */}
                <span
                  className={cn(
                    'block text-sm leading-tight',
                    isCurrent ? 'font-semibold text-foreground' : 'font-medium',
                    row.state === 'upcoming'
                      ? 'text-muted-foreground'
                      : 'text-foreground'
                  )}
                >
                  {index + 1}. {row.label}
                </span>

                {/*
                  Just the date for a stage that has been reached. "Current
                  stage" is gone: the row already says so three other ways —
                  it is the only one with a half-filled checkbox, the only one
                  set in `font-semibold`, and the page to its right is titled
                  with this stage's name. A fourth signal in a pill was the one
                  that cost the name its line without adding anything.

                  That leaves the current row with no meta line at all, since a
                  stage still in progress has no completion date to show. The
                  description moves up into that slot, so every row's text block
                  starts directly under its name.
                */}
                {timestamp ? (
                  <span className="block text-xs text-muted-foreground" title={fullTimestamp}>
                    {timestamp}
                  </span>
                ) : null}

                {isPrep ? (
                  renderPrepSteps()
                ) : row.description ? (
                  <span className="block text-xs leading-snug text-muted-foreground">
                    {row.description}
                  </span>
                ) : null}
              </span>

              {/*
                The chevron is the row's "this opens" affordance, so a row that
                does not open keeps the space and drops the arrow. Its absence
                is the whole signal: the row is already dimmed, unnumbered past
                its state, and without a description, so a second grey chevron
                would read as "press me and nothing happens".
              */}
              <span className="mt-px h-4 w-4 shrink-0" aria-hidden="true">
                {isReachable ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : null}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
