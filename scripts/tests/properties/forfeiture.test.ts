import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createPropertyLot,
  assignPropertyClient,
  forfeitPropertyLot,
  reopenPropertyLotForSale,
} from "@/lib/actions/properties";
import { createSite } from "@/lib/actions/sites";
import { createClient } from "@/lib/actions/clients";
import {
  loginAsAdmin,
  hardDeleteTestProperty,
  hardDeleteTestClient,
  hardDeleteTestSite,
} from "../framework/session";
import { unwrap } from "../framework/action-helper";
import { uniqueNameSuffix } from "../framework/fake-data";

describe("Property Lot Forfeiture & Reopening Lifecycle", () => {
  const testPropertyIds: string[] = [];
  const testClientIds: string[] = [];
  const testSiteIds: string[] = [];

  beforeAll(async () => {
    await loginAsAdmin();
  });

  afterAll(async () => {
    for (const id of testPropertyIds) {
      try {
        await hardDeleteTestProperty(id);
      } catch {
        // Ignore cleanup errors
      }
    }
    for (const id of testClientIds) {
      try {
        await hardDeleteTestClient(id);
      } catch {
        // Ignore cleanup errors
      }
    }
    for (const id of testSiteIds) {
      try {
        await hardDeleteTestSite(id);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("forfeits a reserved lot and retains previous client context", async () => {
    const site = unwrap(
      await createSite({
        name: `Forfeiture Test Site ${uniqueNameSuffix()}`,
        boundary: [
          [0, 0],
          [0, 10],
          [10, 10],
          [10, 0],
        ],
      })
    );
    testSiteIds.push(site.site_id);

    const client = unwrap(
      await createClient({
        full_name: `Delinquent Buyer ${uniqueNameSuffix()}`,
        civil_status: "Single",
        address: "Babak, Samal Island",
      })
    );
    testClientIds.push(client.client_id);

    const lot = unwrap(
      await createPropertyLot({
        site_id: site.site_id,
        block_number: 1,
        lot_number: 1,
        area_size: 150,
        price_per_sqm: 3500,
      })
    );
    testPropertyIds.push(lot.property_id);

    // Assign to client -> status becomes Reserved
    const reservedLot = unwrap(
      await assignPropertyClient(lot.property_id, client.client_id)
    );
    expect(reservedLot.status).toBe("Reserved");
    expect(reservedLot.client?.client_id).toBe(client.client_id);

    // Forfeit the lot
    const forfeitResult = await forfeitPropertyLot({
      propertyId: lot.property_id,
      reason: "Account defaulted after 3 notices",
    });
    expect(forfeitResult.success).toBe(true);

    const forfeitedLot = unwrap(forfeitResult);
    expect(forfeitedLot.status).toBe("Forfeited");
    expect(forfeitedLot.client?.client_id).toBe(client.client_id);
    expect(forfeitedLot.forfeited_account).not.toBeNull();
    expect(forfeitedLot.forfeited_account?.status).toBe("Forfeited");
    expect(forfeitedLot.forfeited_account?.forfeiture_reason).toBe("Account defaulted after 3 notices");
  });

  it("blocks assignment of new clients while the lot is in Forfeited status", async () => {
    const site = unwrap(
      await createSite({
        name: `Guard Test Site ${uniqueNameSuffix()}`,
        boundary: [
          [0, 0],
          [0, 10],
          [10, 10],
          [10, 0],
        ],
      })
    );
    testSiteIds.push(site.site_id);

    const client1 = unwrap(
      await createClient({
        full_name: `Original Buyer ${uniqueNameSuffix()}`,
        civil_status: "Single",
        address: "Peñaplata, Samal Island",
      })
    );
    const client2 = unwrap(
      await createClient({
        full_name: `Prospective Buyer ${uniqueNameSuffix()}`,
        civil_status: "Single",
        address: "Kaputian, Samal Island",
      })
    );
    testClientIds.push(client1.client_id, client2.client_id);

    const lot = unwrap(
      await createPropertyLot({
        site_id: site.site_id,
        block_number: 2,
        lot_number: 1,
        area_size: 120,
        price_per_sqm: 4000,
      })
    );
    testPropertyIds.push(lot.property_id);

    await assignPropertyClient(lot.property_id, client1.client_id);

    await forfeitPropertyLot({
      propertyId: lot.property_id,
      reason: "Default",
    });

    const assignResult = await assignPropertyClient(lot.property_id, client2.client_id);
    expect(assignResult.success).toBe(false);
    if (!assignResult.success) {
      expect(assignResult.error).toMatch(/currently forfeited and under the 30-day grace period/i);
    }
  });

  it("enforces 30-day grace period before reopening, then restores lot to Open", async () => {
    const site = unwrap(
      await createSite({
        name: `Reopen Test Site ${uniqueNameSuffix()}`,
        boundary: [
          [0, 0],
          [0, 10],
          [10, 10],
          [10, 0],
        ],
      })
    );
    testSiteIds.push(site.site_id);

    const client = unwrap(
      await createClient({
        full_name: `Grace Period ${uniqueNameSuffix()}`,
        civil_status: "Single",
        address: "Babak, Samal Island",
      })
    );
    testClientIds.push(client.client_id);

    const lot = unwrap(
      await createPropertyLot({
        site_id: site.site_id,
        block_number: 3,
        lot_number: 1,
        area_size: 200,
        price_per_sqm: 3000,
      })
    );
    testPropertyIds.push(lot.property_id);

    await assignPropertyClient(lot.property_id, client.client_id);

    // Forfeit without backdating (NOW)
    await forfeitPropertyLot({
      propertyId: lot.property_id,
      reason: "Recent forfeiture",
    });

    // Premature reopening attempt must fail
    const prematureResult = await reopenPropertyLotForSale({
      propertyId: lot.property_id,
    });
    expect(prematureResult.success).toBe(false);
    if (!prematureResult.success) {
      expect(prematureResult.error).toMatch(/30-day grace period is still active/i);
    }

    // Early reopening succeeds with override flag
    const earlyReopenResult = await reopenPropertyLotForSale({
      propertyId: lot.property_id,
      allowEarlyReopen: true,
    });
    expect(earlyReopenResult.success).toBe(true);
    const earlyReopenedLot = unwrap(earlyReopenResult);
    expect(earlyReopenedLot.status).toBe("Open");

    // Create another lot to test backdated historical forfeiture
    const historicalLot = unwrap(
      await createPropertyLot({
        site_id: site.site_id,
        block_number: 4,
        lot_number: 1,
        area_size: 200,
        price_per_sqm: 3000,
      })
    );
    testPropertyIds.push(historicalLot.property_id);

    await assignPropertyClient(historicalLot.property_id, client.client_id);

    const pastDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    await forfeitPropertyLot({
      propertyId: historicalLot.property_id,
      forfeitedAt: pastDate,
      reason: "Historical matured account",
    });

    // Reopening after 30 days succeeds
    const reopenResult = await reopenPropertyLotForSale({
      propertyId: historicalLot.property_id,
    });
    expect(reopenResult.success).toBe(true);

    const reopenedLot = unwrap(reopenResult);
    expect(reopenedLot.status).toBe("Open");
    expect(reopenedLot.past_accounts?.length).toBeGreaterThanOrEqual(1);

    const pastAccount = reopenedLot.past_accounts?.[0];
    expect(pastAccount?.status).toBe("Forfeited");
    expect(new Date(pastAccount?.forfeited_at ?? "").getTime()).toBe(new Date(pastDate).getTime());

    // Can now assign to a new buyer
    const newClient = unwrap(
      await createClient({
        full_name: `New Buyer ${uniqueNameSuffix()}`,
        civil_status: "Single",
        address: "Babak, Samal Island",
      })
    );
    testClientIds.push(newClient.client_id);

    const reassignResult = await assignPropertyClient(
      historicalLot.property_id,
      newClient.client_id
    );
    expect(reassignResult.success).toBe(true);

    const reassignedLot = unwrap(reassignResult);
    expect(reassignedLot.status).toBe("Reserved");
    expect(reassignedLot.client?.client_id).toBe(newClient.client_id);
    expect(reassignedLot.past_accounts?.some((a) => a.status === "Forfeited")).toBe(true);
  });
});
