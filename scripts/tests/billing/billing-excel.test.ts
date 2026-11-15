import { describe, it, expect } from "vitest";
import { buildExcelSoaModel } from "@/lib/billing/export-excel";
import { evaluateLedger } from "@/lib/billing/ledger-engine";
import { Ledger, PaymentRecord } from "@/lib/types/billing";

describe("Billing Excel Export SOA Model", () => {
  it("builds a complete 11-column Statement of Account model with company metadata", () => {
    const payments: PaymentRecord[] = [
      {
        id: "pay-1",
        date: "2025-01-25",
        amount: 5000,
        receiptNo: "OR#1001",
        method: "cash",
      },
    ];

    const ledger: Ledger = {
      id: "ledger-excel-test",
      client: {
        clientId: "client-test",
        fullName: "Maria Clara",
        contactNumber: "09181234567",
        address: "Bolton St., Davao City",
      },
      property: {
        propertyId: "prop-test",
        projectArea: "San Vicente 3",
        blockNumber: 4,
        lotNumber: 8,
        lotArea: 100,
        pricePerSqm: 1800,
      },
      contractPrice: 180000,
      downpayment: 10000,
      termMonths: 36,
      monthlyAmortization: 5000,
      firstDueDate: "2025-01-25",
      dueDay: 25,
      penaltyRate: 0.035,
      createdAt: "2024-12-15",
      payments,
    };

    const summary = evaluateLedger(ledger, "2025-02-10");
    const model = buildExcelSoaModel(ledger, summary, "2025-02-10");

    expect(model.meta.companyName).toContain("FIRST DAVAO MILLENNIUM");
    expect(model.meta.accountName).toBe("Maria Clara");
    expect(model.meta.projectArea).toBe("San Vicente 3");
    expect(model.meta.blockNo).toBe("4");
    expect(model.meta.lotNo).toBe("8");
    expect(model.meta.tsp).toBe(180000);

    expect(model.rows.length).toBeGreaterThan(0);
    const openingRow = model.rows[0];
    expect(openingRow.instNo).toBe("Total Selling Price");
    expect(openingRow.tspBalance).toBe(180000);

    expect(model.summary.tsp).toBe(180000);
    expect(model.summary.paidDuringContract).toBe(5000);
    expect(model.summary.totalPaid).toBe(5000);
    expect(model.summary.signatoryName).toBe("ALEX M. SANTOS");
    expect(model.summary.signatoryTitle).toBe("Accounting Head");
  });
});
