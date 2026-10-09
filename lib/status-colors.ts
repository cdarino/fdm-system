import type { PropertyStatus } from '@/lib/types/property';
import type { TitleStatus } from '@/lib/types/title';

/**
 * One source of truth for how a lot's status is coloured.
 *
 * The lot table and the site map have to agree (a lot shown green in the list
 * and gold on the plan is worse than no colour at all), but they need the
 * colour in two different forms. Tailwind utilities cannot be used on SVG
 * presentation attributes, and CSS variable strings cannot be used as Tailwind
 * classes, so each status carries both.
 */

/** Display order, used by the filter tabs, the status menu and the map legend. */
export const STATUSES: PropertyStatus[] = ['Open', 'Reserved', 'Sold', 'Forfeited'];

/**
 * Tailwind literals for the table pills.
 *
 * Complete, unbroken strings: tokens in globals.css are hex, so a slash-opacity
 * modifier would compile to invalid `rgb(#hex / alpha)`, and a class assembled
 * at runtime would never be seen by Tailwind's static scanner.
 */
export const STATUS_PILL: Record<PropertyStatus, { pill: string; dot: string }> = {
  Open: {
    pill: 'bg-[color-mix(in_srgb,var(--success)_12%,white)] text-success',
    dot: 'bg-success',
  },
  Reserved: {
    pill: 'bg-sidebar-accent text-accent-blue-foreground',
    dot: 'bg-primary',
  },
  Sold: {
    pill: 'bg-row-active text-accent-gold-foreground',
    dot: 'bg-row-accent',
  },
  Forfeited: {
    pill: 'bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive',
    dot: 'bg-destructive',
  },
};

export const PROPERTY_STATUS_VARIANT: Record<
  PropertyStatus,
  'success' | 'info' | 'warning' | 'destructive'
> = {
  Open: 'success',
  Reserved: 'info',
  Sold: 'warning',
  Forfeited: 'destructive',
};

export const PROPERTY_STATUS_COLOR = PROPERTY_STATUS_VARIANT;



/** Badge colour for each title release step, used by the Legal page. */
export const TITLE_STATUS_VARIANT: Record<
  TitleStatus,
  'info' | 'muted' | 'warning' | 'success'
> = {
  'Cleared by Billing': 'info',
  'Legal Processing': 'muted',
  'Legal Review': 'muted',
  'Management Approval': 'muted',
  '30-Day Clearance': 'muted',
  'Ready for Claim': 'warning',
  Released: 'success',
};
