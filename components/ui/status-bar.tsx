import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The status footer of a calling card.
 *
 * Deliberately not a `Badge` in a bar. A badge can only state what a status is;
 * the point of this strip is to state the status *and* the one number that makes
 * it actionable — how much is still owed, which release documents are missing,
 * how long a clearance window has left. So it takes two independent concerns:
 *
 * - `tone` carries the colour, reusing the same vocabulary as `Badge` so a
 *   "Delinquent" strip and a "Delinquent" badge can never drift apart.
 * - `detail` carries the supporting fact, as plain text or as a `progress` bar.
 *
 * `tone` is separate from the caller's domain on purpose. A Billing card and a
 * Legal card pass the same shell and only differ in which status map filled it,
 * which is what lets one card serve both.
 */
const statusBarVariants = cva("relative flex flex-col gap-1.5 border-t px-3 py-2", {
  variants: {
    tone: {
      /* Surfaces mix into `--card`, never into white. A hardcoded `white` mix
         renders a near-white strip in dark mode under a light-theme text
         colour — measured at 1.3:1, i.e. invisible. Mixing into `--card` makes
         the surface follow the theme, the same reasoning as `--status-*-fill`.
         The pairs whose text colour comes from an already-flipping token
         (`info`, `warning`, `muted`) do not need it. */
      success:
        "border-transparent bg-[color-mix(in_srgb,var(--success)_12%,var(--card))] text-success",
      warning: "border-transparent bg-row-active text-accent-gold-foreground",
      info: "border-transparent bg-sidebar-accent text-accent-blue-foreground",
      destructive:
        "border-transparent bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))] text-destructive",
      muted: "border-transparent bg-muted text-muted-foreground",
      purple: "border-transparent bg-[color-mix(in_srgb,#8B5CF6_12%,white)] text-[#7C3AED]",
      /* Stage tones: the text colour is a token that flips per theme, so the
         surface must flip with it or the two invert against each other. */
      teal: "border-transparent bg-[color-mix(in_srgb,var(--tone-teal)_12%,var(--card))] text-[var(--tone-teal-foreground)]",
      violet:
        "border-transparent bg-[color-mix(in_srgb,var(--tone-violet)_12%,var(--card))] text-[var(--tone-violet-foreground)]",
      slate:
        "border-transparent bg-[color-mix(in_srgb,var(--tone-slate)_14%,var(--card))] text-[var(--tone-slate-foreground)]",
      default: "border-transparent bg-primary text-primary-foreground",
    },
  },
  defaultVariants: {
    tone: "muted",
  },
});

export interface StatusBarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBarVariants> {
  /** The status itself, e.g. "Delinquent" or "Clearance Period". */
  status: string;
  /**
   * The supporting fact. String for a plain note ("3 of 5 documents"), or a
   * `{ value, max }` pair to render as a progress bar.
   */
  detail?: React.ReactNode;
  /**
   * Progress fraction, 0–100. When given, `detail` sits above a filled bar and
   * `trailing` sits opposite it. Omit for a text-only bar.
   */
  progress?: number;
  /** Right-aligned text opposite `detail`, e.g. a monthly amortisation. */
  trailing?: React.ReactNode;
}

/**
 * The strip spans the card's full width and sits flush against its bottom edge,
 * so a column of cards reads as a banded list rather than a set of separate
 * boxes. That is why it is a sibling of the card body rather than a row inside
 * it — the card's own horizontal padding would inset it.
 */
function StatusBar({
  className,
  tone,
  status,
  detail,
  progress,
  trailing,
  ...props
}: StatusBarProps) {
  const hasProgress = typeof progress === "number";
  const pct = hasProgress ? Math.min(100, Math.max(0, progress)) : 0;

  return (
    <div className={cn(statusBarVariants({ tone, className }))} {...props}>
      <div className="flex items-center gap-2">
        {/* The dot and label inherit the tone's text colour, so every tone is
            legible without a second colour decision per variant. */}
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
        />
        <span className="min-w-0 truncate text-xs font-semibold">{status}</span>
        {!hasProgress && detail && (
          <span
            title={typeof detail === "string" ? detail : undefined}
            className="ml-auto min-w-0 shrink truncate text-[11px] opacity-80"
          >
            {detail}
          </span>
        )}
      </div>

      {hasProgress && (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,currentColor_18%,transparent)]">
            <div
              className="h-full rounded-full bg-current transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] opacity-80">
            <span
              title={typeof detail === "string" ? detail : undefined}
              className="min-w-0 truncate"
            >
              {detail}
            </span>
            {trailing && <span className="shrink-0">{trailing}</span>}
          </div>
        </>
      )}
    </div>
  );
}

export { StatusBar, statusBarVariants };
