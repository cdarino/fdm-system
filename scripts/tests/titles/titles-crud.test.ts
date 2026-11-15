import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import {
  getLandTitles,
  getLandTitleByPropertyId,
  getAccountsAwaitingTitle,
  createLandTitle,
  updateLandTitle,
  deleteLandTitle,
  updatePropertyTitleNumber,
} from "@/lib/actions/titles";
import { markAccountClearedByBilling, undoBillingClearance, postBillingPayment } from "@/lib/actions/billing";
import {
  createPropertyLot,
  assignPropertyClient,
  assignPropertyFullyPaid,
  getPropertyLotById,
} from "@/lib/actions/properties";
import { createClient } from "@/lib/actions/clients";
import {
  loginAsAdmin,
  logoutUser,
  withTemporaryUser,
  hardDeleteTestProperties,
  hardDeleteTestClients,
} from "../framework/session";
import { unwrap } from "../framework/action-helper";
import { uniqueNameSuffix } from "../framework/fake-data";

describe("Land Title Management Actions", () => {
  const testPropertyIds: string[] = [];
  const testClientIds: string[] = [];

  beforeAll(async () => {
    await loginAsAdmin();
  });

  beforeEach(async () => {
    await loginAsAdmin();
  });

  afterAll(async () => {
    try {
      await hardDeleteTestProperties(testPropertyIds);
      await hardDeleteTestClients(testClientIds);
    } catch {
      // Ignore cleanup errors
    }
  });

  async function createBuyerAndLot(label: string) {
    const client = unwrap(await createClient({ full_name: `${label} Buyer ${uniqueNameSuffix()}` }));
    testClientIds.push(client.client_id);

    const lot = unwrap(
      await createPropertyLot({
        location: `${label} Estate`,
        block_number: faker.number.int({ min: 100, max: 999 }),
        lot_number: faker.number.int({ min: 1, max: 99 }),
        area_size: 200,
        price_per_sqm: 10000,
      })
    );
    testPropertyIds.push(lot.property_id);

    return { client, lot };
  }

  it("creates a title for an account cleared by Billing, starting at Cleared by Billing", async () => {
    const { client, lot } = await createBuyerAndLot("Title Test");

    // Marking the lot fully paid clears the account, makes the lot Sold, and
    // puts it on Legal's queue without creating a title.
    const sold = unwrap(await assignPropertyFullyPaid(lot.property_id, client.client_id));
    expect(sold.status).toBe("Sold");
    expect(sold.title).toBeNull();
    expect(sold.active_account?.cleared_at).toBeTruthy();

    const queue = await getAccountsAwaitingTitle();
    expect(queue.some((a) => a.property.property_id === lot.property_id)).toBe(true);

    const titleNumber = `TCT-${Date.now()}`;
    unwrap(await updatePropertyTitleNumber(lot.property_id, titleNumber));
    const title = unwrap(
      await createLandTitle({ property_id: lot.property_id, is_legacy_transferred: false })
    );

    expect(title.property_id).toBe(lot.property_id);
    expect(title.client_id).toBe(client.client_id);
    expect(title.is_legacy_transferred).toBe(false);
    expect(title.property?.title_number).toBe(titleNumber);
    expect(title.status).toBe("Document Preparation");
    expect(title.created_by).toBeTruthy();
    expect(title.property?.block_number).toBe(lot.block_number);

    const queueAfter = await getAccountsAwaitingTitle();
    expect(queueAfter.some((a) => a.property.property_id === lot.property_id)).toBe(false);

    const fetchedByProp = await getLandTitleByPropertyId(lot.property_id);
    expect(fetchedByProp?.title_id).toBe(title.title_id);

    const listResult = await getLandTitles({ client_id: client.client_id });
    expect(listResult.data.some((t) => t.title_id === title.title_id)).toBe(true);

    const updated = unwrap(await updateLandTitle(title.title_id, { status: "For Review" }));
    expect(updated.status).toBe("For Review");

    const badStatus = await updateLandTitle(title.title_id, { status: "Processing" });
    expect(badStatus.success).toBe(false);

    // A lot has at most one title
    const second = await createLandTitle({
      property_id: lot.property_id,
      is_legacy_transferred: false,
    });
    expect(second.success).toBe(false);
    if (!second.success) expect(second.error).toMatch(/already has a title/i);

    unwrap(await deleteLandTitle(title.title_id));
    expect(await getLandTitleByPropertyId(lot.property_id)).toBeNull();
  });

  it("only allows a title once Billing has cleared the account", async () => {
    const { client, lot } = await createBuyerAndLot("Clearance Gate");

    // No account at all
    const noAccount = await createLandTitle({
      property_id: lot.property_id,
      is_legacy_transferred: false,
    });
    expect(noAccount.success).toBe(false);

    // Installment account still being paid
    const reserved = unwrap(await assignPropertyClient(lot.property_id, client.client_id));
    expect(reserved.status).toBe("Reserved");
    const accountId = reserved.active_account!.account_id;

    const notCleared = await createLandTitle({
      property_id: lot.property_id,
      is_legacy_transferred: false,
    });
    expect(notCleared.success).toBe(false);
    if (!notCleared.success) expect(notCleared.error).toMatch(/not cleared/i);

    // Settle balance first so account clearance validation passes
    unwrap(
      await postBillingPayment({
        accountId,
        amount: lot.area_size * lot.price_per_sqm,
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod: "cash",
        receiptNumber: `SETTLE-${Date.now()}`,
      })
    );

    // Billing clears it: the lot becomes Sold and a title can be created
    unwrap(await markAccountClearedByBilling(accountId));
    expect((await getPropertyLotById(lot.property_id)).status).toBe("Sold");

    // Clearing twice is refused
    expect((await markAccountClearedByBilling(accountId)).success).toBe(false);

    // Undo is allowed while there is no title
    unwrap(await undoBillingClearance(accountId));
    expect((await getPropertyLotById(lot.property_id)).status).toBe("Reserved");
    unwrap(await markAccountClearedByBilling(accountId));

    unwrap(
      await createLandTitle({
        property_id: lot.property_id,
        is_legacy_transferred: true,
      })
    );

    // Once Legal has created the title, the clearance can no longer be undone
    const lateUndo = await undoBillingClearance(accountId);
    expect(lateUndo.success).toBe(false);
  });

  it("allows updating the property title number and validating non-empty input", async () => {
    const { client, lot } = await createBuyerAndLot("Title Number Test");
    unwrap(await assignPropertyFullyPaid(lot.property_id, client.client_id));

    const invalidNumber = await updatePropertyTitleNumber(lot.property_id, "   ");
    expect(invalidNumber.success).toBe(false);

    const validNumber = unwrap(await updatePropertyTitleNumber(lot.property_id, "TCT-NEW-12345"));
    expect(validNumber.title_number).toBe("TCT-NEW-12345");
  });

  it("creates a legacy title at Ready for Claim when the title was already processed", async () => {
    const { client, lot } = await createBuyerAndLot("Legacy Claim");
    const titleNumber = `TCT-LEGACY-${Date.now()}`;

    const sold = unwrap(
      await assignPropertyFullyPaid(lot.property_id, client.client_id, {
        title_number: titleNumber,
        is_legacy_transferred: true,
      })
    );

    expect(sold.status).toBe("Sold");
    expect(sold.title?.status).toBe("Ready for Claim");
    expect(sold.title?.is_legacy_transferred).toBe(true);
    expect(sold.title_number).toBe(titleNumber);
  });

  it("limits each step to its role", async () => {
    await logoutUser();

    await withTemporaryUser({ roleNames: ["billing_staff"] }, async () => {
      const res = await createLandTitle({
        property_id: faker.string.uuid(),
        is_legacy_transferred: false,
      });
      expect(res.success).toBe(false);
      if (!res.success) expect(res.error).toMatch(/Forbidden|permission 'legal.create'/i);
    });

    await withTemporaryUser({ roleNames: ["legal_staff"] }, async () => {
      const res = await markAccountClearedByBilling(faker.string.uuid());
      expect(res.success).toBe(false);
      if (!res.success) expect(res.error).toMatch(/Forbidden|permission 'billing.update'/i);
    });

    await loginAsAdmin();
  });
});
