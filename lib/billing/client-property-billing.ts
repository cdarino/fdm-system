import { evaluateLedger, addMonthsToDate } from '@/lib/billing/ledger-engine';
import type {
  Ledger,
  PaymentRecord,
  OverdueNoticeEvent,
  OverdueNoticeStage,
} from '@/lib/types/billing';
import type { ClientPropertyBillingSummary } from '@/lib/types/client';

export interface RawAccountBillingData {
  account_id: string;
  property_id: string;
  total_contract_price: number;
  remaining_balance: number;
  downpayment?: number | null;
  terms_months?: number | null;
  monthly_amortization?: number | null;
  amortization_day?: number | null;
  penalty_rate_percent?: number | null;
  first_due_date?: string | null;
  status: string;
  created_at: string;
  cleared_at?: string | null;
  cleared_by?: string | null;
  forfeited_at?: string | null;
  forfeiture_reason?: string | null;
  contract_policies?: Record<string, unknown> | null;
  overdue_notice_stage?: OverdueNoticeStage | null;
  payments?: Array<{
    payment_id: string;
    payment_date: string;
    amount: number;
    receipt_number: string;
    payment_method?: string | null;
    waive_penalty?: boolean | null;
    notes?: string | null;
  }> | null;
  notices?: Array<{
    notice_id: string;
    stage: OverdueNoticeStage;
    notice_number: number;
    notice_date: string;
    title: string;
    tracking_number?: string | null;
    notes?: string | null;
    overdue_amount: number;
    arrears_principal: number;
    penalty_due: number;
  }> | null;
}

export function buildClientPropertyBillingSummary(
  raw: RawAccountBillingData,
  asOfDateStr: string = new Date().toISOString().split('T')[0]
): ClientPropertyBillingSummary {
  // Map raw payment rows and sort by date ascending
  const payments: PaymentRecord[] = (raw.payments || []).map((p) => ({
    id: p.payment_id,
    date: p.payment_date,
    amount: Number(p.amount),
    receiptNo: p.receipt_number,
    method: (p.payment_method as PaymentRecord['method']) || 'cash',
    waivePenalty: Boolean(p.waive_penalty),
    notes: p.notes || undefined,
  }));
  payments.sort((a, b) => a.date.localeCompare(b.date));

  // Map raw notices and sort descending to locate latest notice event
  const notices: OverdueNoticeEvent[] = (raw.notices || []).map((n) => ({
    id: n.notice_id,
    stage: n.stage,
    noticeNumber: n.notice_number,
    date: n.notice_date,
    title: n.title,
    trackingNo: n.tracking_number || undefined,
    notes: n.notes || undefined,
    overdueAmount: Number(n.overdue_amount),
    arrearsPrincipal: Number(n.arrears_principal),
    penaltyDue: Number(n.penalty_due),
  }));
  notices.sort((a, b) => b.date.localeCompare(a.date));

  const currentStage: OverdueNoticeStage =
    raw.status === 'Forfeited'
      ? 'forfeited'
      : raw.overdue_notice_stage || notices[0]?.stage || 'none';

  const penaltyRate =
    Number(raw.penalty_rate_percent) > 1
      ? Number(raw.penalty_rate_percent) / 100
      : Number(raw.penalty_rate_percent) || 0.035;

  const firstDueDate =
    raw.first_due_date ||
    (raw.created_at ? raw.created_at.split('T')[0] : asOfDateStr);

  const termMonths = Number(raw.terms_months) || 36;
  const dueDay = Number(raw.amortization_day) || 25;

  const ledger: Ledger = {
    id: raw.account_id,
    client: { clientId: '', fullName: '' },
    property: {
      propertyId: raw.property_id,
      projectArea: '',
      blockNumber: 0,
      lotNumber: 0,
      lotArea: 0,
      pricePerSqm: 0,
    },
    contractPrice: Number(raw.total_contract_price),
    downpayment: Number(raw.downpayment || 0),
    termMonths,
    monthlyAmortization: Number(raw.monthly_amortization || 0),
    firstDueDate,
    dueDay,
    penaltyRate,
    createdAt: raw.created_at ? raw.created_at.split('T')[0] : asOfDateStr,
    payments,
    policies: raw.contract_policies || undefined,
    overdueEscalation: {
      currentStage,
      history: notices,
    },
    status: raw.status,
    clearedAt: raw.cleared_at,
    clearedBy: raw.cleared_by,
  };

  const summary = evaluateLedger(ledger, asOfDateStr);
  const tcp = Number(raw.total_contract_price);
  const remaining = summary.tspOutstandingBalance;
  const paid = Math.max(0, tcp - remaining);
  const percentPaid = tcp > 0 ? Math.min(100, Math.round((paid / tcp) * 100)) : 0;

  const lastPayment = payments.length > 0 ? payments[payments.length - 1] : null;
  const maturedDate = addMonthsToDate(firstDueDate, termMonths, dueDay);

  const latestNotice = notices[0]
    ? {
        stage: notices[0].stage,
        noticeNumber: notices[0].noticeNumber,
        noticeDate: notices[0].date,
        title: notices[0].title,
        trackingNumber: notices[0].trackingNo || null,
        overdueAmount: notices[0].overdueAmount,
      }
    : null;

  return {
    status: summary.status,
    accountStatus: raw.status,
    overdueNoticeStage: currentStage,
    monthsOverdue: summary.monthsOverdue,
    daysUntilDue: summary.daysUntilDue,
    currentTermDueDate: summary.currentTermDueDate,
    currentTermDue:
      summary.currentTermBalance ||
      summary.nextScheduledAmount ||
      Number(raw.monthly_amortization || 0),
    nextScheduledDueDate: summary.nextScheduledDueDate,
    nextScheduledAmount: summary.nextScheduledAmount,
    arrearsPrincipal: summary.arrearsPrincipal,
    totalPenaltyDue: summary.totalPenaltyDue,
    totalPayableNow: summary.totalPayableNow,
    totalContractPrice: tcp,
    remainingBalance: remaining,
    totalCollected: summary.totalCollected,
    percentPaid,
    lastPaymentDate: lastPayment?.date || null,
    settledDate: summary.status === 'settled' && lastPayment ? lastPayment.date : null,
    maturedDate,
    forfeitedAt: raw.forfeited_at || null,
    forfeitureReason: raw.forfeiture_reason || null,
    latestNotice,
  };
}
