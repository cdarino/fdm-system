import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createPropertyLot,
  assignPropertyClient,
  forfeitPropertyLot,
  reopenPropertyLotForSale,
} from "@/lib/actions/properties";
import { createProjectArea } from "@/lib/actions/project-areas";
import { createClient, getClientById } from "@/lib/actions/clients";
import {
  loginAsAdmin,
  hardDeleteTestProperty,
  hardDeleteTestClient,
  hardDeleteTestProjectArea,
} from "../framework/session";
import { unwrap } from "../framework/action-helper";
import { uniqueNameSuffix } from "../framework/fake-data";

describe("Property Lot Forfeiture & Reopening Lifecycle", () => {
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
    for (const id of testProjectAreaIds) {
      try {
        await hardDeleteTestProjectArea(id);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("forfeits a reserved lot and retains previous client context", async () => {
    const projectArea = unwrap(
      await createProjectArea({
        name: `Forfeiture Test ProjectArea ${uniqueNameSuffix()}`,
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
        full_name: `Delinquent Buyer ${uniqueNameSuffix()}`,
        civil_status: "Single",
        address: "Babak, Samal Island",
      })
    );
    testClientIds.push(client.client_id);

    const lot = unwrap(
      await createPropertyLot({
        project_area_id: projectArea.project_area_id,
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
    const projectArea = unwrap(
      await createProjectArea({
        name: `Guard Test ProjectArea ${uniqueNameSuffix()}`,
        boundary: [
          [0, 0],
          [0, 10],
          [10, 10],
          [10, 0],
        ],
      })
    );
    testProjectAreaIds.push(projectArea.project_area_id);

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
        project_area_id: projectArea.project_area_id,
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
    const projectArea = unwrap(
      await createProjectArea({
        name: `Reopen Test ProjectArea ${uniqueNameSuffix()}`,
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
        full_name: `Grace Period ${uniqueNameSuffix()}`,
        civil_status: "Single",
        address: "Babak, Samal Island",
      })
    );
    testClientIds.push(client.client_id);

    const lot = unwrap(
      await createPropertyLot({
        project_area_id: projectArea.project_area_id,
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
        project_area_id: projectArea.project_area_id,
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

  it("keeps both the old forfeited account and the new reservation when the same client re-reserves the same lot", async () => {
    const projectArea = unwrap(
      await createProjectArea({
        name: `Same Client Re-Reserve ${uniqueNameSuffix()}`,
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
        full_name: `Returning Buyer ${uniqueNameSuffix()}`,
        civil_status: "Single",
        gender: "Male",
        address: "Babak, Samal Island",
      })
    );
    testClientIds.push(client.client_id);

    const lot = unwrap(
      await createPropertyLot({
        project_area_id: projectArea.project_area_id,
        block_number: 5,
        lot_number: 1,
        area_size: 150,
        price_per_sqm: 3500,
      })
    );
    testPropertyIds.push(lot.property_id);

    // First reservation -> forfeit -> reopen -> same client reserves the same lot again
    unwrap(await assignPropertyClient(lot.property_id, client.client_id));
    unwrap(
      await forfeitPropertyLot({
        propertyId: lot.property_id,
        reason: "First reservation defaulted",
      })
    );
    unwrap(
      await reopenPropertyLotForSale({
        propertyId: lot.property_id,
        allowEarlyReopen: true,
      })
    );
    unwrap(await assignPropertyClient(lot.property_id, client.client_id));

    const clientDetails = await getClientById(client.client_id);
    const entriesForLot = (clientDetails.properties ?? []).filter(
      (p) => p.property_id === lot.property_id
    );

    expect(entriesForLot).toHaveLength(2);
    const activeEntry = entriesForLot.find((p) => p.account_status === "Active");
    const forfeitedEntry = entriesForLot.find((p) => p.account_status === "Forfeited");

    expect(activeEntry).toBeDefined();
    expect(forfeitedEntry).toBeDefined();
    expect(activeEntry?.account_id).not.toBe(forfeitedEntry?.account_id);
    expect(forfeitedEntry?.reopened_at).toBeTruthy();
  });
});
