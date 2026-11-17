import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createProjectArea,
} from "@/lib/actions/project-areas";
import {
  createPropertyLot,
} from "@/lib/actions/properties";
import { createClient } from "@/lib/actions/clients";
import { createLandTitle } from "@/lib/actions/titles";
import {
  getBillingLedgers,
  getBillingLedgerById,
  getAvailableClientsAndLots,
  createBillingLedger,
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
  loginAsAdmin,
  hardDeleteTestProperty,
  hardDeleteTestClient,
  hardDeleteTestProjectArea,
} from "../framework/session";
import { unwrap } from "../framework/action-helper";
import { uniqueNameSuffix } from "../framework/fake-data";

describe("Billing Server Actions End-to-End Integration", () => {
  const testPropertyIds: string[] = [];
  const testClientIds: string[] = [];
  const testProjectAreaIds: string[] = [];

  beforeAll(async () => {
    await loginAsAdmin();
  });

  afterAll(async () => {
    for (const id of testPropertyIds) {
      try {
        await hardDeleteTestProperty(id);
      } catch {}
    }
    for (const id of testClientIds) {
      try {
        await hardDeleteTestClient(id);
      } catch {}
    }
    for (const id of testProjectAreaIds) {
      try {
        await hardDeleteTestProjectArea(id);
      } catch {}
    }
  });

  it("completes full ledger lifecycle: creation, payments, policy updates, notices, and forfeiture", async () => {
    const projectArea = unwrap(
      await createProjectArea({
        name: `Billing Integration Area ${uniqueNameSuffix()}`,
        boundary: [
          [0, 0],
          [0, 10],
          [10, 10],
          [10, 0],
        ],
      })
    );
    testProjectAreaIds.push(projectArea.project_area_id);

    const client = unwrap(
      await createClient({
        full_name: `Billing Buyer ${uniqueNameSuffix()}`,
        civil_status: "Single",
        address: "Ecoland, Davao City",
      })
    );
    testClientIds.push(client.client_id);

    const lot = unwrap(
      await createPropertyLot({
        project_area_id: projectArea.project_area_id,
        block_number: 7,
        lot_number: 12,
        area_size: 200,
        price_per_sqm: 4000,
      })
    );
    testPropertyIds.push(lot.property_id);

    // Verify client and lot are in available lists
    const available = await getAvailableClientsAndLots();
    expect(available.clients.some((c) => c.clientId === client.client_id)).toBe(true);
    expect(available.lots.some((p) => p.propertyId === lot.property_id)).toBe(true);

    // 1. Create a new billing ledger
    const createRes = await createBillingLedger({
      clientId: client.client_id,
      propertyId: lot.property_id,
      contractPrice: 800000,
      downpayment: 80000,
      termMonths: 24,
      firstDueDate: "2024-01-15",
      dueDay: 15,
      penaltyRate: 3.5,
    });
    expect(createRes.success).toBe(true);
    const accountId = unwrap(createRes).accountId;
    expect(accountId).toBeDefined();

    // 2. Fetch single ledger and verify initial simulation
    const ledgerDetail = await getBillingLedgerById(accountId, "2024-03-20");
    expect(ledgerDetail).not.toBeNull();
    expect(ledgerDetail?.ledger.contractPrice).toBe(800000);
    expect(ledgerDetail?.ledger.downpayment).toBe(80000);
    expect(ledgerDetail?.ledger.client.fullName).toBe(client.full_name);
    expect(ledgerDetail?.ledger.payments.length).toBe(0);

    // 3. Fetch all ledgers list and ensure it appears
    const allLedgers = await getBillingLedgers("2024-03-20");
    const found = allLedgers.find((s) => s.ledger.id === accountId);
    expect(found).toBeDefined();
    expect(found?.ledger.client.fullName).toBe(client.full_name);

    // 4. Post an installment payment
    const postRes = await postBillingPayment({
      accountId,
      paymentDate: "2024-01-15",
      amount: 30000,
      receiptNumber: "OR-2024-001",
      paymentMethod: "bank_transfer",
      waivePenalty: false,
      notes: "First installment",
    });
    expect(postRes.success).toBe(true);

    const afterPost = await getBillingLedgerById(accountId, "2024-03-20");
    expect(afterPost?.ledger.payments.length).toBe(1);

    // 5. Void the installment payment
    const paymentToVoid = afterPost?.ledger.payments.find((p) => p.receiptNo === "OR-2024-001");
    expect(paymentToVoid).toBeDefined();
    if (paymentToVoid) {
      const voidRes = await voidBillingPayment({ paymentId: paymentToVoid.id });
      expect(voidRes.success).toBe(true);

      const afterVoid = await getBillingLedgerById(accountId, "2024-03-20");
      expect(afterVoid?.ledger.payments.length).toBe(0);
    }

    // 6. Update contract policies
    const policyRes = await updateBillingPolicies({
      accountId,
      penaltyRate: 3.0,
      enableMaturityAmnesty: true,
      amnestyMonths: 12,
      enablePostMaturityReducedRate: true,
      postMaturityPenaltyRate: 2.0,
    });
    expect(policyRes.success).toBe(true);

    const afterPolicy = await getBillingLedgerById(accountId, "2024-03-20");
    expect(afterPolicy?.ledger.policies?.enableMaturityAmnesty).toBe(true);
    expect(afterPolicy?.ledger.policies?.enablePostMaturityReducedRate).toBe(true);

    // 7. Record an overdue notice
    const noticeRes = await recordBillingNotice({
      accountId,
      stage: "first_notice",
      noticeNumber: 1,
      noticeDate: "2024-03-01",
      title: "First Notice of Delinquency",
      overdueAmount: 60000,
      arrearsPrincipal: 60000,
      penaltyDue: 2100,
      notes: "Delivered via registered mail",
    });
    expect(noticeRes.success).toBe(true);

    const afterNotice = await getBillingLedgerById(accountId, "2024-03-20");
    expect(afterNotice?.ledger.overdueEscalation?.currentStage).toBe("first_notice");
    expect(afterNotice?.ledger.overdueEscalation?.history.length).toBe(1);

    // 7b. Update the recorded notice
    const noticeId = unwrap(noticeRes).noticeId;
    const updateNoticeRes = await updateBillingNotice({
      noticeId,
      stage: "first_notice",
      noticeNumber: 1,
      noticeDate: "2024-03-05",
      title: "First Notice of Delinquency (Updated)",
      trackingNumber: "WAYBILL-123",
      notes: "Delivered via LBC courier",
    });
    expect(updateNoticeRes.success).toBe(true);

    const afterUpdateNotice = await getBillingLedgerById(accountId, "2024-03-20");
    const updatedEv = afterUpdateNotice?.ledger.overdueEscalation?.history.find((h) => h.id === noticeId);
    expect(updatedEv?.date).toBe("2024-03-05");
    expect(updatedEv?.trackingNo).toBe("WAYBILL-123");
    expect(updatedEv?.notes).toBe("Delivered via LBC courier");

    // 7b. Reject clearing an unsettled account
    const rejectClearRes = await markAccountClearedByBilling(accountId);
    expect(rejectClearRes.success).toBe(false);
    if (!rejectClearRes.success) {
      expect(rejectClearRes.error).toMatch(/unsettled/i);
    }

    // 8. Forfeit the account with a date-only string (from HTML date picker)
    const forfeitRes = await forfeitBillingAccount({
      accountId,
      reason: "Unresponsive to notice of cancellation",
      forfeitedAt: "2024-03-25",
    });
    expect(forfeitRes.success).toBe(true);

    const afterForfeit = await getBillingLedgerById(accountId, "2024-03-20");
    expect(afterForfeit?.ledger.status).toBe("Forfeited");
    expect(afterForfeit?.ledger.overdueEscalation?.currentStage).toBe("forfeited");
  });

  it("handles markAccountClearedByBilling and undoBillingClearance", async () => {
    const projectArea = unwrap(
      await createProjectArea({
        name: `Clearance Test Area ${uniqueNameSuffix()}`,
        boundary: [
          [0, 0],
          [0, 10],
          [10, 10],
          [10, 0],
        ],
      })
    );
    testProjectAreaIds.push(projectArea.project_area_id);

    const client = unwrap(
      await createClient({
        full_name: `Fully Paid Buyer ${uniqueNameSuffix()}`,
        civil_status: "Single",
        address: "Matina, Davao City",
      })
    );
    testClientIds.push(client.client_id);

    const lot = unwrap(
      await createPropertyLot({
        project_area_id: projectArea.project_area_id,
        block_number: 1,
        lot_number: 5,
        area_size: 100,
        price_per_sqm: 2000,
      })
    );
    testPropertyIds.push(lot.property_id);

    const createRes = await createBillingLedger({
      clientId: client.client_id,
      propertyId: lot.property_id,
      contractPrice: 200000,
      downpayment: 200000,
      termMonths: 1,
      firstDueDate: "2024-01-01",
      dueDay: 1,
      penaltyRate: 3.5,
    });
    const accountId = unwrap(createRes).accountId;

    // Settle the account with payment
    await postBillingPayment({
      accountId,
      paymentDate: "2024-01-01",
      amount: 200000,
      receiptNumber: "CR-FULL-001",
      paymentMethod: "cash",
      waivePenalty: true,
    });

    // Mark cleared (State 1: Queued for Legal Intake)
    const clearRes = await markAccountClearedByBilling(accountId);
    expect(clearRes.success).toBe(true);
    const clearedAccount = unwrap(clearRes);
    expect(clearedAccount.cleared_at).not.toBeNull();

    // Verify mutations are blocked even while in intake backlog (State 1 view-only)
    const intakePayRes = await postBillingPayment({
      accountId,
      paymentDate: "2024-02-01",
      amount: 1000,
      receiptNumber: "CR-INTAKE-BLOCKED",
      paymentMethod: "cash",
    });
    expect(intakePayRes.success).toBe(false);
    if (!intakePayRes.success) {
      expect(intakePayRes.error).toContain("view-only");
    }

    // Undo clearance
    const undoRes = await undoBillingClearance(accountId);
    expect(undoRes.success).toBe(true);
    const revertedAccount = unwrap(undoRes);
    expect(revertedAccount.cleared_at).toBeNull();

    // Re-clear account and simulate advancing to legal processing
    const reClearRes = await markAccountClearedByBilling(accountId);
    expect(reClearRes.success).toBe(true);

    const titleRes = await createLandTitle({ property_id: lot.property_id });
    expect(titleRes.success).toBe(true);

    // Verify ledger returns titleInfo
    const { ledger } = await getBillingLedgerById(accountId);
    expect(ledger.titleInfo).toBeDefined();
    expect(ledger.titleInfo?.status).toBe("Document Preparation");

    // All mutations should now be blocked by view-only enforcement
    const postPayRes = await postBillingPayment({
      accountId,
      paymentDate: "2024-02-01",
      amount: 5000,
      receiptNumber: "CR-BLOCKED-001",
      paymentMethod: "cash",
    });
    expect(postPayRes.success).toBe(false);
    if (!postPayRes.success) {
      expect(postPayRes.error).toContain("view-only");
    }

    const policyRes = await updateBillingPolicies({
      accountId,
      penaltyRate: 4.0,
      enableMaturityAmnesty: false,
      enablePostMaturityReducedRate: false,
    });
    expect(policyRes.success).toBe(false);
    if (!policyRes.success) {
      expect(policyRes.error).toContain("view-only");
    }

    const noticeRes = await recordBillingNotice({
      accountId,
      stage: "first_notice",
      noticeNumber: 1,
      noticeDate: "2024-02-01",
      title: "Blocked Notice",
      overdueAmount: 1000,
      arrearsPrincipal: 1000,
      penaltyDue: 0,
    });
    expect(noticeRes.success).toBe(false);
    if (!noticeRes.success) {
      expect(noticeRes.error).toContain("view-only");
    }

    const forfeitRes = await forfeitBillingAccount({
      accountId,
      reason: "Blocked Forfeit",
    });
    expect(forfeitRes.success).toBe(false);
    if (!forfeitRes.success) {
      expect(forfeitRes.error).toContain("view-only");
    }

    const undoBlockedRes = await undoBillingClearance(accountId);
    expect(undoBlockedRes.success).toBe(false);
    if (!undoBlockedRes.success) {
      expect(undoBlockedRes.error).toContain("cannot be undone");
    }
  });
});
