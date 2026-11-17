import {
  PROPERTY_STATUS_VARIANT,
  TITLE_STATUS_VARIANT,
} from '@/lib/status-colors';
import {
  documentsForLot,
  getMissingReleaseDocuments,
  getRequiredReleaseDocuments,
} from '@/lib/utils/release-requirements';
import { getClearanceProgress } from '@/components/dashboard-titles/title-record-card';
import { formatActivityTime } from '@/lib/format-activity-time';
import type { CallingCardStatus } from '@/lib/types/calling-card';
import type { TitleStatus } from '@/lib/types/title';
import type { ClientDocument, ClientProperty } from '@/lib/types/client';

const DATE_FORMAT = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

/**
 * Derives the calling card's status bar based on domain ownership:
 * 1. Legal processing (Titled lot)
 * 2. Pre-Legal Hand-off (Cleared by Billing)
 * 3. Billing ledger (Active, Due Soon, Overdue, Notices, Matured, Settled, Forfeited)
 * 4. Property inventory (Open, Reserved raw lot)
 */
export function getLotCallingCardStatus(
  property: ClientProperty,
  clientDocuments: ClientDocument[] = []
): CallingCardStatus {
  // 1. Legal processing
  if (property.has_title) {
    const titleStatus = (property.title_status || 'Document Preparation') as TitleStatus;
    const tone = TITLE_STATUS_VARIANT[titleStatus] ?? 'info';
    let detail: string;

    if (titleStatus === 'Clearance Period') {
      const { targetDate, daysRemaining } = getClearanceProgress(property.clearance_started_at);
      detail = targetDate
        ? `${Math.max(0, daysRemaining)} ${Math.max(0, daysRemaining) === 1 ? 'day' : 'days'} remaining`
        : property.clearance_started_at
          ? `Since ${DATE_FORMAT.format(new Date(property.clearance_started_at))}`
          : '30-day clearance window';
    } else if (
      titleStatus === 'Document Preparation' ||
      titleStatus === 'For Review' ||
      titleStatus === 'For Signature'
    ) {
      const uploaded = documentsForLot(clientDocuments, property.property_id).map(
        (d) => d.document_type
      );
      const required = getRequiredReleaseDocuments(property.is_legacy_transferred).length;
      const missing = getMissingReleaseDocuments(property.is_legacy_transferred, uploaded).length;
      const docsDone = required - missing;
      const hasTct = Boolean(property.title_number?.trim());
      const isPacketComplete = missing === 0 && hasTct;

      detail = isPacketComplete
        ? `Packet complete (${required}/${required})`
        : `${docsDone} of ${required} documents`;
    } else if (titleStatus === 'Ready for Claim') {
      detail = 'Original title in vault';
    } else if (titleStatus === 'Released') {
      detail = property.released_to_name
        ? `Released to ${property.released_to_name}`
        : property.title_updated_at
          ? `Since ${DATE_FORMAT.format(new Date(property.title_updated_at))}`
          : 'Released';
    } else {
      detail = property.title_created_at
        ? `Since ${DATE_FORMAT.format(new Date(property.title_created_at))}`
        : 'In Legal processing';
    }

    return {
      label: titleStatus,
      tone,
      detail,
    };
  }

  // 2. Pre-Legal Hand-off (Cleared by Billing awaiting Legal intake)
  if (property.cleared_at) {
    return {
      label: 'Cleared by Billing',
      tone: TITLE_STATUS_VARIANT['Cleared by Billing'] ?? 'info',
      detail: `Since ${DATE_FORMAT.format(new Date(property.cleared_at))} (${formatActivityTime(property.cleared_at)})`,
    };
  }

  // 3. Billing ledger processing
  const b = property.billing_summary;
  const hasAccount = Boolean(property.account_id || b);
  const isForfeited =
    property.status === 'Forfeited' ||
    property.account_status === 'Forfeited' ||
    b?.accountStatus === 'Forfeited' ||
    b?.overdueNoticeStage === 'forfeited';

  if (hasAccount || isForfeited) {
    const tcp = Number(
      b?.totalContractPrice ||
        property.total_contract_price ||
        property.area_size * property.price_per_sqm
    );
    const remaining = Number(
      b?.remainingBalance ?? property.remaining_balance ?? (hasAccount ? tcp : 0)
    );
    const percentPaid =
      b?.percentPaid ??
      (tcp > 0 ? Math.min(100, Math.round((Math.max(0, tcp - remaining) / tcp) * 100)) : 0);
    const totalPayableNow = b?.totalPayableNow ?? remaining;
    const currentTermDue = b?.currentTermDue ?? 0;

    // 3.1 Forfeited state
    if (isForfeited) {
      const forfeitedDate = b?.forfeitedAt;
      if (forfeitedDate) {
        const daysElapsed = Math.floor(
          (Date.now() - new Date(forfeitedDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        const daysLeft = 30 - daysElapsed;
        if (daysLeft > 0) {
          const redemptionPct = Math.min(100, Math.max(0, Math.round(((30 - daysLeft) / 30) * 100)));
          return {
            label: 'Forfeited',
            tone: 'destructive',
            detail: `Redemption period: ${daysLeft}d left`,
            progress: redemptionPct,
            trailing: remaining > 0 ? `${PESO.format(remaining)} rescinded` : undefined,
          };
        }
      }
      return {
        label: 'Forfeited',
        tone: 'destructive',
        detail: 'Ownership rescinded · Returned to inventory',
      };
    }

    // 3.2 Settled / Fully paid awaiting Billing clearance
    if (b?.status === 'settled' || remaining <= 0) {
      return {
        label: 'Fully Paid · Awaiting Clearance',
        tone: 'info',
        detail: b?.settledDate
          ? `Settled ${formatActivityTime(b.settledDate)}`
          : '100% paid · Ready for Billing clearance',
        progress: 100,
        trailing: '₱0 balance',
      };
    }

    // 3.3 Notice escalation stages
    if (b?.overdueNoticeStage === 'final_demand') {
      return {
        label: 'Final Demand Issued',
        tone: 'destructive',
        progress: percentPaid > 0 ? percentPaid : undefined,
        detail: b.latestNotice ? `Sent ${formatActivityTime(b.latestNotice.noticeDate)}` : 'Final demand issued',
        trailing: `${PESO.format(totalPayableNow)} due`,
      };
    }

    if (b?.overdueNoticeStage === 'second_notice') {
      return {
        label: '2nd Notice Served',
        tone: 'warning',
        progress: percentPaid > 0 ? percentPaid : undefined,
        detail: b.latestNotice ? `Sent ${formatActivityTime(b.latestNotice.noticeDate)}` : '2nd notice served',
        trailing: `${PESO.format(totalPayableNow)} due`,
      };
    }

    if (b?.overdueNoticeStage === 'first_notice') {
      return {
        label: '1st Notice Served',
        tone: 'warning',
        progress: percentPaid > 0 ? percentPaid : undefined,
        detail: b.latestNotice ? `Sent ${formatActivityTime(b.latestNotice.noticeDate)}` : '1st notice served',
        trailing: `${PESO.format(totalPayableNow)} due`,
      };
    }

    // 3.4 Overdue in arrears (no formal notice recorded yet)
    const monthsOverdue = b?.monthsOverdue ?? 0;
    if (monthsOverdue > 0 || b?.status === 'overdue') {
      return {
        label: `${Math.max(1, monthsOverdue)}m Overdue`,
        tone: monthsOverdue >= 3 ? 'destructive' : 'warning',
        progress: percentPaid > 0 ? percentPaid : undefined,
        detail: b?.lastPaymentDate
          ? `Last paid ${formatActivityTime(b.lastPaymentDate)}`
          : `${percentPaid}% paid of ${PESO.format(tcp)}`,
        trailing: `${PESO.format(totalPayableNow)} due`,
      };
    }

    // 3.5 Matured account with unpaid balance
    const isMatured =
      b?.accountStatus === 'Matured' ||
      (b?.maturedDate && new Date(b.maturedDate).getTime() < Date.now() && remaining > 0) ||
      (property.contract_end_date &&
        new Date(property.contract_end_date).getTime() < Date.now() &&
        remaining > 0);

    if (isMatured) {
      const matureDetail = b?.lastPaymentDate
        ? `Last paid ${formatActivityTime(b.lastPaymentDate)} · Matured ${formatActivityTime(b.maturedDate || property.contract_end_date!)}`
        : b?.maturedDate
          ? `Matured ${formatActivityTime(b.maturedDate)} · ${percentPaid}% paid`
          : `${percentPaid}% paid of ${PESO.format(tcp)}`;

      return {
        label: 'Matured Account',
        tone: 'warning',
        progress: percentPaid > 0 ? percentPaid : undefined,
        detail: matureDetail,
        trailing: `${PESO.format(totalPayableNow)} payable`,
      };
    }

    // 3.6 Due Soon (upcoming installment due within 7 days)
    if (
      b?.status === 'due_soon' ||
      (b && b.daysUntilDue >= 0 && b.daysUntilDue <= 7 && monthsOverdue === 0)
    ) {
      const dueLabel =
        b.daysUntilDue === 0
          ? 'Due Today'
          : b.daysUntilDue === 1
            ? 'Due Tomorrow'
            : `Due in ${b.daysUntilDue}d`;

      return {
        label: dueLabel,
        tone: 'warning',
        progress: percentPaid > 0 ? percentPaid : undefined,
        detail: `${percentPaid}% paid of ${PESO.format(tcp)}`,
        trailing: `${PESO.format(currentTermDue)} due`,
      };
    }

    // 3.7 Active / Current in good standing
    return {
      label: 'Active',
      tone: 'success',
      progress: percentPaid,
      detail: `${percentPaid}% paid of ${PESO.format(tcp)}`,
      trailing:
        currentTermDue > 0
          ? `${PESO.format(currentTermDue)} due`
          : `${PESO.format(remaining)} balance`,
    };
  }

  // 4. Fallback: Raw / Open subdivision property lot
  const totalPrice = property.area_size * property.price_per_sqm;
  return {
    label: property.status,
    tone: PROPERTY_STATUS_VARIANT[property.status] ?? 'muted',
    detail: `${PESO.format(totalPrice)} TCP · ${PESO.format(property.price_per_sqm)}/sqm`,
  };
}
