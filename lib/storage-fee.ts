import type { LandTitle, StorageFeeCalculation } from '@/lib/types/title';

export const STORAGE_FEE_MONTHLY_RATE = 540;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function addCalendarMonths(baseDate: Date, monthsToAdd: number): Date {
  const year = baseDate.getFullYear() + Math.floor((baseDate.getMonth() + monthsToAdd) / 12);
  const month = (baseDate.getMonth() + (monthsToAdd % 12)) % 12;
  const day = baseDate.getDate();
  const maxDay = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(day, maxDay);

  return new Date(
    year,
    month,
    clampedDay,
    baseDate.getHours(),
    baseDate.getMinutes(),
    baseDate.getSeconds(),
    baseDate.getMilliseconds()
  );
}

export function calculateStorageFee(
  title: LandTitle,
  asOfDate?: Date
): StorageFeeCalculation {
  const isReleased = title.status === 'Released';
  const isReady = title.status === 'Ready for Claim';

  if (!isReleased && !isReady) {
    return {
      isApplicable: false,
      status: 'not_applicable',
      monthlyRate: STORAGE_FEE_MONTHLY_RATE,
      readyForClaimDate: null,
      gracePeriodEndDate: null,
      evaluationDate: asOfDate ?? new Date(),
      daysRemainingInGrace: 0,
      monthsOverdue: 0,
      accruedFee: 0,
      isOverdue: false,
      isFrozen: false,
    };
  }

  // Find when title first reached Ready for Claim status
  const readyEntry = title.history?.find((h) => h.status === 'Ready for Claim');
  const readyDate = readyEntry
    ? new Date(readyEntry.changed_at)
    : new Date(title.created_at);

  const gracePeriodEndDate = addCalendarMonths(readyDate, 12);

  let evaluationDate: Date;
  let isFrozen = false;

  // Accrual ceases once title is handed over to buyer
  if (isReleased) {
    const releasedEntry = title.history?.slice().reverse().find((h) => h.status === 'Released');
    evaluationDate = releasedEntry
      ? new Date(releasedEntry.changed_at)
      : new Date(title.updated_at || title.created_at);
    isFrozen = true;
  } else {
    evaluationDate = asOfDate ?? new Date();
  }

  if (evaluationDate.getTime() <= gracePeriodEndDate.getTime()) {
    const daysRemaining = Math.max(
      0,
      Math.ceil((gracePeriodEndDate.getTime() - evaluationDate.getTime()) / MS_PER_DAY)
    );
    return {
      isApplicable: true,
      status: 'within_grace',
      monthlyRate: STORAGE_FEE_MONTHLY_RATE,
      readyForClaimDate: readyDate,
      gracePeriodEndDate,
      evaluationDate,
      daysRemainingInGrace: daysRemaining,
      monthsOverdue: 0,
      accruedFee: 0,
      isOverdue: false,
      isFrozen,
    };
  }

  // Count full and started calendar months beyond the 1-year grace period
  let monthsOverdue = 0;
  while (true) {
    const nextTarget = addCalendarMonths(gracePeriodEndDate, monthsOverdue);
    if (evaluationDate.getTime() <= nextTarget.getTime()) {
      break;
    }
    monthsOverdue += 1;
  }

  const accruedFee = monthsOverdue * STORAGE_FEE_MONTHLY_RATE;

  return {
    isApplicable: true,
    status: 'overdue',
    monthlyRate: STORAGE_FEE_MONTHLY_RATE,
    readyForClaimDate: readyDate,
    gracePeriodEndDate,
    evaluationDate,
    daysRemainingInGrace: 0,
    monthsOverdue,
    accruedFee,
    isOverdue: true,
    isFrozen,
  };
}
