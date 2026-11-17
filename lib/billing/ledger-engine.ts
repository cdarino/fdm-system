import {
  Ledger,
  LedgerJournalRow,
  LedgerStatus,
  LedgerSummary,
  PaymentRecord,
} from "@/lib/types/billing";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function addMonthsToDate(dateStr: string, monthsToAdd: number, targetDay?: number): string {
  if (!dateStr) return "2026-01-01";
  const [year, month, day] = dateStr.split("-").map(Number);
  const targetDate = new Date(year, (month || 1) - 1 + monthsToAdd, 1);
  const maxDay = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
  const finalDay = Math.min(targetDay || day || 1, maxDay);
  targetDate.setDate(finalDay);

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, "0");
  const d = String(targetDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysToDate(dateStr: string, days: number): string {
  if (!dateStr) return "2026-01-01";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, "0");
  const nd = String(dt.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

export function getScheduledInstallments(ledger: Ledger) {
  const principalToFinance = Math.max(0, ledger.contractPrice - ledger.downpayment);
  const baseMonthly = Math.floor((principalToFinance / ledger.termMonths) * 100) / 100;
  const remainder = Math.round((principalToFinance - baseMonthly * ledger.termMonths) * 100) / 100;

  const list: { instNo: number; dueDate: string; monthlyDue: number }[] = [];
  for (let i = 1; i <= ledger.termMonths; i++) {
    const monthlyDue = i === ledger.termMonths ? +(baseMonthly + remainder).toFixed(2) : baseMonthly;
    const dueDate = addMonthsToDate(ledger.firstDueDate, i - 1, ledger.dueDay);
    list.push({ instNo: i, dueDate, monthlyDue });
  }
  return list;
}

interface TimelineEvent {
  sortDate: string;
  priority: number;
  displayDate: string;
  type: "downpayment_due" | "installment_due" | "penalty_check" | "payment";
  instLabel: string;
  amount: number;
  payment?: PaymentRecord;
  mOffset?: number;
}

export function evaluateLedger(ledger: Ledger, asOfDateStr: string): LedgerSummary {
  const scheduled = getScheduledInstallments(ledger);
  const pastInstallments = scheduled.filter((s) => s.dueDate <= asOfDateStr);
  const nextUpcoming = scheduled.find((s) => s.dueDate > asOfDateStr);

  const totalPaymentsRaw = ledger.payments
    .filter((p) => p.date <= asOfDateStr)
    .reduce((acc, p) => acc + p.amount, 0);

  const events: TimelineEvent[] = [];

  if (ledger.downpayment > 0) {
    events.push({
      sortDate: ledger.createdAt,
      priority: 0,
      displayDate: ledger.createdAt,
      type: "downpayment_due",
      instLabel: "DP / Res",
      amount: ledger.downpayment,
    });
  }

  for (let i = 0; i < pastInstallments.length; i++) {
    const inst = pastInstallments[i];
    const prevDue = i > 0 ? pastInstallments[i - 1].dueDate : undefined;
    let cycleOpen = prevDue
      ? addDaysToDate(prevDue, 2)
      : inst.dueDate > ledger.createdAt
      ? addDaysToDate(ledger.createdAt, 1)
      : ledger.createdAt;
    if (cycleOpen > inst.dueDate) cycleOpen = inst.dueDate;

    events.push({
      sortDate: cycleOpen,
      priority: cycleOpen === ledger.createdAt ? 3 : 1,
      displayDate: inst.dueDate,
      type: "installment_due",
      instLabel: String(inst.instNo),
      amount: inst.monthlyDue,
    });

    const penaltyCheckDate = addDaysToDate(inst.dueDate, 1);
    if (penaltyCheckDate <= asOfDateStr) {
      events.push({
        sortDate: penaltyCheckDate,
        priority: 1,
        displayDate: penaltyCheckDate,
        type: "penalty_check",
        instLabel: String(inst.instNo),
        amount: 0,
      });
    }
  }

  const lastScheduled = scheduled[scheduled.length - 1];
  if (lastScheduled && asOfDateStr > lastScheduled.dueDate) {
    let mOffset = 1;
    while (mOffset <= 120) {
      const checkDate = addDaysToDate(addMonthsToDate(lastScheduled.dueDate, mOffset, ledger.dueDay), 1);
      if (checkDate > asOfDateStr) break;
      events.push({
        sortDate: checkDate,
        priority: 1,
        displayDate: checkDate,
        type: "penalty_check",
        instLabel: "Mature",
        amount: 0,
        mOffset,
      });
      mOffset++;
    }
  }

  const isWaitingForDp =
    ledger.downpayment > 0 &&
    totalPaymentsRaw < ledger.downpayment &&
    asOfDateStr < ledger.firstDueDate;

  if (nextUpcoming && totalPaymentsRaw < ledger.contractPrice && !isWaitingForDp) {
    const prevCycleDue = pastInstallments[pastInstallments.length - 1]?.dueDate;
    let cycleOpenDate = prevCycleDue
      ? addDaysToDate(prevCycleDue, 2)
      : ledger.firstDueDate > ledger.createdAt
      ? addDaysToDate(ledger.createdAt, 1)
      : ledger.createdAt;
    if (cycleOpenDate > asOfDateStr) cycleOpenDate = asOfDateStr;

    events.push({
      sortDate: cycleOpenDate,
      priority: cycleOpenDate === ledger.createdAt ? 3 : 1,
      displayDate: nextUpcoming.dueDate,
      type: "installment_due",
      instLabel: String(nextUpcoming.instNo),
      amount: nextUpcoming.monthlyDue,
    });
  }

  for (const p of ledger.payments) {
    if (p.date <= asOfDateStr) {
      events.push({
        sortDate: p.date,
        priority: 2,
        displayDate: p.date,
        type: "payment",
        instLabel: "",
        amount: p.amount,
        payment: p,
      });
    }
  }

  events.sort((a, b) => {
    const cmp = a.sortDate.localeCompare(b.sortDate);
    if (cmp !== 0) return cmp;
    return a.priority - b.priority;
  });

  let tspBalance = ledger.contractPrice;
  let currentDueBalance = 0;
  let advanceCredit = 0;
  let penaltyBalance = 0;
  let totalPenaltyPaid = 0;
  let totalPenaltyWaived = 0;
  let totalCollected = 0;
  let totalPrincipalPaid = 0;
  // Downpayment is open for settlement until the first installment due date
  let totalBilledMaturedPrincipal =
    ledger.downpayment > 0 && asOfDateStr > ledger.firstDueDate
      ? ledger.downpayment
      : 0;
  let totalBilledOpenPrincipal = ledger.downpayment;

  for (const inst of pastInstallments) {
    if (inst.dueDate < asOfDateStr) {
      totalBilledMaturedPrincipal += inst.monthlyDue;
    }
    totalBilledOpenPrincipal += inst.monthlyDue;
  }

  const journal: LedgerJournalRow[] = [
    {
      id: "opening-tsp",
      rowType: "opening",
      date: ledger.createdAt,
      instLabel: "TSP",
      description: "Total Selling Price",
      penaltyBalance: 0,
      currentDueBalance: 0,
      advanceCredit: 0,
      tspBalance: ledger.contractPrice,
    },
  ];

  let latestBilledLabel = ledger.downpayment > 0 ? "DP / Res" : "1";
  let currentTermAdded = false;

  for (let idx = 0; idx < events.length; idx++) {
    const ev = events[idx];

    if (ev.type === "downpayment_due") {
      latestBilledLabel = ev.instLabel;
      currentDueBalance = +(currentDueBalance + ev.amount).toFixed(2);
      journal.push({
        id: `dp-due-${idx}`,
        rowType: "downpayment_due",
        date: ev.displayDate,
        instLabel: ev.instLabel,
        description: "Reservation / Downpayment Due",
        monthlyDue: ev.amount,
        penaltyBalance,
        currentDueBalance,
        advanceCredit,
        tspBalance,
      });
    } else if (ev.type === "installment_due") {
      const isNextTerm = nextUpcoming && ev.instLabel === String(nextUpcoming.instNo);
      if (isNextTerm) {
        if (tspBalance <= 0) continue;
        totalBilledOpenPrincipal += ev.amount;
        currentTermAdded = true;
      }

      latestBilledLabel = ev.instLabel;
      if (advanceCredit > 0) {
        const offset = Math.min(advanceCredit, ev.amount);
        advanceCredit = +(advanceCredit - offset).toFixed(2);
        currentDueBalance = +(currentDueBalance + ev.amount - offset).toFixed(2);
      } else {
        currentDueBalance = +(currentDueBalance + ev.amount).toFixed(2);
      }

      journal.push({
        id: `inst-due-${ev.instLabel}-${idx}`,
        rowType: "installment_due",
        date: ev.displayDate,
        instLabel: ev.instLabel,
        description: isNextTerm ? `Installment #${ev.instLabel} (Current Term)` : `Installment #${ev.instLabel} Due`,
        monthlyDue: ev.amount,
        penaltyBalance,
        currentDueBalance,
        advanceCredit,
        tspBalance,
      });
    } else if (ev.type === "penalty_check") {
      if (currentDueBalance > 0) {
        let effectiveRate = ledger.penaltyRate || 0.035;
        let isAmnesty = false;

        if (ev.instLabel === "Mature") {
          const mOffset = ev.mOffset ?? 1;
          const amnestyMonths = ledger.policies?.amnestyMonths ?? 12;
          if (ledger.policies?.enableMaturityAmnesty && mOffset <= amnestyMonths) {
            effectiveRate = 0;
            isAmnesty = true;
          } else if (ledger.policies?.enablePostMaturityReducedRate) {
            effectiveRate = ledger.policies.postMaturityPenaltyRate ?? 0.02;
          }
        }

        if (!isAmnesty && effectiveRate > 0) {
          const penaltyAmt = +(currentDueBalance * effectiveRate).toFixed(2);
          penaltyBalance = +(penaltyBalance + penaltyAmt).toFixed(2);
          journal.push({
            id: `penalty-${ev.instLabel}-${idx}`,
            rowType: "penalty_charge",
            date: ev.displayDate,
            instLabel: ev.instLabel,
            description: ev.instLabel === "Mature"
              ? `${(effectiveRate * 100).toFixed(1)}% Post-Maturity Penalty`
              : `${(effectiveRate * 100).toFixed(1)}% Late Penalty`,
            penaltyCharged: penaltyAmt,
            penaltyBase: currentDueBalance,
            penaltyBalance,
            currentDueBalance,
            advanceCredit,
            tspBalance,
          });
        }
      }
    } else if (ev.type === "payment" && ev.payment) {
      const p = ev.payment;
      let remaining = p.amount;
      let penaltyPaid = 0;
      let penaltyWaived = 0;

      if (p.waivePenalty && penaltyBalance > 0) {
        penaltyWaived = penaltyBalance;
        totalPenaltyWaived = +(totalPenaltyWaived + penaltyWaived).toFixed(2);
        penaltyBalance = 0;
      } else if (penaltyBalance > 0) {
        penaltyPaid = Math.min(remaining, penaltyBalance);
        penaltyBalance = +(penaltyBalance - penaltyPaid).toFixed(2);
        totalPenaltyPaid = +(totalPenaltyPaid + penaltyPaid).toFixed(2);
        remaining = +(remaining - penaltyPaid).toFixed(2);
      }

      const principalPaid = Math.min(remaining, tspBalance);
      totalPrincipalPaid = +(totalPrincipalPaid + principalPaid).toFixed(2);
      totalCollected = +(totalCollected + p.amount).toFixed(2);
      tspBalance = Math.max(0, +(tspBalance - principalPaid).toFixed(2));

      if (principalPaid <= currentDueBalance) {
        currentDueBalance = +(currentDueBalance - principalPaid).toFixed(2);
      } else {
        const excess = +(principalPaid - currentDueBalance).toFixed(2);
        currentDueBalance = 0;
        advanceCredit = +(advanceCredit + excess).toFixed(2);
      }

      journal.push({
        id: `pay-${p.id}`,
        rowType: "payment",
        date: ev.displayDate,
        instLabel: latestBilledLabel,
        description: p.waivePenalty ? "Payment Applied (Penalty Waived)" : "Payment Applied",
        amountPaid: p.amount,
        penaltyPaid: +penaltyPaid.toFixed(2),
        principalPaid: +principalPaid.toFixed(2),
        penaltyWaived: +penaltyWaived.toFixed(2),
        penaltyBalance,
        currentDueBalance,
        advanceCredit,
        tspBalance,
        receiptNo: p.receiptNo,
        method: p.method,
        notes: p.notes,
        paymentId: p.id,
      });
    }
  }

  const arrearsPrincipal = Math.max(0, +(totalBilledMaturedPrincipal - totalPrincipalPaid).toFixed(2));
  const installmentDueBalance = currentDueBalance;
  const currentTermBalance = Math.max(0, +(installmentDueBalance - arrearsPrincipal).toFixed(2));
  const totalPayableNow = +(installmentDueBalance + penaltyBalance).toFixed(2);
  const overdueAndPenaltyDue = +(arrearsPrincipal + penaltyBalance).toFixed(2);

  let monthsOverdue = 0;
  if (arrearsPrincipal > 0) {
    let cumulativeDue = ledger.downpayment;
    let firstUnpaidDate = ledger.firstDueDate || ledger.createdAt;
    if (totalPrincipalPaid < ledger.downpayment) {
      firstUnpaidDate = ledger.firstDueDate || ledger.createdAt;
    } else {
      for (const inst of scheduled) {
        cumulativeDue = +(cumulativeDue + inst.monthlyDue).toFixed(2);
        if (inst.dueDate < asOfDateStr && cumulativeDue > totalPrincipalPaid + 0.01) {
          firstUnpaidDate = inst.dueDate;
          break;
        }
      }
    }
    const [dy, dm, dd] = firstUnpaidDate.split("-").map(Number);
    const [ay, am, ad] = asOfDateStr.split("-").map(Number);
    monthsOverdue = Math.max(1, (ay - dy) * 12 + (am - dm) + (ad > dd ? 1 : 0));
  }

  const currentTerm = currentTermAdded && nextUpcoming ? nextUpcoming : pastInstallments[pastInstallments.length - 1];
  let daysUntilDue = 0;
  if (nextUpcoming) {
    const dueMs = new Date(nextUpcoming.dueDate).getTime();
    const asOfMs = new Date(asOfDateStr).getTime();
    daysUntilDue = Math.ceil((dueMs - asOfMs) / (1000 * 60 * 60 * 24));
  }

  let status: LedgerStatus = "current";
  if (tspBalance <= 0 && penaltyBalance <= 0) {
    status = "settled";
  } else if (monthsOverdue > 0 || penaltyBalance > 0) {
    status = "overdue";
  } else if (currentTermBalance > 0 && nextUpcoming && daysUntilDue >= 0 && daysUntilDue <= 7) {
    status = "due_soon";
  }

  const principalNetOfDp = Math.max(0, totalPrincipalPaid - ledger.downpayment);
  const paidTermsEquivalent =
    ledger.monthlyAmortization > 0
      ? Math.min(ledger.termMonths, Math.floor((principalNetOfDp + 0.01) / ledger.monthlyAmortization))
      : 0;

  return {
    ledger,
    status,
    currentInstNo: currentTerm ? currentTerm.instNo : nextUpcoming ? nextUpcoming.instNo : ledger.termMonths,
    currentTermDueDate: currentTerm?.dueDate || nextUpcoming?.dueDate,
    monthsOverdue,
    daysUntilDue,
    arrearsPrincipal,
    currentTermBalance,
    installmentDueBalance,
    totalPenaltyDue: penaltyBalance,
    totalPayableNow,
    overdueAndPenaltyDue,
    advanceCredit,
    tspOutstandingBalance: tspBalance,
    totalCollected,
    totalPenaltyPaid,
    totalPenaltyWaived,
    paidTermsEquivalent,
    journal,
    nextScheduledDueDate: nextUpcoming?.dueDate,
    nextScheduledAmount: nextUpcoming?.monthlyDue,
  };
}
