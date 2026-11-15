import { describe, it, expect } from "vitest";
import {
  evaluateLedger,
  formatCurrency,
  formatDate,
  addMonthsToDate,
  addDaysToDate,
  getScheduledInstallments,
} from "@/lib/billing/ledger-engine";
import { Ledger, PaymentRecord } from "@/lib/types/billing";

function createBaseLedger(overrides: Partial<Ledger> = {}): Ledger {
  return {
    id: "test-ledger-1",
    client: {
      clientId: "client-1",
      fullName: "Juan Dela Cruz",
      contactNumber: "09171234567",
      address: "Davao City",
    },
    property: {
      propertyId: "prop-1",
      projectArea: "San Vicente Phase 3",
      blockNumber: 4,
      lotNumber: 8,
      lotArea: 100,
      pricePerSqm: 1800,
    },
    contractPrice: 180000,
    downpayment: 0,
    termMonths: 36,
    monthlyAmortization: 5000,
    firstDueDate: "2025-01-25",
    dueDay: 25,
    penaltyRate: 0.035,
    createdAt: "2024-12-15",
    payments: [],
    ...overrides,
  };
}

describe("Billing Ledger Engine", () => {
  it("computes scheduled installments with rounding and remainder in final installment", () => {
    const ledger = createBaseLedger({ contractPrice: 100000, termMonths: 3 });
    const scheduled = getScheduledInstallments(ledger);

    expect(scheduled).toHaveLength(3);
    expect(scheduled[0].monthlyDue).toBe(33333.33);
    expect(scheduled[1].monthlyDue).toBe(33333.33);
    expect(scheduled[2].monthlyDue).toBe(33333.34);
    expect(
      +(scheduled[0].monthlyDue + scheduled[1].monthlyDue + scheduled[2].monthlyDue).toFixed(2)
    ).toBe(100000);
  });

  it("handles date math correctly with month clamping and day addition", () => {
    expect(addMonthsToDate("2025-01-31", 1, 31)).toBe("2025-02-28");
    expect(addMonthsToDate("2024-01-31", 1, 31)).toBe("2024-02-29");
    expect(addDaysToDate("2025-01-25", 1)).toBe("2025-01-26");
    expect(formatDate("2025-01-25")).toBe("Jan 25, 2025");
    expect(formatCurrency(5000)).toContain("5,000.00");
  });

  it("evaluates a current account paid up through previous term with active open term", () => {
    const payments: PaymentRecord[] = [];
    for (let m = 0; m < 22; m++) {
      payments.push({
        id: `pay-${m + 1}`,
        date: addMonthsToDate("2025-01-25", m, 25),
        amount: 5000,
        receiptNo: `OR#${1001 + m}`,
        method: "cash",
      });
    }

    const ledger = createBaseLedger({ payments });
    const summary = evaluateLedger(ledger, "2026-11-09");

    expect(summary.status).toBe("current");
    expect(summary.arrearsPrincipal).toBe(0);
    expect(summary.totalPenaltyDue).toBe(0);
    expect(summary.currentTermBalance).toBe(5000);
    expect(summary.totalPayableNow).toBe(5000);
    expect(summary.totalCollected).toBe(110000);
    expect(summary.tspOutstandingBalance).toBe(70000);
  });

  it("evaluates due_soon status when within 7 days of due date", () => {
    const payments: PaymentRecord[] = [];
    for (let m = 0; m < 22; m++) {
      payments.push({
        id: `pay-${m + 1}`,
        date: addMonthsToDate("2025-01-12", m, 12),
        amount: 5000,
        receiptNo: `OR#${2001 + m}`,
        method: "bank_transfer",
      });
    }

    const ledger = createBaseLedger({
      firstDueDate: "2025-01-12",
      dueDay: 12,
      payments,
    });

    const summary = evaluateLedger(ledger, "2026-11-09");
    expect(summary.daysUntilDue).toBe(3);
    expect(summary.status).toBe("due_soon");
  });

  it("evaluates overdue status and assesses 3.5% late penalties on overdue arrears", () => {
    const payments: PaymentRecord[] = [];
    // Paid 21 installments; missed Oct 25 installment
    for (let m = 0; m < 21; m++) {
      payments.push({
        id: `pay-${m + 1}`,
        date: addMonthsToDate("2025-01-25", m, 25),
        amount: 5000,
        receiptNo: `OR#${3001 + m}`,
        method: "check",
      });
    }

    const ledger = createBaseLedger({ payments });
    const summary = evaluateLedger(ledger, "2026-11-09");

    expect(summary.status).toBe("overdue");
    expect(summary.monthsOverdue).toBe(1);
    expect(summary.arrearsPrincipal).toBe(5000);
    expect(summary.totalPenaltyDue).toBe(175); // 5000 * 0.035
    expect(summary.currentTermBalance).toBe(5000);
    expect(summary.totalPayableNow).toBe(10175); // 5000 arrears + 175 pen + 5000 cur
  });

  it("applies penalty waiver correctly during payment", () => {
    const payments: PaymentRecord[] = [
      {
        id: "pay-1",
        date: "2025-01-25",
        amount: 5000,
        receiptNo: "OR#1",
        method: "cash",
      },
      {
        id: "pay-compromise",
        date: "2026-11-05",
        amount: 10000,
        receiptNo: "OR#COMP",
        method: "cash",
        waivePenalty: true,
      },
    ];

    const ledger = createBaseLedger({ payments });
    const summary = evaluateLedger(ledger, "2026-11-09");

    expect(summary.totalPenaltyWaived).toBeGreaterThan(0);
    expect(summary.totalPenaltyPaid).toBe(0);
  });

  it("applies penalty-first waterfall when paying without waiver", () => {
    const payments: PaymentRecord[] = [
      {
        id: "pay-late",
        date: "2025-02-15",
        amount: 3000,
        receiptNo: "OR#LATE",
        method: "cash",
      },
    ];

    const ledger = createBaseLedger({ payments });
    const summary = evaluateLedger(ledger, "2025-03-01");

    expect(summary.totalPenaltyPaid).toBeGreaterThan(0);
    expect(summary.totalCollected).toBe(3000);
  });

  it("marks contract as settled when contract price and penalties are fully paid", () => {
    const payments: PaymentRecord[] = [];
    for (let m = 0; m < 36; m++) {
      payments.push({
        id: `pay-${m + 1}`,
        date: addMonthsToDate("2025-01-25", m, 25),
        amount: 5000,
        receiptNo: `OR#${4001 + m}`,
        method: "bank_transfer",
      });
    }

    const ledger = createBaseLedger({ payments });
    const summary = evaluateLedger(ledger, "2028-01-01");

    expect(summary.status).toBe("settled");
    expect(summary.tspOutstandingBalance).toBe(0);
    expect(summary.totalPayableNow).toBe(0);
  });

  it("respects 12-month post-maturity amnesty with 0% penalty compounding", () => {
    const payments: PaymentRecord[] = [];
    for (let m = 0; m < 20; m++) {
      payments.push({
        id: `pay-${m + 1}`,
        date: addMonthsToDate("2024-01-25", m, 25),
        amount: 5000,
        receiptNo: `OR#${5001 + m}`,
        method: "cash",
      });
    }

    const ledger = createBaseLedger({
      termMonths: 24,
      firstDueDate: "2024-01-25",
      payments,
      policies: {
        enableMaturityAmnesty: true,
        amnestyMonths: 12,
      },
    });

    const summary = evaluateLedger(ledger, "2026-06-01");
    const maturePenalties = summary.journal.filter((j) => j.instLabel === "Mature");
    expect(maturePenalties).toHaveLength(0);
  });

  it("applies reduced post-maturity penalty rate after maturity", () => {
    const payments: PaymentRecord[] = [];
    for (let m = 0; m < 24; m++) {
      payments.push({
        id: `pay-${m + 1}`,
        date: addMonthsToDate("2023-01-25", m, 25),
        amount: 4000, // Underpaying monthly
        receiptNo: `OR#${6001 + m}`,
        method: "check",
      });
    }

    const ledger = createBaseLedger({
      contractPrice: 120000,
      termMonths: 24,
      firstDueDate: "2023-01-25",
      payments,
      policies: {
        enablePostMaturityReducedRate: true,
        postMaturityPenaltyRate: 0.02,
      },
    });

    const summary = evaluateLedger(ledger, "2026-11-09");
    const postMaturityPenRows = summary.journal.filter(
      (j) => j.rowType === "penalty_charge" && j.description.includes("Post-Maturity")
    );
    expect(postMaturityPenRows.length).toBeGreaterThan(0);
    expect(postMaturityPenRows[0].description).toContain("2.0% Post-Maturity Penalty");
  });
});
