export type LedgerStatus = "current" | "due_soon" | "overdue" | "settled";

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  receiptNo: string;
  method: "cash" | "check" | "bank_transfer";
  waivePenalty?: boolean;
  notes?: string;
}

export interface ContractPolicies {
  enableMaturityAmnesty?: boolean;
  amnestyMonths?: number;
  enablePostMaturityReducedRate?: boolean;
  postMaturityPenaltyRate?: number;
}

export type OverdueNoticeStage = "none" | "first_notice" | "second_notice" | "final_demand" | "forfeited";

export interface OverdueNoticeEvent {
  id: string;
  stage: OverdueNoticeStage;
  date: string;
  noticeNumber: number;
  title: string;
  trackingNo?: string;
  notes?: string;
  overdueAmount: number;
  arrearsPrincipal: number;
  penaltyDue: number;
}

export interface OverdueEscalation {
  currentStage: OverdueNoticeStage;
  history: OverdueNoticeEvent[];
}

export interface LedgerParty {
  clientId: string;
  fullName: string;
  contactNumber?: string;
  address?: string;
  referredBy?: string;
}

export interface LedgerProperty {
  propertyId: string;
  projectArea: string;
  blockNumber: number;
  lotNumber: number;
  lotArea: number;
  pricePerSqm: number;
  titleNumber?: string;
  status?: string;
}

export interface Ledger {
  id: string;
  client: LedgerParty;
  property: LedgerProperty;
  contractPrice: number;
  downpayment: number;
  termMonths: number;
  monthlyAmortization: number;
  firstDueDate: string;
  dueDay: number;
  penaltyRate: number;
  createdAt: string;
  payments: PaymentRecord[];
  policies?: ContractPolicies;
  overdueEscalation?: OverdueEscalation;
  status?: string;
  clearedAt?: string | null;
  clearedBy?: string | null;
}

export type JournalRowType =
  | "opening"
  | "downpayment_due"
  | "installment_due"
  | "penalty_charge"
  | "payment";

export interface LedgerJournalRow {
  id: string;
  rowType: JournalRowType;
  date: string;
  instLabel: string;
  description: string;
  monthlyDue?: number;
  amountPaid?: number;
  penaltyCharged?: number;
  penaltyBase?: number;
  penaltyPaid?: number;
  principalPaid?: number;
  penaltyWaived?: number;
  penaltyBalance: number;
  currentDueBalance: number;
  advanceCredit: number;
  tspBalance: number;
  receiptNo?: string;
  method?: string;
  notes?: string;
  paymentId?: string;
}

export interface LedgerSummary {
  ledger: Ledger;
  status: LedgerStatus;
  currentInstNo: number;
  currentTermDueDate?: string;
  monthsOverdue: number;
  daysUntilDue: number;
  arrearsPrincipal: number;
  currentTermBalance: number;
  installmentDueBalance: number;
  totalPenaltyDue: number;
  totalPayableNow: number;
  overdueAndPenaltyDue: number;
  advanceCredit: number;
  tspOutstandingBalance: number;
  totalCollected: number;
  totalPenaltyPaid: number;
  totalPenaltyWaived: number;
  paidTermsEquivalent: number;
  journal: LedgerJournalRow[];
  nextScheduledDueDate?: string;
  nextScheduledAmount?: number;
}

// Compatibility type aliases for legacy spec references
export type BillingAccountSummary = Record<string, unknown>;
export type BillingTransaction = Record<string, unknown>;
export type BillingSchedule = Record<string, unknown>;
export type BillingPayment = Record<string, unknown>;
export type BillingPostDatedCheck = Record<string, unknown>;
export type BillingImportDiscrepancy = Record<string, unknown>;
export type StatementPrintPayload = Record<string, unknown>;
