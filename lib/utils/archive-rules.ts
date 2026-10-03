export const ARCHIVE_HOLD_DAYS = 7;
export const ARCHIVE_HOLD_MS = ARCHIVE_HOLD_DAYS * 24 * 60 * 60 * 1000;

export interface ArchiveEligibility {
  isArchived: boolean;
  isEligibleForDelete: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  formattedRemaining: string;
  tooltipReason?: string;
}

export function getArchiveEligibility(
  isArchived: boolean,
  archivedAt: string | null | undefined,
  now: Date = new Date()
): ArchiveEligibility {
  if (!isArchived || !archivedAt) {
    return {
      isArchived: false,
      isEligibleForDelete: false,
      daysRemaining: ARCHIVE_HOLD_DAYS,
      hoursRemaining: ARCHIVE_HOLD_DAYS * 24,
      formattedRemaining: `${ARCHIVE_HOLD_DAYS} days`,
      tooltipReason: `Must be archived for ${ARCHIVE_HOLD_DAYS} consecutive days before permanent deletion.`,
    };
  }

  const archiveTime = new Date(archivedAt).getTime();
  const elapsedMs = Math.max(0, now.getTime() - archiveTime);
  const remainingMs = Math.max(0, ARCHIVE_HOLD_MS - elapsedMs);

  if (remainingMs <= 0) {
    return {
      isArchived: true,
      isEligibleForDelete: true,
      daysRemaining: 0,
      hoursRemaining: 0,
      formattedRemaining: '0 days',
    };
  }

  const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
  const formattedRemaining =
    remainingDays > 1 ? `${remainingDays} days` : `${remainingHours} hour${remainingHours === 1 ? '' : 's'}`;

  return {
    isArchived: true,
    isEligibleForDelete: false,
    daysRemaining: remainingDays,
    hoursRemaining: remainingHours,
    formattedRemaining,
    tooltipReason: `Must be archived for ${ARCHIVE_HOLD_DAYS} consecutive days before permanent deletion (${formattedRemaining} remaining).`,
  };
}
