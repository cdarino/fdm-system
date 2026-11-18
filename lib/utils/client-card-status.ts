import { getDocumentTypeLabel, type ClientActivitySummary, type DocType } from '@/lib/types/client';
import { formatActivityTime } from '@/lib/format-activity-time';
import type { CallingCardStatus } from '@/lib/types/calling-card';

export interface ClientCardStatusInput {
  /**
   * The account's lifecycle status. Shown only when it is not "Active".
   *
   * "Active" is true of nearly every row, so showing it costs a slot to say
   * nothing — the same reason this function replaced the account status in the
   * first place. Anything else ("Archived", "Inactive") is the exception, and
   * an exception is what a clerk scanning a grid needs to see.
   */
  status?: string | null;
  /** From `getClientRequirements(client, documents).missingProfile`. */
  missingProfile: string[];
  /**
   * Document types the client is missing. Taken from the same notification feed
   * the grid's badge uses, so the bar and any badge cannot disagree about
   * whether a client is missing documents.
   */
  missingDocuments: DocType[];
  latestActivity: ClientActivitySummary | null;
}

/**
 * A client as the bottom bar needs to render them.
 *
 * The client card has one contextual slot, and three candidates compete for it.
 * Precedence runs from least to most ordinary, because the slot should say the
 * thing a clerk does not already know:
 *
 * 1. A non-active lifecycle status. An archived client is not a client you
 *    chase documents from, so this has to outrank attention or the bar would
 *    ask for work that should not happen.
 * 2. An incomplete record. A missing TIN or a missing document is something
 *    staff have to chase.
 * 3. The latest activity — context, and the thing that actually changes
 *    between visits.
 *
 * Only one is shown. A bar saying two things is a bar that says neither
 * clearly.
 *
 * Names rather than counts in the detail: "Missing TCT" tells a clerk what to
 * chase, "Missing 1 document" does not. Long lists truncate in the bar.
 */
export function clientCardStatus({
  status,
  missingProfile,
  missingDocuments,
  latestActivity,
}: ClientCardStatusInput): CallingCardStatus {
  const lifecycle = status?.trim();
  if (lifecycle && lifecycle.toLowerCase() !== 'active') {
    return { label: lifecycle, tone: 'muted' };
  }

  if (missingProfile.length > 0 || missingDocuments.length > 0) {
    const parts: string[] = [];
    if (missingProfile.length > 0) parts.push(missingProfile.join(', '));
    if (missingDocuments.length > 0) {
      parts.push(missingDocuments.map((type) => getDocumentTypeLabel(type)).join(', '));
    }
    return {
      label: 'Needs attention',
      tone: 'warning',
      detail: `Missing ${parts.join(' · ')}`,
    };
  }

  if (!latestActivity) {
    return { label: 'No activity logged', tone: 'muted' };
  }

  return {
    label: latestActivity.description || 'Activity recorded',
    tone: 'muted',
    detail: `${latestActivity.performer_name} · ${formatActivityTime(latestActivity.time)}`,
  };
}
