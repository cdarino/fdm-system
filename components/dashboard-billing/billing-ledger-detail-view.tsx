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
  Clock,
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
  Eye,
  Ban,
  Scale,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

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
  const [asOfDate, setAsOfDate] = useState<string>(
    () => initialAsOfDate || new Date().toISOString().split("T")[0]
  );

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

  const [showStepUpModal, setShowStepUpModal] = useState(false);
  const [stepUpDate, setStepUpDate] = useState(asOfDate);
  const [stepUpTracking, setStepUpTracking] = useState("");
  const [stepUpNotes, setStepUpNotes] = useState("");
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

  const currentStageIndex = useMemo(() => {
    const idx = NOTICE_STAGES.findIndex((s) => s.stage === currentNoticeStage);
    return idx === -1 ? 0 : idx;
  }, [currentNoticeStage]);

  const currentStageConfig = NOTICE_STAGES[currentStageIndex];

  const isCurrentStageLogged = useMemo(() => {
    return noticeHistory.some((h) => h.stage === currentNoticeStage);
  }, [noticeHistory, currentNoticeStage]);

  const handleOpenDocModal = (notice?: OverdueNoticeEvent) => {
    setSelectedDocNotice(notice || null);
    setShowDocModal(true);
  };

  const handleOpenStepUpModal = () => {
    setStepUpDate(asOfDate);
    setStepUpTracking("");
    setStepUpNotes("");
    setShowStepUpModal(true);
  };

  const handleConfirmStepUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let targetStageConfig = currentStageConfig;
      if (isCurrentStageLogged && currentStageIndex < NOTICE_STAGES.length - 1) {
        targetStageConfig = NOTICE_STAGES[currentStageIndex + 1];
      }

      // If advancing to forfeiture stage, call forfeit action to execute property forfeiture
      if (targetStageConfig.stage === "forfeited") {
        const forfeitRes = await forfeitBillingAccount({
          accountId: ledger.id,
          reason: stepUpNotes.trim() || "Unsettled contract arrears following final demand",
          forfeitedAt: stepUpDate || asOfDate,
        });

        if (!forfeitRes.success) {
          toast.error(forfeitRes.error || "Failed to forfeit contract");
          return;
        }

        const newNotice: OverdueNoticeEvent = {
          id: `notif-${Date.now()}`,
          stage: "forfeited",
          noticeNumber: 4,
          date: stepUpDate || asOfDate,
          title: targetStageConfig.docTitle,
          trackingNo: stepUpTracking.trim() || undefined,
          notes: stepUpNotes.trim() || undefined,
          overdueAmount: summary.totalPayableNow,
          arrearsPrincipal: summary.arrearsPrincipal,
          penaltyDue: summary.totalPenaltyDue,
        };

        setLedger((prev) => ({
          ...prev,
          status: "Forfeited",
          overdueEscalation: {
            currentStage: "forfeited",
            history: [newNotice, ...(prev.overdueEscalation?.history || [])],
          },
        }));

        setShowStepUpModal(false);
        toast.success("Contract cancelled and property ownership forfeited");
        router.refresh();
        return;
      }

      const noticeRes = await recordBillingNotice({
        accountId: ledger.id,
        stage: targetStageConfig.stage,
        noticeNumber: targetStageConfig.num,
        noticeDate: stepUpDate || asOfDate,
        title: targetStageConfig.docTitle,
        trackingNumber: stepUpTracking.trim() || undefined,
        notes: stepUpNotes.trim() || undefined,
        overdueAmount: summary.totalPayableNow,
        arrearsPrincipal: summary.arrearsPrincipal,
        penaltyDue: summary.totalPenaltyDue,
      });

      if (!noticeRes.success) {
        toast.error(noticeRes.error || "Failed to record notice");
        return;
      }

      const newNotice: OverdueNoticeEvent = {
        id: noticeRes.data.noticeId,
        stage: targetStageConfig.stage,
        noticeNumber: targetStageConfig.num,
        date: stepUpDate || asOfDate,
        title: targetStageConfig.docTitle,
        trackingNo: stepUpTracking.trim() || undefined,
        notes: stepUpNotes.trim() || undefined,
        overdueAmount: summary.totalPayableNow,
        arrearsPrincipal: summary.arrearsPrincipal,
        penaltyDue: summary.totalPenaltyDue,
      };

      setLedger((prev) => ({
        ...prev,
        overdueEscalation: {
          currentStage: targetStageConfig.stage,
          history: [newNotice, ...(prev.overdueEscalation?.history || [])],
        },
      }));

      setShowStepUpModal(false);
      toast.success(`${targetStageConfig.label} recorded successfully`);
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
            <span className="text-[10px] text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted border border-border font-medium">
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

  const renderChronologyTimeline = (history: OverdueNoticeEvent[], isReadOnly: boolean) => {
    if (history.length === 0) {
      return (
        <div className="py-6 text-center text-muted-foreground text-xs">
          No notice events logged yet.
        </div>
      );
    }

    return (
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border text-xs">
        {history.map((ev, idx) => {
          const isLatest = idx === 0;
          return (
            <div key={ev.id} className="relative">
              <div
                className={`absolute -left-6 top-1 w-3 h-3 rounded-full border-2 border-background shadow-xs ${
                  ev.stage === "forfeited"
                    ? "bg-foreground"
                    : ev.stage === "final_demand"
                    ? "bg-destructive"
                    : ev.stage === "second_notice"
                    ? "bg-amber-500"
                    : "bg-blue-600"
                }`}
              />

              <div className="bg-muted/40 border border-border rounded-lg p-3 space-y-1.5 hover:bg-muted/70 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-foreground">{ev.title}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-background border border-border text-foreground">
                      Stage {ev.noticeNumber}
                    </span>
                    {isLatest && !isReadOnly && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] text-muted-foreground">
                    <span>{formatDate(ev.date)}</span>
                    <button
                      type="button"
                      onClick={() => handleOpenDocModal(ev)}
                      className="px-2 py-0.5 bg-background border border-border rounded text-foreground hover:bg-muted transition-colors flex items-center space-x-1"
                    >
                      <Eye className="w-3 h-3 mr-1 text-muted-foreground" />
                      <span>View Letter</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
                  <div>
                    <span>Demanded:</span>{" "}
                    <span className="font-mono font-semibold text-foreground">{formatCurrency(ev.overdueAmount)}</span>
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
                      <span>Ref:</span>{" "}
                      <span className="font-mono font-medium text-foreground">{ev.trackingNo}</span>
                    </div>
                  )}
                </div>

                {ev.notes && (
                  <div className="text-[11px] text-muted-foreground italic border-t border-border/60 pt-1">
                    “{ev.notes}”
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
              className="px-2.5 py-1.5 text-xs font-medium border border-border rounded-lg bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center space-x-1 shadow-2xs"
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
            className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-card text-foreground hover:bg-muted transition-colors flex items-center space-x-1 shadow-2xs"
            title="Download editable Excel (.xlsx) matching official statement format"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            <span>Download Excel</span>
          </button>
          <button
            onClick={() => setShowSoaModal(true)}
            className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-card text-foreground hover:bg-muted transition-colors flex items-center space-x-1 shadow-2xs"
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
          className={`p-4 rounded-xl border flex flex-col justify-between shadow-2xs ${
            summary.status === "overdue"
              ? "bg-destructive/5 border-destructive/20"
              : summary.status === "due_soon"
              ? "bg-amber-500/5 border-amber-500/20"
              : "bg-card border-border"
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

          <div className="mt-3 pt-2.5 border-t border-border text-xs text-muted-foreground space-y-1">
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
              <div className="pt-1 text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50">
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
          className="bg-card p-4 rounded-xl border border-border flex flex-col justify-between cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group shadow-2xs"
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

          <div className="mt-3 pt-2.5 border-t border-border text-xs">
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

            <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-xs">
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
        <div className="bg-card p-4 rounded-xl border border-border flex flex-col justify-between shadow-2xs">
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

          <div className="mt-3 pt-2.5 border-t border-border text-xs text-muted-foreground">
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
              <div className="mt-2 pt-1 border-t border-border text-[11px] text-muted-foreground flex justify-between">
                <span>Cycle Due Date:</span>
                <span className="font-medium text-foreground">{formatDate(summary.currentTermDueDate)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Bar & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border gap-2 print:hidden">
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
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-2xs print:hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 px-3 w-20">Term</th>
                  <th className="py-2.5 px-3 w-28">Date</th>
                  <th className="py-2.5 px-3">Particulars</th>
                  <th className="py-2.5 px-3 text-right">Change</th>
                  <th className="py-2.5 px-3 text-right bg-muted/30 border-l border-border">
                    Running Due
                  </th>
                  <th className="py-2.5 px-3 text-right border-l border-border">
                    Contract Bal
                  </th>
                  <th className="py-2.5 px-2 w-8 print:hidden"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
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
                      <td className="py-2.5 px-3 text-right tabular-nums bg-muted/15 border-l border-border align-top">
                        {renderRunningDueCell(row)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-mono font-semibold text-foreground border-l border-border align-top">
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
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-2xs print:hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
              <tbody className="divide-y divide-border">
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
        <div className="space-y-6 print:hidden">
          {summary.status !== "overdue" && ledger.status !== "Forfeited" ? (
            <div className="bg-card rounded-xl border border-border p-6 text-center space-y-4 shadow-2xs">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground text-sm">Account in Good Standing</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  All installments are up to date. No notice or legal escalation actions required.
                </p>
              </div>

              {noticeHistory.length > 0 && (
                <div className="pt-6 border-t border-border text-left">
                  <div className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-3 flex items-center justify-between">
                    <span>Past Notice History (Read-Only)</span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {noticeHistory.length} notice{noticeHistory.length === 1 ? "" : "s"} served previously
                    </span>
                  </div>
                  {renderChronologyTimeline(noticeHistory, true)}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overdue / Forfeiture Action Banner */}
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs shadow-2xs">
                <div className="flex items-start space-x-3">
                  {ledger.status === "Forfeited" ? (
                    <Ban className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold text-destructive">
                      {ledger.status === "Forfeited"
                        ? "Account Forfeited — Contract Rescinded"
                        : `Delinquent Account — Active Stage: ${currentStageConfig.label}`}
                    </div>
                    <div className="text-destructive/90 mt-0.5">
                      {ledger.status === "Forfeited" ? (
                        <span>Ownership on lot has been rescinded and forfeited per CTS Section 8 and Maceda Law.</span>
                      ) : (
                        <span>
                          Account is {summary.monthsOverdue} month{summary.monthsOverdue > 1 ? "s" : ""} overdue with{" "}
                          <span className="font-mono font-bold">{formatCurrency(summary.totalPayableNow)}</span> payable now (Arrears: {formatCurrency(summary.arrearsPrincipal)} + Penalties: {formatCurrency(summary.totalPenaltyDue)}).
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleOpenDocModal()}
                    className="px-3 py-1.5 bg-background border border-destructive/30 rounded-lg text-destructive hover:bg-destructive/10 font-medium transition-colors flex items-center space-x-1"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    <span>Print Letter</span>
                  </button>
                  {currentStageIndex < NOTICE_STAGES.length - 1 && ledger.status !== "Forfeited" && (
                    <button
                      onClick={handleOpenStepUpModal}
                      className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 font-medium transition-colors flex items-center space-x-1 shadow-2xs"
                    >
                      <span>
                        {isCurrentStageLogged
                          ? NOTICE_STAGES[currentStageIndex + 1]?.stage === "forfeited"
                            ? "Forfeit Contract & Reclaim Lot"
                            : `Advance to ${NOTICE_STAGES[currentStageIndex + 1].label}`
                          : `Log ${currentStageConfig.label} Served`}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  )}
                </div>
              </div>

              {/* 4-Stage Notice Progression Stepper */}
              <div className="bg-card rounded-xl border border-border p-4 shadow-2xs">
                <div className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-3">
                  Notice &amp; Forfeiture Stages
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {NOTICE_STAGES.map((s, idx) => {
                    const isCompleted = idx < currentStageIndex || (idx === 3 && ledger.status === "Forfeited");
                    const isCurrent = idx === currentStageIndex && ledger.status !== "Forfeited";
                    return (
                      <div
                        key={s.stage}
                        className={`p-3 rounded-lg border text-xs transition-colors ${
                          isCurrent
                            ? "bg-destructive/5 border-destructive/30 ring-1 ring-destructive/30"
                            : isCompleted
                            ? "bg-muted/40 border-border text-foreground"
                            : "bg-card border-border/70 text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isCurrent
                                ? "bg-destructive text-destructive-foreground"
                                : isCompleted
                                ? "bg-foreground text-background"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isCompleted ? "✓" : s.num}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                              Active
                            </span>
                          )}
                          {isCompleted && (
                            <span className="text-[10px] text-muted-foreground">Served</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`font-semibold text-xs ${isCurrent ? "text-foreground" : isCompleted ? "text-foreground/90" : "text-muted-foreground"}`}>
                            {s.label}
                          </span>
                          <HelpTip title={s.label} text={s.shortDesc} />
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {s.subtitle}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chronology of Events */}
              <div className="bg-card rounded-xl border border-border p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                  <div className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                    Chronology of Notice Events
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {noticeHistory.length} event{noticeHistory.length === 1 ? "" : "s"} logged
                  </span>
                </div>
                {renderChronologyTimeline(noticeHistory, false)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Post Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-lg bg-card print:hidden">
          <DialogHeader className="border-b border-border pb-3">
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
                    className="px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground text-xs transition-colors font-medium border border-border"
                  >
                    Pay Due Now: <span className="font-mono">{formatCurrency(summary.totalPayableNow)}</span>
                  </button>
                )}
                {summary.currentTermBalance > 0 && summary.currentTermBalance !== summary.totalPayableNow && (
                  <button
                    type="button"
                    onClick={() => setPayAmount(summary.currentTermBalance)}
                    className="px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground text-xs transition-colors font-medium border border-border"
                  >
                    Current Term Only: <span className="font-mono">{formatCurrency(summary.currentTermBalance)}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPayAmount(ledger.monthlyAmortization)}
                  className="px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground text-xs transition-colors font-medium border border-border"
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
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary uppercase"
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
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase font-medium text-muted-foreground mb-1">
                    Method
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as "cash" | "check" | "bank_transfer")}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                  className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {summary.totalPenaltyDue > 0 && (
                <div className="bg-muted/40 border border-border rounded-lg p-3">
                  <label className="flex items-start space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={waivePenalty}
                      onChange={(e) => setWaivePenalty(e.target.checked)}
                      className="mt-0.5 rounded border-border text-primary focus:ring-primary"
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

              <div className="bg-muted/40 border border-border rounded-lg p-3 space-y-1.5">
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
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium border-t border-border pt-1">
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
                  <div className="flex justify-between text-muted-foreground border-t border-border pt-1">
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
        <DialogContent className="sm:max-w-lg bg-card p-0 gap-0 overflow-hidden text-xs">
          <DialogHeader className="px-5 py-4 border-b border-border bg-muted/40">
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

              <div className="divide-y divide-border border border-border rounded-lg">
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
                      className="w-18 px-2 py-1 border border-border rounded bg-background text-right font-mono font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                      className="rounded border-border text-primary focus:ring-primary"
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
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                    </label>
                  </div>
                  {polEnablePostMaturityRate && (
                    <div className="pl-3 border-l-2 border-border flex items-center justify-between pt-1">
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
                          className="w-18 px-2 py-1 border border-border rounded bg-background text-right font-mono font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <span className="text-muted-foreground font-medium">% / mo</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-muted/40 border border-border rounded-lg p-3 text-xs space-y-1">
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

      {/* Advance Stage Modal */}
      <Dialog open={showStepUpModal} onOpenChange={setShowStepUpModal}>
        <DialogContent className="sm:max-w-md bg-card p-0 gap-0 overflow-hidden text-xs print:hidden">
          <DialogHeader className="px-5 py-3.5 border-b border-border bg-muted/40">
            <DialogTitle className="font-bold text-sm text-foreground">
              {isCurrentStageLogged
                ? NOTICE_STAGES[currentStageIndex + 1]?.stage === "forfeited"
                  ? "Confirm Contract Forfeiture"
                  : `Advance to ${NOTICE_STAGES[currentStageIndex + 1]?.label}`
                : `Log ${currentStageConfig.label} as Served`}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {ledger.client.fullName}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmStepUp} className="p-5 space-y-4">
              <div className="text-xs text-muted-foreground">
                {isCurrentStageLogged && NOTICE_STAGES[currentStageIndex + 1]?.stage === "forfeited"
                  ? "This will forfeit the client's ownership on the property lot, cancel the contract to sell, and record the final Notice of Forfeiture."
                  : isCurrentStageLogged
                  ? `Log service and step up to ${NOTICE_STAGES[currentStageIndex + 1]?.label}.`
                  : `Log service of ${currentStageConfig.label}.`}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] uppercase font-semibold text-muted-foreground mb-1">
                    Date Served / Issued
                  </label>
                  <input
                    type="date"
                    required
                    value={stepUpDate}
                    onChange={(e) => setStepUpDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase font-semibold text-muted-foreground mb-1">
                    Registered Mail / Tracking Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. REG-2026-0842 or Hand-Delivered"
                    value={stepUpTracking}
                    onChange={(e) => setStepUpTracking(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase font-semibold text-muted-foreground mb-1">
                    Remarks / Collector Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sent via registered mail with return card"
                    value={stepUpNotes}
                    onChange={(e) => setStepUpNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="bg-muted/40 border border-border rounded-lg p-3 text-xs space-y-1">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  Obligation at Time of Notice
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Arrears:</span>
                  <span className="font-mono font-medium text-foreground">{formatCurrency(summary.arrearsPrincipal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Penalties:</span>
                  <span className="font-mono font-medium text-destructive">{formatCurrency(summary.totalPenaltyDue)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-border pt-1 text-foreground">
                  <span>Total Amount Demanded:</span>
                  <span className="font-mono">{formatCurrency(summary.totalPayableNow)}</span>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStepUpModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Recording..." : "Confirm & Record"}
                </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* Printable Notice Document Preview Modal */}
      <Dialog open={showDocModal} onOpenChange={setShowDocModal}>
        <DialogContent className="sm:max-w-2xl bg-card p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col text-xs print:hidden">
          <DialogHeader className="px-5 py-3 border-b border-border flex flex-row items-center justify-between space-y-0 bg-muted/40 pr-10">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <DialogTitle className="font-bold text-sm text-foreground">
                Notice Letter Document Preview
              </DialogTitle>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5 h-8 text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Document</span>
            </Button>
          </DialogHeader>

          <div id="notice-printable-sheet" className="p-0 bg-white overflow-y-auto flex-1">
            {renderNoticeDocument(selectedDocNotice)}
          </div>
        </DialogContent>
      </Dialog>

      {/* Statement of Account Preview & Print Modal */}
      <Dialog open={showSoaModal} onOpenChange={setShowSoaModal}>
        <DialogContent className="sm:max-w-5xl bg-card p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col text-xs print:hidden">
          <DialogHeader className="px-5 py-3 border-b border-border flex flex-row items-center justify-between space-y-0 bg-muted/40 pr-10">
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
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Download Excel (.xlsx)</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5 h-8 text-xs shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save PDF</span>
              </Button>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-8 bg-muted/20 flex-1 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-md border border-border overflow-hidden">
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
        <DialogContent className="sm:max-w-md bg-card p-0 gap-0 overflow-hidden text-xs">
          <DialogHeader className="px-5 py-3.5 border-b border-border bg-muted/40">
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
            <div className="bg-muted/40 rounded-lg p-3 border border-border space-y-1">
              <div className="text-xs font-semibold text-foreground">
                {ledger.client.fullName}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {ledger.property.projectArea} • Block {ledger.property.blockNumber} Lot {ledger.property.lotNumber}
              </div>
              <div className="text-[11px] font-mono mt-1 pt-1 border-t border-border flex justify-between">
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

          <DialogFooter className="px-5 py-3.5 border-t border-border bg-muted/20 gap-2 sm:gap-2">
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
