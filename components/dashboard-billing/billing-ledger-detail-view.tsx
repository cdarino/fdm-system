"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatCurrency,
  formatDate,
  evaluateLedger,
} from "@/lib/billing/ledger-engine";
import { exportLedgerToExcel } from "@/lib/billing/export-excel";
import { ExcelSoaDocument } from "@/components/dashboard-billing/excel-soa-document";
import {
  postBillingPayment,
  voidBillingPayment,
  updateBillingPolicies,
  recordBillingNotice,
  updateBillingNotice,
  forfeitBillingAccount,
  markAccountClearedByBilling,
  undoBillingClearance,
} from "@/lib/actions/billing";
import {
  Ledger,
  LedgerJournalRow,
  LedgerSummary,
  OverdueNoticeEvent,
  OverdueNoticeStage,
} from "@/lib/types/billing";
import { HelpTip } from "@/components/ui/help-tip";
import { LedgerStatusBadge } from "@/components/dashboard-billing/ledger-status-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  PlusCircle,
  CheckCircle2,
  Printer,
  History,
  FileSpreadsheet,
  Trash2,
  Receipt,
  Calendar,
  AlertCircle,
  FileText,
  SlidersHorizontal,
  AlertTriangle,
  ArrowRight,
  Ban,
  Scale,
  Undo2,
  Pencil,
  Plus,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  downloadBillingNoticePdf,
  BillingNoticePdfParams,
} from "@/lib/reports/pdf-billing-notice";
import { downloadSoaPdf } from "@/lib/reports/pdf-soa";
import { printElement } from "@/lib/utils/print";

const NOTICE_STAGES: {
  stage: OverdueNoticeStage;
  num: number;
  label: string;
  docTitle: string;
  subtitle: string;
  shortDesc: string;
}[] = [
  {
    stage: "first_notice",
    num: 1,
    label: "1st Notice",
    docTitle: "FIRST NOTICE OF OVERDUE ACCOUNT",
    subtitle: "Reminder of Outstanding Installment",
    shortDesc: "Initial reminder requesting settlement of overdue installment.",
  },
  {
    stage: "second_notice",
    num: 2,
    label: "2nd Notice (Demand)",
    docTitle: "SECOND NOTICE & DEMAND FOR PAYMENT",
    subtitle: "Formal Demand for Account Settlement",
    shortDesc: "Formal demand letter setting a 15-day settlement deadline.",
  },
  {
    stage: "final_demand",
    num: 3,
    label: "Final Demand",
    docTitle: "FINAL DEMAND & NOTARIZED NOTICE OF CANCELLATION",
    subtitle: "Notice of Cancellation Pursuant to Section 8 of Contract to Sell",
    shortDesc: "30-day notarized cancellation notice before forfeiture.",
  },
  {
    stage: "forfeited",
    num: 4,
    label: "Notice of Forfeiture",
    docTitle: "NOTICE OF FORFEITURE & CONTRACT RESCISSION",
    subtitle: "Declaration of Contract Cancellation & Payment Forfeiture",
    shortDesc: "Contract officially cancelled; ownership reverted per CTS Section 8.",
  },
];

interface BillingLedgerDetailViewProps {
  initialLedger: Ledger;
  asOfDate?: string;
}

export function BillingLedgerDetailView({
  initialLedger,
  asOfDate: initialAsOfDate,
}: BillingLedgerDetailViewProps) {
  const router = useRouter();
  const [ledger, setLedger] = useState<Ledger>(initialLedger);
  const asOfDate = initialAsOfDate || new Date().toISOString().split("T")[0];

  const [activeTab, setActiveTab] = useState<"journal" | "payments" | "notices">("journal");
  const [journalFilter, setJournalFilter] = useState<"all" | "recent" | "payments">("all");

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payDate, setPayDate] = useState(asOfDate);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payReceipt, setPayReceipt] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "check" | "bank_transfer">("cash");
  const [waivePenalty, setWaivePenalty] = useState(false);
  const [payNotes, setPayNotes] = useState("");

  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [polPenaltyRate, setPolPenaltyRate] = useState<number>(3.5);
  const [polEnableAmnesty, setPolEnableAmnesty] = useState<boolean>(false);
  const [polAmnestyMonths, setPolAmnestyMonths] = useState<number>(12);
  const [polEnablePostMaturityRate, setPolEnablePostMaturityRate] = useState<boolean>(false);
  const [polPostMaturityRate, setPolPostMaturityRate] = useState<number>(2.0);

  const [showRecordNoticeModal, setShowRecordNoticeModal] = useState(false);
  const [recordNoticeStage, setRecordNoticeStage] = useState<"first_notice" | "second_notice" | "final_demand">("first_notice");
  const [recordNoticeDate, setRecordNoticeDate] = useState(asOfDate);
  const [recordNoticeTracking, setRecordNoticeTracking] = useState("");
  const [recordNoticeNotes, setRecordNoticeNotes] = useState("");

  const [showEditNoticeModal, setShowEditNoticeModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState<OverdueNoticeEvent | null>(null);
  const [editNoticeStage, setEditNoticeStage] = useState<"first_notice" | "second_notice" | "final_demand">("first_notice");
  const [editNoticeDate, setEditNoticeDate] = useState(asOfDate);
  const [editNoticeTracking, setEditNoticeTracking] = useState("");
  const [editNoticeNotes, setEditNoticeNotes] = useState("");

  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [forfeitDate, setForfeitDate] = useState(asOfDate);
  const [forfeitReason, setForfeitReason] = useState("");

  const [showDocModal, setShowDocModal] = useState(false);
  const [showSoaModal, setShowSoaModal] = useState(false);
  const [showClearanceModal, setShowClearanceModal] = useState(false);
  const [selectedDocNotice, setSelectedDocNotice] = useState<OverdueNoticeEvent | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmClearance = async () => {
    setIsSubmitting(true);
    try {
      if (ledger.clearedAt) {
        const result = await undoBillingClearance(ledger.id);
        if (!result.success) throw new Error(result.error);
        setLedger((prev) => ({ ...prev, clearedAt: null, clearedBy: null }));
        toast.success("Billing clearance reverted. Account restored to uncleared state.");
      } else {
        if (summary.status !== "settled") {
          throw new Error("Unsettled accounts cannot be cleared. Outstanding balance and penalties must be fully settled first.");
        }
        const result = await markAccountClearedByBilling(ledger.id);
        if (!result.success) throw new Error(result.error);
        setLedger((prev) => ({
          ...prev,
          clearedAt: result.data.cleared_at,
          clearedBy: result.data.cleared_by,
        }));
        toast.success("Account cleared by Billing and forwarded to Legal for land title issuance!");
      }
      setShowClearanceModal(false);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update billing clearance";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const summary: LedgerSummary = useMemo(() => {
    return evaluateLedger(ledger, asOfDate);
  }, [ledger, asOfDate]);

  const allocationPreview = useMemo(() => {
    if (!summary || payAmount <= 0) {
      return { penalty: 0, principal: 0, waived: 0, excess: 0, remainingDueAfter: summary?.totalPayableNow || 0 };
    }
    let remaining = payAmount;
    let penalty = 0;
    let waived = 0;

    if (waivePenalty && summary.totalPenaltyDue > 0) {
      waived = summary.totalPenaltyDue;
    } else if (summary.totalPenaltyDue > 0) {
      penalty = Math.min(remaining, summary.totalPenaltyDue);
      remaining = +(remaining - penalty).toFixed(2);
    }

    const principal = Math.min(remaining, summary.tspOutstandingBalance);
    const excess = Math.max(0, +(principal - summary.installmentDueBalance).toFixed(2));
    const remainingPenaltyAfter = waivePenalty ? 0 : Math.max(0, +(summary.totalPenaltyDue - penalty).toFixed(2));
    const remainingInstallmentAfter = Math.max(0, +(summary.installmentDueBalance - principal).toFixed(2));

    return {
      penalty: +penalty.toFixed(2),
      principal: +principal.toFixed(2),
      waived: +waived.toFixed(2),
      excess,
      remainingDueAfter: +(remainingPenaltyAfter + remainingInstallmentAfter).toFixed(2),
    };
  }, [summary, payAmount, waivePenalty]);

  const displayedJournal = useMemo(() => {
    if (!summary) return [];
    if (journalFilter === "payments") {
      return summary.journal.filter((r) => r.rowType === "payment");
    }
    if (journalFilter === "recent" && summary.journal.length > 14) {
      return summary.journal.slice(-14);
    }
    return summary.journal;
  }, [summary, journalFilter]);

  const openPaymentModal = () => {
    setPayDate(asOfDate);
    setPayAmount(summary.totalPayableNow > 0 ? summary.totalPayableNow : summary.ledger.monthlyAmortization);
    setWaivePenalty(false);
    setShowPaymentModal(true);
  };

  const handlePostPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0 || !payReceipt.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await postBillingPayment({
        accountId: ledger.id,
        paymentDate: payDate,
        amount: payAmount,
        receiptNumber: payReceipt.trim().toUpperCase(),
        paymentMethod: payMethod,
        waivePenalty,
        notes: payNotes.trim() || undefined,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to post payment");
        return;
      }

      const newPayment = {
        id: result.data.paymentId,
        date: payDate,
        amount: payAmount,
        receiptNo: payReceipt.trim().toUpperCase(),
        method: payMethod,
        waivePenalty,
        notes: payNotes.trim() || undefined,
      };

      setLedger((prev) => ({
        ...prev,
        payments: [...prev.payments, newPayment],
      }));

      setShowPaymentModal(false);
      setPayReceipt("");
      setPayNotes("");
      setWaivePenalty(false);
      toast.success("Payment recorded successfully");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoidPayment = async (paymentId: string, receiptNo: string) => {
    if (!confirm(`Void payment entry ${receiptNo} and recalculate ledger?`)) return;

    try {
      const result = await voidBillingPayment({ paymentId });
      if (!result.success) {
        toast.error(result.error || "Failed to void payment");
        return;
      }

      setLedger((prev) => ({
        ...prev,
        payments: prev.payments.filter((p) => p.id !== paymentId),
      }));

      toast.success(`Payment ${receiptNo} voided`);
    } catch {
      toast.error("Failed to void payment");
    }
  };

  const openPoliciesModal = () => {
    setPolPenaltyRate(+((ledger.penaltyRate || 0.035) * 100).toFixed(2));
    setPolEnableAmnesty(Boolean(ledger.policies?.enableMaturityAmnesty));
    setPolAmnestyMonths(ledger.policies?.amnestyMonths ?? 12);
    setPolEnablePostMaturityRate(Boolean(ledger.policies?.enablePostMaturityReducedRate));
    setPolPostMaturityRate(
      ledger.policies?.postMaturityPenaltyRate
        ? +(ledger.policies.postMaturityPenaltyRate * 100).toFixed(2)
        : 2.0
    );
    setShowPoliciesModal(true);
  };

  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await updateBillingPolicies({
        accountId: ledger.id,
        penaltyRate: polPenaltyRate,
        enableMaturityAmnesty: polEnableAmnesty,
        amnestyMonths: polEnableAmnesty ? polAmnestyMonths : undefined,
        enablePostMaturityReducedRate: polEnablePostMaturityRate,
        postMaturityPenaltyRate: polEnablePostMaturityRate ? polPostMaturityRate : undefined,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to save policies");
        return;
      }

      setLedger((prev) => ({
        ...prev,
        penaltyRate: +(polPenaltyRate / 100).toFixed(4),
        policies: {
          enableMaturityAmnesty: polEnableAmnesty,
          amnestyMonths: polEnableAmnesty ? polAmnestyMonths : undefined,
          enablePostMaturityReducedRate: polEnablePostMaturityRate,
          postMaturityPenaltyRate: polEnablePostMaturityRate ? +(polPostMaturityRate / 100).toFixed(4) : undefined,
        },
      }));

      setShowPoliciesModal(false);
      toast.success("Contract policies updated");
    } finally {
      setIsSubmitting(false);
    }
  };

  const noticeHistory = useMemo(() => {
    return ledger.overdueEscalation?.history || [];
  }, [ledger]);

  const currentNoticeStage: OverdueNoticeStage = useMemo(() => {
    if (ledger.status === "Forfeited") return "forfeited";
    if (summary.status !== "overdue") return "none";
    return ledger.overdueEscalation?.currentStage || "first_notice";
  }, [ledger, summary.status]);

  const handleOpenDocModal = (notice?: OverdueNoticeEvent) => {
    setSelectedDocNotice(notice || null);
    setShowDocModal(true);
  };

  const handlePrintNotice = () => {
    printElement("notice-printable-sheet", `Notice Letter — ${ledger.client.fullName}`);
  };

  const handleDownloadNoticePdf = () => {
    const docDate = selectedDocNotice ? selectedDocNotice.date : asOfDate;
    const resolvedStage = selectedDocNotice
      ? selectedDocNotice.stage
      : currentNoticeStage === "none"
      ? "first_notice"
      : currentNoticeStage;
    const docStage = resolvedStage as BillingNoticePdfParams["docStage"];
    const totalDue = selectedDocNotice ? selectedDocNotice.overdueAmount : summary.totalPayableNow;
    const arrears = selectedDocNotice ? selectedDocNotice.arrearsPrincipal : summary.arrearsPrincipal;
    const penalty = selectedDocNotice ? selectedDocNotice.penaltyDue : summary.totalPenaltyDue;
    const trackingNo = selectedDocNotice?.trackingNo;

    downloadBillingNoticePdf({
      clientName: ledger.client.fullName,
      projectArea: ledger.property.projectArea,
      blockNumber: ledger.property.blockNumber,
      lotNumber: ledger.property.lotNumber,
      termMonths: ledger.termMonths,
      monthlyAmortization: ledger.monthlyAmortization,
      docDate,
      docStage,
      totalDue,
      arrears,
      penalty,
      penaltyRate: ledger.penaltyRate,
      trackingNo,
    });
  };

  const openRecordNoticeModal = () => {
    setRecordNoticeDate(asOfDate);
    setRecordNoticeTracking("");
    setRecordNoticeNotes("");
    if (noticeHistory.some((h) => h.stage === "second_notice")) {
      setRecordNoticeStage("final_demand");
    } else if (noticeHistory.some((h) => h.stage === "first_notice")) {
      setRecordNoticeStage("second_notice");
    } else {
      setRecordNoticeStage("first_notice");
    }
    setShowRecordNoticeModal(true);
  };

  const handleRecordNotice = async (andPrint = false) => {
    setIsSubmitting(true);
    try {
      const stageConfig = NOTICE_STAGES.find((s) => s.stage === recordNoticeStage) || NOTICE_STAGES[0];
      const res = await recordBillingNotice({
        accountId: ledger.id,
        stage: stageConfig.stage,
        noticeNumber: stageConfig.num,
        noticeDate: recordNoticeDate || asOfDate,
        title: stageConfig.docTitle,
        trackingNumber: recordNoticeTracking.trim() || undefined,
        notes: recordNoticeNotes.trim() || undefined,
        overdueAmount: summary.totalPayableNow,
        arrearsPrincipal: summary.arrearsPrincipal,
        penaltyDue: summary.totalPenaltyDue,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to record notice");
        return;
      }

      const newNotice: OverdueNoticeEvent = {
        id: res.data.noticeId,
        stage: stageConfig.stage,
        noticeNumber: stageConfig.num,
        date: recordNoticeDate || asOfDate,
        title: stageConfig.docTitle,
        trackingNo: recordNoticeTracking.trim() || undefined,
        notes: recordNoticeNotes.trim() || undefined,
        overdueAmount: summary.totalPayableNow,
        arrearsPrincipal: summary.arrearsPrincipal,
        penaltyDue: summary.totalPenaltyDue,
      };

      setLedger((prev) => ({
        ...prev,
        overdueEscalation: {
          currentStage: stageConfig.stage,
          history: [newNotice, ...(prev.overdueEscalation?.history || [])],
        },
      }));

      setShowRecordNoticeModal(false);
      toast.success(`${stageConfig.label} recorded successfully`);

      if (andPrint) {
        setSelectedDocNotice(newNotice);
        setShowDocModal(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditNoticeModal = (notice: OverdueNoticeEvent) => {
    setEditingNotice(notice);
    setEditNoticeStage(
      notice.stage === "forfeited"
        ? "final_demand"
        : (notice.stage as "first_notice" | "second_notice" | "final_demand")
    );
    setEditNoticeDate(notice.date);
    setEditNoticeTracking(notice.trackingNo || "");
    setEditNoticeNotes(notice.notes || "");
    setShowEditNoticeModal(true);
  };

  const handleUpdateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNotice) return;
    setIsSubmitting(true);
    try {
      const stageConfig = NOTICE_STAGES.find((s) => s.stage === editNoticeStage) || NOTICE_STAGES[0];
      const res = await updateBillingNotice({
        noticeId: editingNotice.id,
        stage: stageConfig.stage,
        noticeNumber: stageConfig.num,
        noticeDate: editNoticeDate,
        title: stageConfig.docTitle,
        trackingNumber: editNoticeTracking.trim() || undefined,
        notes: editNoticeNotes.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to update notice");
        return;
      }

      setLedger((prev) => ({
        ...prev,
        overdueEscalation: {
          currentStage: prev.overdueEscalation?.currentStage || stageConfig.stage,
          history: (prev.overdueEscalation?.history || []).map((h) =>
            h.id === editingNotice.id
              ? {
                  ...h,
                  stage: stageConfig.stage,
                  noticeNumber: stageConfig.num,
                  date: editNoticeDate,
                  title: stageConfig.docTitle,
                  trackingNo: editNoticeTracking.trim() || undefined,
                  notes: editNoticeNotes.trim() || undefined,
                }
              : h
          ),
        },
      }));

      setShowEditNoticeModal(false);
      toast.success("Notice record updated");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmForfeiture = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const forfeitRes = await forfeitBillingAccount({
        accountId: ledger.id,
        reason: forfeitReason.trim() || "Unsettled contract arrears following final demand",
        forfeitedAt: forfeitDate || asOfDate,
      });

      if (!forfeitRes.success) {
        toast.error(forfeitRes.error || "Failed to forfeit contract");
        return;
      }

      const forfeitNotice: OverdueNoticeEvent = {
        id: `notif-${Date.now()}`,
        stage: "forfeited",
        noticeNumber: 4,
        date: forfeitDate || asOfDate,
        title: "NOTICE OF FORFEITURE & CONTRACT RESCISSION",
        notes: forfeitReason.trim() || undefined,
        overdueAmount: summary.totalPayableNow,
        arrearsPrincipal: summary.arrearsPrincipal,
        penaltyDue: summary.totalPenaltyDue,
      };

      setLedger((prev) => ({
        ...prev,
        status: "Forfeited",
        overdueEscalation: {
          currentStage: "forfeited",
          history: [forfeitNotice, ...(prev.overdueEscalation?.history || [])],
        },
      }));

      setShowForfeitModal(false);
      toast.success("Contract cancelled and property ownership forfeited");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDynamicParticulars = (row: LedgerJournalRow) => {
    if (row.rowType === "opening") {
      return (
        <div className="flex items-start space-x-2">
          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <span className="font-medium text-foreground">Initial Total Selling Price</span>
        </div>
      );
    }
    if (row.rowType === "downpayment_due") {
      return (
        <div className="flex items-start space-x-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <span className="font-medium text-foreground">{row.description}</span>
        </div>
      );
    }
    if (row.rowType === "installment_due") {
      const isCurrentTerm = row.description.includes("Current Term");
      return (
        <div className="flex items-start space-x-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-foreground">Installment #{row.instLabel} Due</span>
            {isCurrentTerm && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                Current Term
              </span>
            )}
          </div>
        </div>
      );
    }
    if (row.rowType === "penalty_charge") {
      return (
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-destructive">{row.description}</span>
            {row.penaltyBase ? (
              <div className="text-[11px] text-destructive/80 mt-0.5">
                Assessed on <span className="font-mono tabular-nums">{formatCurrency(row.penaltyBase)}</span> overdue
              </div>
            ) : null}
          </div>
        </div>
      );
    }
    const methodLabel = (row.method || "cash").replace("_", " ");
    return (
      <div className="flex items-start space-x-2">
        <Receipt className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono font-semibold text-foreground">
              {row.receiptNo || "Payment Recorded"}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-card border border-border-warm font-medium shadow-2xs">
              {methodLabel}
            </span>
          </div>
          {(row.penaltyPaid || row.penaltyWaived || row.notes) && (
            <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-2">
              {row.penaltyPaid ? (
                <span>
                  <span className="font-mono tabular-nums">{formatCurrency(row.penaltyPaid)}</span> pen +{" "}
                  <span className="font-mono tabular-nums">{formatCurrency(row.principalPaid || 0)}</span> prin
                </span>
              ) : null}
              {row.penaltyWaived ? (
                <span className="text-amber-700 dark:text-amber-400 font-medium">
                  <span className="font-mono tabular-nums">{formatCurrency(row.penaltyWaived)}</span> pen waived
                </span>
              ) : null}
              {row.notes && <span className="text-muted-foreground/80 italic">• {row.notes}</span>}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDynamicChange = (row: LedgerJournalRow) => {
    if (row.rowType === "opening") {
      return <span className="text-muted-foreground">-</span>;
    }
    if (row.rowType === "downpayment_due" || row.rowType === "installment_due") {
      return (
        <span className="font-mono text-foreground/80">+{formatCurrency(row.monthlyDue || 0)}</span>
      );
    }
    if (row.rowType === "penalty_charge") {
      return (
        <span className="font-mono text-destructive font-semibold">+{formatCurrency(row.penaltyCharged || 0)}</span>
      );
    }
    return (
      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">-{formatCurrency(row.amountPaid || 0)}</span>
    );
  };

  const renderRunningDueCell = (row: LedgerJournalRow) => {
    if (row.advanceCredit > 0) {
      return (
        <div className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono tabular-nums">
          +{formatCurrency(row.advanceCredit)} adv
        </div>
      );
    }
    const totalRunningDue = +(row.currentDueBalance + row.penaltyBalance).toFixed(2);
    if (totalRunningDue === 0) {
      return <span className="text-muted-foreground font-mono">₱0.00</span>;
    }
    return (
      <div>
        <div className="font-mono font-bold text-foreground">{formatCurrency(totalRunningDue)}</div>
        {row.penaltyBalance > 0 && (
          <div className="text-[10px] text-destructive font-mono tabular-nums">
            {formatCurrency(row.currentDueBalance)} + {formatCurrency(row.penaltyBalance)} pen
          </div>
        )}
      </div>
    );
  };

  const renderNoticeDocument = (docNotice: OverdueNoticeEvent | null) => {
    const docDate = docNotice ? docNotice.date : asOfDate;
    const docStage = docNotice ? docNotice.stage : currentNoticeStage;
    const stageConfig = NOTICE_STAGES.find((s) => s.stage === docStage) || NOTICE_STAGES[0];
    const totalDue = docNotice ? docNotice.overdueAmount : summary.totalPayableNow;
    const arrears = docNotice ? docNotice.arrearsPrincipal : summary.arrearsPrincipal;
    const penalty = docNotice ? docNotice.penaltyDue : summary.totalPenaltyDue;
    const trackingNo = docNotice?.trackingNo;

    return (
      <div className="space-y-6 text-black leading-relaxed text-xs bg-white p-6 sm:p-10">
        <div className="border-b-2 border-black pb-4 text-center space-y-1">
          <div className="font-bold text-sm sm:text-base tracking-wide uppercase">
            First Davao Millennium Property Ventures Services, Inc.
          </div>
          <div className="text-[11px] text-slate-600">
            No. 59 FDM Bldg., Bolton Ext., Brgy. 1-A, Davao City • Tel: (082) 222-0000
          </div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 pt-0.5">
            Credit, Billing &amp; Legal Affairs Department
          </div>
        </div>

        <div className="flex justify-between items-start text-xs pt-2">
          <div>
            <div><span className="font-semibold">Date Issued:</span> {formatDate(docDate)}</div>
            <div><span className="font-semibold">Buyer Name:</span> <span className="font-bold">{ledger.client.fullName}</span></div>
            <div><span className="font-semibold">Property:</span> {ledger.property.projectArea} • Blk {ledger.property.blockNumber} Lot {ledger.property.lotNumber}</div>
          </div>
          <div className="text-right">
            <div><span className="font-semibold">Contract Plan:</span> {ledger.termMonths} Months ({formatCurrency(ledger.monthlyAmortization)}/mo)</div>
            {trackingNo && (
              <div className="text-[11px] text-slate-600">
                <span className="font-semibold">Tracking Ref:</span> <span className="font-mono">{trackingNo}</span>
              </div>
            )}
          </div>
        </div>

        <div className="py-2.5 px-4 bg-slate-100 border border-slate-300 text-center rounded my-4">
          <div className="font-bold text-sm tracking-wide text-black uppercase">
            {stageConfig.docTitle}
          </div>
          <div className="text-[11px] text-slate-600 italic">
            {stageConfig.subtitle}
          </div>
        </div>

        <div className="space-y-3 text-justify leading-normal">
          {docStage === "first_notice" && (
            <>
              <p>
                Our billing records indicate that your installment obligations for <strong>{ledger.property.projectArea} Block {ledger.property.blockNumber} Lot {ledger.property.lotNumber}</strong> have matured and remain unpaid as of <strong>{formatDate(docDate)}</strong>.
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded my-2 space-y-1">
                <div className="flex justify-between font-medium">
                  <span>Overdue Principal Arrears:</span>
                  <span className="font-mono">{formatCurrency(arrears)}</span>
                </div>
                <div className="flex justify-between text-red-700 font-medium">
                  <span>Accumulated Late Penalties ({(ledger.penaltyRate * 100).toFixed(1)}%/mo per Sec. 3):</span>
                  <span className="font-mono">{formatCurrency(penalty)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-slate-200 pt-1 text-black">
                  <span>Total Due and Demandable Now:</span>
                  <span className="font-mono">{formatCurrency(totalDue)}</span>
                </div>
              </div>
              <p>
                Please remit the total amount due at our main office on Bolton Ext., Davao City, or via accredited bank transfer within seven (7) days upon receipt hereof to maintain your account in good standing.
              </p>
            </>
          )}

          {docStage === "second_notice" && (
            <>
              <p>
                This serves as our <strong>SECOND FORMAL NOTICE &amp; DEMAND</strong> regarding your overdue account. Despite our previous notice, your monthly installments remain unsettled, placing your Contract to Sell in sustained default.
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded my-2 space-y-1">
                <div className="flex justify-between font-medium">
                  <span>Overdue Principal:</span>
                  <span className="font-mono">{formatCurrency(arrears)}</span>
                </div>
                <div className="flex justify-between text-red-700 font-medium">
                  <span>Late Surcharges / Penalties:</span>
                  <span className="font-mono">{formatCurrency(penalty)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-slate-200 pt-1 text-black">
                  <span>Total Amount Demanded:</span>
                  <span className="font-mono">{formatCurrency(totalDue)}</span>
                </div>
              </div>
              <p>
                <strong>DEMAND IS HEREBY MADE</strong> upon you to settle the full amount of <strong>{formatCurrency(totalDue)}</strong> within fifteen (15) days from receipt of this letter. Failure to comply will leave us no recourse but to initiate formal notarized contract cancellation and forfeiture proceedings pursuant to Section 8 of your Contract to Sell.
              </p>
            </>
          )}

          {docStage === "final_demand" && (
            <>
              <p>
                <strong>FINAL DEMAND AND NOTARIZED NOTICE OF CANCELLATION</strong> under Section 8 and 9 of the Contract to Sell and Republic Act No. 6552 (Maceda Law).
              </p>
              <p>
                Having defaulted in your monthly installment payments, with total accumulated overdue obligations now amounting to <strong>{formatCurrency(totalDue)}</strong> (comprising {formatCurrency(arrears)} in principal arrears and {formatCurrency(penalty)} in surcharges), First Davao Millennium hereby formally gives notice of cancellation of your Contract.
              </p>
              <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded my-2 font-medium">
                You are hereby granted a final, non-extendible period of <strong>THIRTY (30) DAYS</strong> from service of this notice within which to fully pay your total outstanding arrears.
              </div>
              <p>
                Should you fail to fully settle within said thirty (30) day grace period, this Contract shall be deemed officially and irrevocably cancelled without need of judicial action, all payments previously made shall be forfeited, and you shall immediately surrender possession of the property.
              </p>
            </>
          )}

          {docStage === "forfeited" && (
            <>
              <p>
                The thirty (30) day grace period granted in the Notarized Notice of Cancellation having fully expired without the settlement of your overdue account ({formatCurrency(totalDue)}), notice is hereby officially served that Contract for <strong>{ledger.property.projectArea} Block {ledger.property.blockNumber} Lot {ledger.property.lotNumber}</strong> is <strong>CANCELLED, TERMINATED, AND RESCINDED</strong>.
              </p>
              <p>
                Pursuant to Section 8, 9, and 10 of the Contract to Sell, all payments made under this contract are hereby declared <strong>FORFEITED</strong> in favor of First Davao Millennium Property Ventures Services, Inc. and treated as liquidated damages and reasonable rentals for the use and occupancy of the premises.
              </p>
              <p>
                You are hereby directed to peacefully vacate and surrender the subject premises within five (5) days from receipt hereof. First Davao Millennium is now legally free to enter and dispose of the property.
              </p>
            </>
          )}
        </div>

        <div className="pt-8 grid grid-cols-2 gap-8 text-xs">
          <div>
            <div className="text-slate-500 text-[11px]">Issued by:</div>
            <div className="mt-8 font-bold text-black border-t border-black pt-1">
              FIRST DAVAO MILLENNIUM
            </div>
            <div className="text-slate-600 text-[11px]">Credit &amp; Collection Department</div>
          </div>
          <div>
            <div className="text-slate-500 text-[11px]">Noted / Approved:</div>
            <div className="mt-8 font-bold text-black border-t border-black pt-1">
              MANAGEMENT / LEGAL COUNSEL
            </div>
            <div className="text-slate-600 text-[11px]">First Davao Millennium Property Ventures</div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between">
          <span>Served via: Registered Mail / Personal Service</span>
          <span>Copy on File • Credit &amp; Collection Dept.</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Print-Only Statement / Notice Document Target */}
      {showDocModal ? (
        <div className="hidden print:block bg-white">
          {renderNoticeDocument(selectedDocNotice)}
        </div>
      ) : (
        <div className="hidden print:block">
          <ExcelSoaDocument ledger={ledger} summary={summary} asOfDate={asOfDate} />
        </div>
      )}

      {/* Top Bar Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard/billing"
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {ledger.client.fullName}
              </h1>
              <LedgerStatusBadge summary={summary} compact={false} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ledger.property.projectArea} • Block {ledger.property.blockNumber} Lot {ledger.property.lotNumber} ({ledger.property.lotArea} sqm)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {ledger.clearedAt ? (
            <button
              onClick={() => setShowClearanceModal(true)}
              className="px-2.5 py-1.5 text-xs font-medium border border-border-warm rounded-lg bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center space-x-1 shadow-2xs"
              title="Undo clearance (before Legal processes title)"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo Clearance</span>
            </button>
          ) : summary.status === "settled" && ledger.status !== "Forfeited" ? (
            <button
              onClick={() => setShowClearanceModal(true)}
              className="px-3 py-1.5 text-xs font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center space-x-1 shadow-2xs"
              title="Clear account and forward to Legal for land title issuance"
            >
              <Scale className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
              <span>Clear for Legal</span>
            </button>
          ) : null}

          <button
            onClick={() => exportLedgerToExcel(ledger, summary, asOfDate)}
            className="px-3 py-1.5 text-xs font-medium border border-border-warm rounded-lg bg-card text-foreground hover:bg-muted transition-colors flex items-center space-x-1 shadow-2xs"
            title="Download editable Excel (.xlsx) matching official statement format"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            <span>Download Excel</span>
          </button>
          <button
            onClick={() => setShowSoaModal(true)}
            className="px-3 py-1.5 text-xs font-medium border border-border-warm rounded-lg bg-card text-foreground hover:bg-muted transition-colors flex items-center space-x-1 shadow-2xs"
            title="Preview and print official Statement of Account as PDF"
          >
            <Printer className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
            <span>Print SOA (PDF)</span>
          </button>
          <button
            onClick={openPaymentModal}
            disabled={summary.status === "settled" || ledger.status === "Forfeited"}
            className="px-3.5 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center space-x-1 shadow-2xs"
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1" />
            <span>Post Payment</span>
          </button>
        </div>
      </div>

      {/* Clearance Status / Legal Turnover Notification Banner */}
      {ledger.clearedAt ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs print:hidden">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                <span>Account Cleared for Legal Turnover</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  Certified {formatDate(ledger.clearedAt)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Financial obligations certified. Property lot status is marked as <strong>Sold</strong> and the account is ready for land title preparation in Legal.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/legal"
            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-1.5 shrink-0 shadow-2xs"
          >
            <span>View Legal Turnover Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : summary.status === "settled" && ledger.status !== "Forfeited" ? (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs print:hidden">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 sm:mt-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-sm text-foreground">
                All Financial Obligations Settled
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                The total contract price and all assessments have been fully settled. Clear this account to advance the property lot to <strong>Sold</strong> and forward it to Legal for land title issuance.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowClearanceModal(true)}
            className="px-3.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1.5 shrink-0 shadow-2xs"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Clear Account for Legal</span>
          </button>
        </div>
      ) : null}

      {/* 3 Summary Cards in a Single Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        {/* Card 1: Due Now & Penalties */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between shadow-xs ${
            summary.status === "overdue"
              ? "bg-destructive/5 border-destructive/20"
              : summary.status === "due_soon"
              ? "bg-amber-500/5 border-amber-500/20"
              : "bg-card border-border-warm"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Due Now
              </div>
              {summary.status === "due_soon" && (
                <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                  Due in {summary.daysUntilDue} days
                </span>
              )}
              {summary.status === "overdue" && (
                <span className="text-[11px] font-medium text-destructive">
                  {summary.monthsOverdue}m Overdue
                </span>
              )}
              {summary.status === "current" && (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Current</span>
              )}
              {summary.status === "settled" && (
                <span className="text-[11px] font-medium text-muted-foreground">Settled</span>
              )}
            </div>
            <div
              className={`text-2xl font-mono font-bold tabular-nums ${
                summary.status === "overdue"
                  ? "text-destructive"
                  : summary.status === "due_soon"
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-foreground"
              }`}
            >
              {summary.totalPayableNow > 0
                ? formatCurrency(summary.totalPayableNow)
                : summary.advanceCredit > 0
                ? `+${formatCurrency(summary.advanceCredit)} adv`
                : "₱0.00"}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border-warm text-xs text-muted-foreground space-y-1">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Arrears</span>
                <span className="font-mono font-semibold tabular-nums text-destructive">
                  {formatCurrency(summary.arrearsPrincipal)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Penalties</span>
                <span className="font-mono font-semibold tabular-nums text-destructive">
                  {formatCurrency(summary.totalPenaltyDue)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">
                  Term #{summary.currentInstNo}
                </span>
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {formatCurrency(summary.currentTermBalance)}
                </span>
              </div>
            </div>
            {(summary.totalPenaltyPaid > 0 || summary.totalPenaltyWaived > 0) && (
              <div className="pt-1 text-[11px] text-muted-foreground flex items-center justify-between border-t border-border-warm/50">
                <span>Paid Pen: <span className="font-mono font-medium text-foreground">{formatCurrency(summary.totalPenaltyPaid)}</span></span>
                {summary.totalPenaltyWaived > 0 && (
                  <span className="text-amber-700 dark:text-amber-400 font-medium">
                    Waived: <span className="font-mono">{formatCurrency(summary.totalPenaltyWaived)}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Contract Terms */}
        <div
          onClick={openPoliciesModal}
          className="bg-card p-4 rounded-xl border border-border-warm flex flex-col justify-between cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group shadow-xs"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold group-hover:text-foreground transition-colors flex items-center gap-1.5">
                <span>Contract Terms</span>
                <SlidersHorizontal className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
              </div>
              <span className="text-xs text-muted-foreground">
                TCP: <span className="font-mono font-semibold text-foreground">{formatCurrency(ledger.contractPrice)}</span>
              </span>
            </div>
            <div className="flex items-baseline space-x-1.5">
              <div className="text-2xl font-mono font-bold text-foreground tabular-nums">
                {formatCurrency(ledger.monthlyAmortization)}
              </div>
              <span className="text-xs text-muted-foreground font-medium">/ month</span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border-warm text-xs">
            <div className="grid grid-cols-2 gap-y-2 gap-x-2">
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Plan Term</span>
                <span className="font-semibold text-foreground">{ledger.termMonths} Months</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Schedule</span>
                <span className="font-semibold text-foreground">Due Day {ledger.dueDay}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Late Penalty</span>
                <span className="font-semibold text-foreground">{(ledger.penaltyRate * 100).toFixed(1)}% / mo</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">First Due</span>
                <span className="text-foreground">{formatDate(ledger.firstDueDate)}</span>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-border-warm flex items-center justify-between text-xs">
              {(ledger.policies?.enableMaturityAmnesty || ledger.policies?.enablePostMaturityReducedRate) ? (
                <div className="flex items-center space-x-1.5">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-1.5" />
                    Policies active
                  </span>
                  <HelpTip
                    title="Active Policies"
                    text="Special compromise arrangements such as 12-month post-maturity amnesty or reduced penalty rate are enabled on this contract."
                  />
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground">Standard terms</span>
              )}
              <span className="text-[11px] text-primary group-hover:underline font-medium">
                Edit terms →
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Balance & Collections */}
        <div className="bg-card p-4 rounded-xl border border-border-warm flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Contract Balance
              </div>
              <span className="text-xs text-muted-foreground">
                {summary.paidTermsEquivalent} of {ledger.termMonths} mos ({(((ledger.contractPrice - summary.tspOutstandingBalance) / ledger.contractPrice) * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="text-2xl font-mono font-bold text-foreground tabular-nums">
              {formatCurrency(summary.tspOutstandingBalance)}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border-warm text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Total Collected</span>
                <span className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatCurrency(summary.totalCollected)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Receipts Logged</span>
                <span className="font-semibold text-foreground">
                  {ledger.payments.length} payment{ledger.payments.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            {summary.currentTermDueDate && summary.status !== "settled" && (
              <div className="mt-2 pt-1 border-t border-border-warm text-[11px] text-muted-foreground flex justify-between">
                <span>Cycle Due Date:</span>
                <span className="font-medium text-foreground">{formatDate(summary.currentTermDueDate)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Bar & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border-warm gap-2 print:hidden">
        <div className="flex space-x-4 text-xs">
          <button
            onClick={() => setActiveTab("journal")}
            className={`pb-2.5 border-b-2 font-medium flex items-center space-x-1.5 transition-colors ${
              activeTab === "journal"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Running Ledger ({summary.journal.length})</span>
            <HelpTip
              title="Running Ledger"
              text="Shows only past terms and the active current term in chronological order. Future months appear once their billing cycle begins."
            />
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`pb-2.5 border-b-2 font-medium flex items-center space-x-1.5 transition-colors ${
              activeTab === "payments"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Payment Receipts ({ledger.payments.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("notices")}
            className={`pb-2.5 border-b-2 font-medium flex items-center space-x-1.5 transition-colors ${
              activeTab === "notices"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Notices &amp; Forfeiture</span>
            {summary.status === "overdue" && (
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse ml-0.5" />
            )}
            <HelpTip
              title="Notices & Forfeiture"
              text="Track overdue notices, formal demand letters, and legal forfeiture proceedings per Section 8 & 9 of the Contract to Sell."
            />
          </button>
        </div>

        {activeTab === "journal" && (
          <div className="flex items-center space-x-1 pb-1.5 text-xs">
            <button
              onClick={() => setJournalFilter("all")}
              className={`px-2 py-1 rounded transition-colors ${
                journalFilter === "all"
                  ? "bg-muted text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              All ({summary.journal.length})
            </button>
            {summary.journal.length > 14 && (
              <button
                onClick={() => setJournalFilter("recent")}
                className={`px-2 py-1 rounded transition-colors ${
                  journalFilter === "recent"
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Recent 14
              </button>
            )}
            <button
              onClick={() => setJournalFilter("payments")}
              className={`px-2 py-1 rounded transition-colors ${
                journalFilter === "payments"
                  ? "bg-muted text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              Payments Only
            </button>
          </div>
        )}
      </div>

      {/* Dynamic 6-Column Running Ledger Table */}
      {activeTab === "journal" && (
        <div className="bg-card rounded-xl border border-border-warm overflow-hidden shadow-xs print:hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-warm bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 px-3 w-20">Term</th>
                  <th className="py-2.5 px-3 w-28">Date</th>
                  <th className="py-2.5 px-3">Particulars</th>
                  <th className="py-2.5 px-3 text-right">Change</th>
                  <th className="py-2.5 px-3 text-right bg-muted/30 border-l border-border-warm">
                    Running Due
                  </th>
                  <th className="py-2.5 px-3 text-right border-l border-border-warm">
                    Contract Bal
                  </th>
                  <th className="py-2.5 px-2 w-8 print:hidden"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-warm">
                {displayedJournal.map((row, idx, arr) => {
                  const isPayment = row.rowType === "payment";
                  const isPenalty = row.rowType === "penalty_charge";
                  const isCurrentTerm =
                    row.rowType === "installment_due" && row.description.includes("Current Term");
                  const isNewTerm = idx > 0 && row.instLabel !== arr[idx - 1]?.instLabel;
                  const isFirstRowOfTerm = idx === 0 || row.instLabel !== arr[idx - 1]?.instLabel;

                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "hover:bg-muted/40 transition-colors",
                        isNewTerm && "border-t-2 !border-t-border-warm-strong [&>td]:border-t-2 [&>td]:!border-t-border-warm-strong",
                        isPayment
                          ? "bg-emerald-500/5"
                          : isPenalty
                          ? "bg-destructive/5"
                          : isCurrentTerm
                          ? "bg-blue-500/5"
                          : ""
                      )}
                    >
                      <td className="py-2.5 px-3 font-mono align-top">
                        <span
                          className={
                            isFirstRowOfTerm
                              ? "font-semibold text-foreground"
                              : "text-muted-foreground font-normal"
                          }
                        >
                          {row.instLabel === "START"
                            ? "START"
                            : row.instLabel === "Mature"
                            ? "MATURE"
                            : `#${row.instLabel}`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-foreground/90 whitespace-nowrap align-top">
                        {formatDate(row.date)}
                      </td>
                      <td className="py-2.5 px-3 align-top">{renderDynamicParticulars(row)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap align-top">
                        {renderDynamicChange(row)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums bg-muted/15 border-l border-border-warm align-top">
                        {renderRunningDueCell(row)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-mono font-semibold text-foreground border-l border-border-warm align-top">
                        {formatCurrency(row.tspBalance)}
                      </td>
                      <td className="py-2.5 px-2 text-center align-top print:hidden">
                        {row.paymentId && (
                          <button
                            onClick={() => handleVoidPayment(row.paymentId!, row.receiptNo || "")}
                            title="Void payment entry"
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Receipts Tab */}
      {activeTab === "payments" && (
        <div className="bg-card rounded-xl border border-border-warm overflow-hidden shadow-xs print:hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-warm bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 px-3">Date Paid</th>
                  <th className="py-2.5 px-3">Receipt No.</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3 text-right">Amount Paid</th>
                  <th className="py-2.5 px-3 text-right">To Penalty</th>
                  <th className="py-2.5 px-3 text-right">To Principal</th>
                  <th className="py-2.5 px-3 text-right">Waived</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-warm">
                {summary.journal.filter((r) => r.rowType === "payment").length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      No payments recorded up to {formatDate(asOfDate)}.
                    </td>
                  </tr>
                ) : (
                  summary.journal
                    .filter((r) => r.rowType === "payment")
                    .slice()
                    .reverse()
                    .map((r) => (
                      <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-foreground">
                          {formatDate(r.date)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-foreground">{r.receiptNo}</td>
                        <td className="py-2.5 px-3 uppercase text-muted-foreground">
                          {(r.method || "cash").replace("_", " ")}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-foreground">
                          {formatCurrency(r.amountPaid || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-destructive">
                          {r.penaltyPaid ? formatCurrency(r.penaltyPaid) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(r.principalPaid || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                          {r.penaltyWaived ? formatCurrency(r.penaltyWaived) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[200px]">
                          {r.notes || "-"}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {r.paymentId && (
                            <button
                              onClick={() => handleVoidPayment(r.paymentId!, r.receiptNo || "")}
                              title="Void payment entry"
                              className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notices & Forfeiture Tab */}
      {activeTab === "notices" && (
        <div className="space-y-4 print:hidden">
          <div className="bg-card rounded-xl border border-border-warm shadow-xs overflow-hidden">
            {/* Header with Title and Action Controls */}
            <div className="p-4 border-b border-border-warm flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-sm text-foreground">Formal Notices &amp; Forfeiture</h3>
                  {ledger.status === "Forfeited" ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-foreground text-background">
                      Contract Forfeited
                    </span>
                  ) : summary.status === "overdue" ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                      {summary.monthsOverdue}m Overdue
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      Good Standing
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Record notices, track delivery waybills, and execute contract rescission.
                </p>
              </div>

              {ledger.status !== "Forfeited" && (
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={openRecordNoticeModal}
                    className="px-3 py-1.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)] transition-colors flex items-center space-x-1 shadow-2xs text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    <span>Record Notice</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForfeitDate(asOfDate);
                      setForfeitReason("");
                      setShowForfeitModal(true);
                    }}
                    className="px-3 py-1.5 border border-destructive/30 bg-card text-destructive font-medium rounded-lg hover:bg-destructive/10 transition-colors flex items-center space-x-1 text-xs"
                  >
                    <Ban className="w-3.5 h-3.5 mr-1" />
                    <span>Forfeit Account</span>
                  </button>
                </div>
              )}
            </div>

            {/* Forfeited Notice Banner */}
            {ledger.status === "Forfeited" && (
              <div className="bg-destructive/10 border-b border-destructive/20 p-4 flex items-start space-x-3 text-xs text-destructive">
                <Ban className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Contract Rescinded and Property Forfeited</div>
                  <div className="text-destructive/90 mt-0.5">
                    Ownership has been rescinded and the lot returned to inventory pursuant to Contract to Sell Section 8 and the Maceda Law.
                  </div>
                </div>
              </div>
            )}

            {/* Notice Events List or Empty State */}
            {noticeHistory.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-3">
                <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground text-sm">No notices recorded yet</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Issue a payment reminder or formal demand letter to record proof of due process.
                  </p>
                </div>
                {ledger.status !== "Forfeited" && (
                  <button
                    type="button"
                    onClick={openRecordNoticeModal}
                    className="inline-flex items-center px-3 py-1.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)] transition-colors text-xs shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    <span>Record First Notice</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border-warm">
                {noticeHistory.map((ev) => {
                  const stageBadgeClass =
                    ev.stage === "forfeited"
                      ? "bg-foreground text-background"
                      : ev.stage === "final_demand"
                      ? "bg-destructive/10 text-destructive border border-destructive/20"
                      : ev.stage === "second_notice"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                      : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20";

                  const stageLabel =
                    NOTICE_STAGES.find((s) => s.stage === ev.stage)?.label || ev.title;

                  return (
                    <div
                      key={ev.id}
                      className="p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${stageBadgeClass}`}>
                            {stageLabel}
                          </span>
                          <span className="font-semibold text-foreground">{ev.title}</span>
                          <span className="text-muted-foreground">• Served {formatDate(ev.date)}</span>
                        </div>

                        <div className="flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
                          <div>
                            <span>Demanded:</span>{" "}
                            <span className="font-mono font-semibold text-foreground">
                              {formatCurrency(ev.overdueAmount)}
                            </span>
                          </div>
                          <div>
                            <span>Arrears:</span>{" "}
                            <span className="font-mono text-foreground">{formatCurrency(ev.arrearsPrincipal)}</span>
                          </div>
                          <div>
                            <span>Penalties:</span>{" "}
                            <span className="font-mono text-foreground">{formatCurrency(ev.penaltyDue)}</span>
                          </div>
                          {ev.trackingNo && (
                            <div>
                              <span>Waybill:</span>{" "}
                              <span className="font-mono font-medium text-foreground">{ev.trackingNo}</span>
                            </div>
                          )}
                        </div>

                        {ev.notes && (
                          <div className="text-[11px] text-muted-foreground italic">
                            “{ev.notes}”
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 self-start sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleOpenDocModal(ev)}
                          className="px-2.5 py-1.5 border border-border-warm rounded-lg bg-card text-foreground hover:bg-muted transition-colors flex items-center space-x-1 shadow-2xs text-xs font-medium"
                        >
                          <Printer className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                          <span>View Letter</span>
                        </button>

                        {ev.stage !== "forfeited" && ledger.status !== "Forfeited" && (
                          <button
                            type="button"
                            onClick={() => openEditNoticeModal(ev)}
                            className="px-2.5 py-1.5 border border-border-warm rounded-lg bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center space-x-1 shadow-2xs text-xs font-medium"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-lg bg-card print:hidden border-border-warm shadow-lg">
          <DialogHeader className="border-b border-border-warm pb-3">
            <DialogTitle className="text-sm font-semibold text-foreground">
              Post Payment — <span className="font-bold">{ledger.client.fullName}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Supports partial, regular installment, and full settlements
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePostPayment} className="space-y-4 text-xs">
              <div className="flex flex-wrap gap-1.5">
                {summary.totalPayableNow > 0 && (
                  <button
                    type="button"
                    onClick={() => setPayAmount(summary.totalPayableNow)}
                    className="px-2.5 py-1 rounded bg-card hover:bg-muted text-foreground text-xs transition-colors font-medium border border-border-warm shadow-2xs"
                  >
                    Pay Due Now: <span className="font-mono">{formatCurrency(summary.totalPayableNow)}</span>
                  </button>
                )}
                {summary.currentTermBalance > 0 && summary.currentTermBalance !== summary.totalPayableNow && (
                  <button
                    type="button"
                    onClick={() => setPayAmount(summary.currentTermBalance)}
                    className="px-2.5 py-1 rounded bg-card hover:bg-muted text-foreground text-xs transition-colors font-medium border border-border-warm shadow-2xs"
                  >
                    Current Term Only: <span className="font-mono">{formatCurrency(summary.currentTermBalance)}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPayAmount(ledger.monthlyAmortization)}
                  className="px-2.5 py-1 rounded bg-card hover:bg-muted text-foreground text-xs transition-colors font-medium border border-border-warm shadow-2xs"
                >
                  Regular Amort: <span className="font-mono">{formatCurrency(ledger.monthlyAmortization)}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-medium text-muted-foreground mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border-warm rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase font-medium text-muted-foreground mb-1">
                    Receipt Ref (CR# / OR#)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="OR#12345 or CR#001"
                    value={payReceipt}
                    onChange={(e) => setPayReceipt(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border-warm rounded-lg bg-card text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase font-medium text-muted-foreground mb-1">
                    Amount Paid (PHP)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    step="any"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-border-warm rounded-lg bg-card text-foreground font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase font-medium text-muted-foreground mb-1">
                    Method
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as "cash" | "check" | "bank_transfer")}
                    className="w-full px-2.5 py-1.5 border border-border-warm rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-medium text-muted-foreground mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Collector name, bank branch, or check no."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-border-warm rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {summary.totalPenaltyDue > 0 && (
                <div className="bg-muted/20 border border-border-warm rounded-lg p-3">
                  <label className="flex items-start space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={waivePenalty}
                      onChange={(e) => setWaivePenalty(e.target.checked)}
                      className="mt-0.5 rounded border-border-warm text-primary focus:ring-primary"
                    />
                    <span className="font-semibold text-foreground inline-flex items-center">
                      Waive Late Penalties
                      <HelpTip
                        title="Penalty Waiver"
                        text="Clears all unpaid late penalties so the entire payment applies directly toward the contract principal."
                      />
                    </span>
                  </label>
                </div>
              )}

              <div className="bg-muted/20 border border-border-warm rounded-lg p-3 space-y-1.5">
                <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1 flex items-center">
                  <span>Payment Split Preview</span>
                  <HelpTip
                    title="Payment Order"
                    text="By standard rule, payments always settle unpaid late penalties first before reducing the main installment balance."
                  />
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Unpaid Late Penalty:</span>
                  <span className="tabular-nums font-mono font-semibold text-destructive">
                    {formatCurrency(summary.totalPenaltyDue)}
                  </span>
                </div>
                {waivePenalty ? (
                  <div className="flex justify-between text-amber-700 dark:text-amber-400 font-medium">
                    <span>Penalty Waived:</span>
                    <span className="tabular-nums font-mono">-{formatCurrency(allocationPreview.waived)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-foreground font-medium">
                    <span>1. Goes to Penalty:</span>
                    <span className="tabular-nums font-mono">{formatCurrency(allocationPreview.penalty)}</span>
                  </div>
                )}
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium border-t border-border-warm pt-1">
                  <span>2. Goes to Principal:</span>
                  <span className="tabular-nums font-mono font-semibold">
                    {formatCurrency(allocationPreview.principal)}
                  </span>
                </div>
                {allocationPreview.excess > 0 ? (
                  <div className="flex justify-between text-blue-700 dark:text-blue-300 font-medium">
                    <span>Advance Credit Added:</span>
                    <span className="tabular-nums font-mono">+{formatCurrency(allocationPreview.excess)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-muted-foreground border-t border-border-warm pt-1">
                    <span>Remaining Due Now:</span>
                    <span className="tabular-nums font-mono font-semibold text-foreground">
                      {formatCurrency(allocationPreview.remainingDueAfter)}
                    </span>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Posting..." : "Confirm & Post"}
                </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* Contract Policies Modal */}
      <Dialog open={showPoliciesModal} onOpenChange={setShowPoliciesModal}>
        <DialogContent className="sm:max-w-lg bg-card p-0 gap-0 overflow-hidden text-xs border-border-warm shadow-lg">
          <DialogHeader className="px-5 py-4 border-b border-border-warm bg-muted/20">
            <DialogTitle className="font-bold text-sm text-foreground">
              Contract Policies &amp; Terms
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {ledger.client.fullName}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePolicies} className="p-5 space-y-4">
              <div className="text-xs text-muted-foreground">
                Configure penalty rates and post-maturity policies for this contract.
              </div>

              <div className="divide-y divide-border-warm border border-border-warm rounded-lg">
                <div className="p-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-foreground">Default Penalty</span>
                    <HelpTip
                      title="Default Penalty"
                      text="The extra percentage charged each month whenever a payment is overdue."
                    />
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      required
                      value={polPenaltyRate}
                      onChange={(e) => setPolPenaltyRate(Number(e.target.value))}
                      className="w-18 px-2 py-1 border border-border-warm rounded bg-card text-right font-mono font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-muted-foreground font-medium">% / mo</span>
                  </div>
                </div>

                <div className="p-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-foreground">12-Month Amnesty</span>
                    <HelpTip
                      title="12-Month Amnesty"
                      text="Gives the buyer 12 months with 0% penalty compounding after contract maturity, so they can catch up on principal."
                    />
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={polEnableAmnesty}
                      onChange={(e) => setPolEnableAmnesty(e.target.checked)}
                      className="rounded border-border-warm text-primary focus:ring-primary"
                    />
                  </label>
                </div>

                <div className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-semibold text-foreground">Lower Penalty After Maturity</span>
                      <HelpTip
                        title="Lower Post-Maturity Rate"
                        text="Charges a reduced penalty rate (typically 2.0%) after contract maturity. If amnesty is active, this starts once the amnesty expires."
                      />
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={polEnablePostMaturityRate}
                        onChange={(e) => setPolEnablePostMaturityRate(e.target.checked)}
                        className="rounded border-border-warm text-primary focus:ring-primary"
                      />
                    </label>
                  </div>
                  {polEnablePostMaturityRate && (
                    <div className="pl-3 border-l-2 border-border-warm flex items-center justify-between pt-1">
                      <span className="text-[11px] text-muted-foreground font-medium">Reduced rate:</span>
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          required
                          value={polPostMaturityRate}
                          onChange={(e) => setPolPostMaturityRate(Number(e.target.value))}
                          className="w-18 px-2 py-1 border border-border-warm rounded bg-card text-right font-mono font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <span className="text-muted-foreground font-medium">% / mo</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-muted/20 border border-border-warm rounded-lg p-3 text-xs space-y-1">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  How penalties will be applied:
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>During the contract period:</span>
                  <span className="font-mono font-semibold text-foreground">{polPenaltyRate.toFixed(1)}% / mo</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>First 12 months after maturity:</span>
                  <span className={`font-mono font-semibold ${polEnableAmnesty ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                    {polEnableAmnesty ? "0.0% (Amnesty active)" : `${polPenaltyRate.toFixed(1)}% / mo`}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>After month 12:</span>
                  <span className={`font-mono font-semibold ${polEnablePostMaturityRate ? "text-blue-700 dark:text-blue-300" : "text-foreground"}`}>
                    {polEnablePostMaturityRate ? `${polPostMaturityRate.toFixed(1)}% / mo (Reduced)` : `${polPenaltyRate.toFixed(1)}% / mo`}
                  </span>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPoliciesModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save Policies"}
                </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* Record Notice Modal */}
      <Dialog open={showRecordNoticeModal} onOpenChange={setShowRecordNoticeModal}>
        <DialogContent className="sm:max-w-md bg-card p-0 gap-0 overflow-hidden text-xs print:hidden border-border-warm shadow-lg">
          <DialogHeader className="px-5 py-3.5 border-b border-border-warm bg-muted/20">
            <DialogTitle className="font-bold text-sm text-foreground">
              Record &amp; Issue Notice
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {ledger.client.fullName} • {ledger.property.projectArea} Block {ledger.property.blockNumber} Lot {ledger.property.lotNumber}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleRecordNotice(false);
            }}
            className="p-5 space-y-4"
          >
            {/* Notice Type Radio Cards */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Notice Type
              </label>
              <div className="space-y-2">
                {[
                  {
                    stage: "first_notice" as const,
                    label: "1st Notice — Overdue Reminder",
                    subtitle: "Initial reminder requesting settlement of overdue installments",
                  },
                  {
                    stage: "second_notice" as const,
                    label: "2nd Notice — Formal Demand (15-Day)",
                    subtitle: "Formal demand letter setting a 15-day settlement deadline",
                  },
                  {
                    stage: "final_demand" as const,
                    label: "Final Demand — Notice of Cancellation (30-Day)",
                    subtitle: "Notarized notice under Section 8 of CTS and Maceda Law",
                  },
                ].map((choice) => {
                  const isSelected = recordNoticeStage === choice.stage;
                  return (
                    <div
                      key={choice.stage}
                      onClick={() => setRecordNoticeStage(choice.stage)}
                      className={cn(
                        "p-3 rounded-lg border text-xs cursor-pointer transition-colors flex items-start space-x-2.5",
                        isSelected
                          ? "bg-primary/10 border-primary ring-1 ring-primary"
                          : "bg-card border-border-warm hover:bg-muted/40 text-muted-foreground"
                      )}
                    >
                      <input
                        type="radio"
                        name="recordNoticeStage"
                        checked={isSelected}
                        onChange={() => setRecordNoticeStage(choice.stage)}
                        className="mt-0.5 text-primary focus:ring-primary"
                      />
                      <div className="space-y-0.5">
                        <div className={cn("font-semibold", isSelected ? "text-foreground" : "text-foreground/80")}>
                          {choice.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {choice.subtitle}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Service or Dispatch Date
                </label>
                <input
                  type="date"
                  required
                  value={recordNoticeDate}
                  onChange={(e) => setRecordNoticeDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-border-warm rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Courier Waybill or Tracking Number (optional)
                </label>
                <input
                  type="text"
                  value={recordNoticeTracking}
                  onChange={(e) => setRecordNoticeTracking(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-border-warm rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Collector Notes or Remarks (optional)
                </label>
                <input
                  type="text"
                  value={recordNoticeNotes}
                  onChange={(e) => setRecordNoticeNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-border-warm rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
              </div>
            </div>

            <div className="bg-muted/20 border border-border-warm rounded-lg p-3 text-xs space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground">
                The following amounts will be recorded on this notice:
              </div>
              <div className="flex justify-between text-muted-foreground pt-1">
                <span>Principal Arrears:</span>
                <span className="font-mono font-medium text-foreground">{formatCurrency(summary.arrearsPrincipal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Late Penalties Accrued:</span>
                <span className="font-mono font-medium text-destructive">{formatCurrency(summary.totalPenaltyDue)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-border-warm pt-1 text-foreground">
                <span>Total Amount Demanded:</span>
                <span className="font-mono">{formatCurrency(summary.totalPayableNow)}</span>
              </div>
            </div>

            <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowRecordNoticeModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <div className="flex items-center space-x-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="text-xs"
                >
                  {isSubmitting ? "Recording..." : "Save Record"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => void handleRecordNotice(true)}
                  className="text-xs"
                >
                  Save &amp; Print
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Notice Modal */}
      <Dialog open={showEditNoticeModal} onOpenChange={setShowEditNoticeModal}>
        <DialogContent className="sm:max-w-md bg-card p-0 gap-0 overflow-hidden text-xs print:hidden border-border-warm shadow-lg">
          <DialogHeader className="px-5 py-3.5 border-b border-border-warm bg-muted/20">
            <DialogTitle className="font-bold text-sm text-foreground">
              Edit Notice Record
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {ledger.client.fullName} • {ledger.property.projectArea} Block {ledger.property.blockNumber} Lot {ledger.property.lotNumber}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateNotice} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Notice Type
              </label>
              <div className="space-y-2">
                {[
                  {
                    stage: "first_notice" as const,
                    label: "1st Notice — Overdue Reminder",
                    subtitle: "Initial reminder requesting settlement of overdue installments",
                  },
                  {
                    stage: "second_notice" as const,
                    label: "2nd Notice — Formal Demand (15-Day)",
                    subtitle: "Formal demand letter setting a 15-day settlement deadline",
                  },
                  {
                    stage: "final_demand" as const,
                    label: "Final Demand — Notice of Cancellation (30-Day)",
                    subtitle: "Notarized notice under Section 8 of CTS and Maceda Law",
                  },
                ].map((choice) => {
                  const isSelected = editNoticeStage === choice.stage;
                  return (
                    <div
                      key={choice.stage}
                      onClick={() => setEditNoticeStage(choice.stage)}
                      className={cn(
                        "p-3 rounded-lg border text-xs cursor-pointer transition-colors flex items-start space-x-2.5",
                        isSelected
                          ? "bg-primary/10 border-primary ring-1 ring-primary"
                          : "bg-card border-border-warm hover:bg-muted/40 text-muted-foreground"
                      )}
                    >
                      <input
                        type="radio"
                        name="editNoticeStage"
                        checked={isSelected}
                        onChange={() => setEditNoticeStage(choice.stage)}
                        className="mt-0.5 text-primary focus:ring-primary"
                      />
                      <div className="space-y-0.5">
                        <div className={cn("font-semibold", isSelected ? "text-foreground" : "text-foreground/80")}>
                          {choice.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {choice.subtitle}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Service or Dispatch Date
                </label>
                <input
                  type="date"
                  required
                  value={editNoticeDate}
                  onChange={(e) => setEditNoticeDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-border-warm rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Courier Waybill or Tracking Number
                </label>
                <input
                  type="text"
                  value={editNoticeTracking}
                  onChange={(e) => setEditNoticeTracking(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-border-warm rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Collector Notes or Remarks
                </label>
                <input
                  type="text"
                  value={editNoticeNotes}
                  onChange={(e) => setEditNoticeNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-border-warm rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
              </div>
            </div>

            {editingNotice && (
              <div className="bg-muted/20 border border-border-warm rounded-lg p-3 text-xs space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">
                  Amounts recorded when this notice was issued:
                </div>
                <div className="flex justify-between text-muted-foreground pt-1">
                  <span>Principal Arrears:</span>
                  <span className="font-mono font-medium text-foreground">{formatCurrency(editingNotice.arrearsPrincipal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Late Penalties:</span>
                  <span className="font-mono font-medium text-destructive">{formatCurrency(editingNotice.penaltyDue)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-border-warm pt-1 text-foreground">
                  <span>Total Amount Demanded:</span>
                  <span className="font-mono">{formatCurrency(editingNotice.overdueAmount)}</span>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowEditNoticeModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Forfeit Account Modal */}
      <Dialog open={showForfeitModal} onOpenChange={setShowForfeitModal}>
        <DialogContent className="sm:max-w-md bg-card p-0 gap-0 overflow-hidden text-xs print:hidden border-border-warm shadow-lg">
          <DialogHeader className="px-5 py-3.5 border-b border-border-warm bg-destructive/10">
            <DialogTitle className="font-bold text-sm text-destructive flex items-center gap-1.5">
              <Ban className="w-4 h-4" />
              <span>Confirm Contract Forfeiture</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {ledger.client.fullName} • {ledger.property.projectArea} Block {ledger.property.blockNumber} Lot {ledger.property.lotNumber}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmForfeiture} className="p-5 space-y-4">
            <div className="text-xs text-muted-foreground leading-relaxed">
              This will forfeit the client&apos;s ownership on the property lot, cancel the Contract to Sell, record the final Notice of Forfeiture, and return the lot to company inventory.
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Date of Forfeiture
                </label>
                <input
                  type="date"
                  required
                  value={forfeitDate}
                  onChange={(e) => setForfeitDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-border-warm rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reason for Forfeiture
                </label>
                <input
                  type="text"
                  value={forfeitReason}
                  onChange={(e) => setForfeitReason(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-border-warm rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
              </div>
            </div>

            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-xs space-y-1">
              <div className="text-[11px] font-semibold text-destructive">
                Outstanding Balance at Forfeiture
              </div>
              <div className="flex justify-between text-muted-foreground pt-1">
                <span>Arrears:</span>
                <span className="font-mono font-medium text-foreground">{formatCurrency(summary.arrearsPrincipal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Penalties:</span>
                <span className="font-mono font-medium text-destructive">{formatCurrency(summary.totalPenaltyDue)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-destructive/20 pt-1 text-foreground">
                <span>Total Amount Demanded:</span>
                <span className="font-mono">{formatCurrency(summary.totalPayableNow)}</span>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowForfeitModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={isSubmitting}
                className="text-xs"
              >
                {isSubmitting ? "Forfeiting..." : "Confirm Forfeiture"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Printable Notice Document Preview Modal */}
      <Dialog open={showDocModal} onOpenChange={setShowDocModal}>
        <DialogContent className="sm:max-w-2xl bg-card p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col text-xs print:hidden border-border-warm shadow-lg">
          <DialogHeader className="px-5 py-3 border-b border-border-warm flex flex-row items-center justify-between space-y-0 bg-muted/20 pr-10">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <DialogTitle className="font-bold text-sm text-foreground">
                Notice Letter Document Preview
              </DialogTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                size="sm"
                onClick={handleDownloadNoticePdf}
                className="gap-1.5 h-8 text-xs bg-card hover:bg-muted text-foreground border border-border-warm shadow-2xs font-medium"
                title="Download formatted notice letter as PDF"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Save as PDF</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handlePrintNotice}
                className="gap-1.5 h-8 text-xs shadow-2xs"
                title="Print document in isolation"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Document</span>
              </Button>
            </div>
          </DialogHeader>

          <div id="notice-printable-sheet" className="p-0 bg-white overflow-y-auto flex-1">
            {renderNoticeDocument(selectedDocNotice)}
          </div>
        </DialogContent>
      </Dialog>

      {/* Statement of Account Preview & Print Modal */}
      <Dialog open={showSoaModal} onOpenChange={setShowSoaModal}>
        <DialogContent className="sm:max-w-5xl bg-card p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col text-xs print:hidden border-border-warm shadow-lg">
          <DialogHeader className="px-5 py-3 border-b border-border-warm flex flex-row items-center justify-between space-y-0 bg-muted/20 pr-10">
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <DialogTitle className="font-bold text-sm text-foreground">
                Statement of Account Preview — {ledger.client.fullName}
              </DialogTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                size="sm"
                onClick={() => exportLedgerToExcel(ledger, summary, asOfDate)}
                className="bg-emerald-600 text-white hover:bg-emerald-700 gap-1.5 h-8 text-xs shadow-2xs"
                title="Download spreadsheet in .xlsx format"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Download Excel (.xlsx)</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => downloadSoaPdf(ledger, summary, asOfDate)}
                className="gap-1.5 h-8 text-xs bg-card hover:bg-muted text-foreground border border-border-warm shadow-2xs font-medium"
                title="Download exact spreadsheet PDF"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Save as PDF</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  printElement(
                    "soa-printable-sheet",
                    `Statement of Account — ${ledger.client.fullName}`
                  )
                }
                className="gap-1.5 h-8 text-xs shadow-2xs"
                title="Print statement"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Statement</span>
              </Button>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-8 bg-muted/20 flex-1 overflow-y-auto">
            <div id="soa-printable-sheet" className="bg-white rounded-lg shadow-md border border-border-warm overflow-hidden">
              <ExcelSoaDocument
                ledger={ledger}
                summary={summary}
                asOfDate={asOfDate}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Billing Clearance Modal */}
      <Dialog open={showClearanceModal} onOpenChange={setShowClearanceModal}>
        <DialogContent className="sm:max-w-md bg-card p-0 gap-0 overflow-hidden text-xs border-border-warm shadow-lg">
          <DialogHeader className="px-5 py-3.5 border-b border-border-warm bg-muted/20">
            <div className="flex items-center space-x-2">
              {ledger.clearedAt ? (
                <Undo2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              ) : (
                <Scale className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              )}
              <DialogTitle className="font-bold text-sm text-foreground">
                {ledger.clearedAt ? "Undo Billing Clearance" : "Attest Billing Clearance"}
              </DialogTitle>
            </div>
            <DialogDescription className="sr-only">
              {ledger.clearedAt ? "Revert account to uncleared state" : "Certify financial completion and forward to Legal"}
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div className="bg-muted/20 rounded-lg p-3 border border-border-warm space-y-1">
              <div className="text-xs font-semibold text-foreground">
                {ledger.client.fullName}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {ledger.property.projectArea} • Block {ledger.property.blockNumber} Lot {ledger.property.lotNumber}
              </div>
              <div className="text-[11px] font-mono mt-1 pt-1 border-t border-border-warm flex justify-between">
                <span className="text-muted-foreground">Contract Balance:</span>
                <span className="font-semibold text-foreground">{formatCurrency(summary.tspOutstandingBalance)}</span>
              </div>
            </div>

            {ledger.clearedAt ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground text-xs">
                  Revert account to uncleared state?
                </p>
                <p className="text-[11px] leading-relaxed">
                  This will reset clearance and restore the property lot status to <strong>Reserved</strong>. This reversal is only permitted if Legal has not yet begun processing the land title record.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3.5 text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground text-xs">
                  Certify financial completion &amp; forward to Legal:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                  <li>Attests that the client has satisfied financial obligations for this property.</li>
                  <li>Advances the property lot status to <strong>Sold</strong>.</li>
                  <li>Releases the account directly into Legal&apos;s title turnover queue (<code className="font-mono text-foreground">/dashboard/legal</code>).</li>
                  <li>Logs your staff identity as the official clearance certifier.</li>
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="px-5 py-3.5 border-t border-border-warm bg-muted/20 gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowClearanceModal(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmClearance}
              disabled={isSubmitting}
              className={
                ledger.clearedAt
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }
            >
              {ledger.clearedAt ? (
                <>
                  <Undo2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>{isSubmitting ? "Reverting..." : "Confirm Reversal"}</span>
                </>
              ) : (
                <>
                  <Scale className="w-3.5 h-3.5 mr-1.5" />
                  <span>{isSubmitting ? "Certifying..." : "Confirm Clearance"}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BillingLedgerDetailView;
