import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import {
  openSubdivisionForSale,
  assignPropertyFullyPaid,
  createAndAssignPropertyFromSubdivision,
  getPropertyLots,
  getPropertyLotById,
  assignPropertyClient,
} from "@/lib/actions/properties";
import { createSite, getSiteWithLots } from "@/lib/actions/sites";
import { createClient, getClientById } from "@/lib/actions/clients";
import {
  loginAsAdmin,
  hardDeleteTestProperty,
  hardDeleteTestClient,
  hardDeleteTestSite,
  getTestAdminClient,
} from "../framework/session";
import { unwrap } from "../framework/action-helper";

describe("Property Lifecycle & Subdivision Transitions", () => {
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

  it("openSubdivisionForSale creates an Open property_lot matching subdivision", async () => {
    const site = unwrap(
      await createSite({
        name: `Plat Estate ${Date.now()}`,
        boundary: [[0, 0], [50, 0], [50, 50], [0, 50]],
      })
    );
    testSiteIds.push(site.site_id);

    // Insert cosmetic site_subdivision directly
    const admin = getTestAdminClient();
    await admin.from("site_subdivision").insert({
      site_id: site.site_id,
      block_number: 1,
      lot_number: 5,
      boundary: [[0, 0], [10, 0], [10, 10], [0, 10]],
    });

    const lot = unwrap(
      await openSubdivisionForSale({
        site_id: site.site_id,
        block_number: 1,
        lot_number: 5,
        area_size: 150,
        price_per_sqm: 9000,
      })
    );
    testPropertyIds.push(lot.property_id);

    expect(lot.status).toBe("Open");
    expect(lot.block_number).toBe(1);
    expect(lot.lot_number).toBe(5);
    expect(lot.area_size).toBe(150);
    expect(lot.price_per_sqm).toBe(9000);

    const siteWithLots = await getSiteWithLots(site.site_id);
    expect(siteWithLots.lots.some((l) => l.property_id === lot.property_id)).toBe(true);
  });

  it("assignPropertyFullyPaid transitions lot to Sold and records land_title", async () => {
    const client = unwrap(
      await createClient({
        full_name: `Fully Paid Owner ${Date.now()}`,
      })
    );
    testClientIds.push(client.client_id);

    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = unwrap(
      await openSubdivisionForSale({
        site_id: testSiteIds[0] ?? (unwrap(await createSite({ name: `Site-${Date.now()}`, boundary: [[0, 0], [10, 0], [10, 10], [0, 10]] }))).site_id,
        block_number: blockNum,
        lot_number: 1,
        area_size: 200,
        price_per_sqm: 8500,
      })
    );
    testPropertyIds.push(lot.property_id);

    const titleNumber = `TCT-PAID-${Date.now()}`;
    const assigned = unwrap(
      await assignPropertyFullyPaid(lot.property_id, client.client_id, titleNumber)
    );

    expect(assigned.status).toBe("Sold");
    expect(assigned.client?.client_id).toBe(client.client_id);
    expect(assigned.title?.title_number).toBe(titleNumber);
    expect(assigned.active_account).toBeNull();

    // Verify client details include this owned property
    const clientDetails = await getClientById(client.client_id);
    expect(clientDetails.properties?.some((p) => p.property_id === lot.property_id)).toBe(true);

    // Verify getPropertyLots filtered by client_id returns it
    const clientLots = await getPropertyLots({ client_id: client.client_id });
    expect(clientLots.data.some((l) => l.property_id === lot.property_id)).toBe(true);

    // Unassigning clears the client and removes land title
    const cleared = unwrap(await assignPropertyClient(lot.property_id, null));
    expect(cleared.status).toBe("Open");
    expect(cleared.client).toBeNull();
    expect(cleared.title).toBeNull();
  });

  it("createAndAssignPropertyFromSubdivision handles installment and fully-paid flows", async () => {
    const site = unwrap(
      await createSite({
        name: `Direct Assign Site ${Date.now()}`,
        boundary: [[0, 0], [20, 0], [20, 20], [0, 20]],
      })
    );
    testSiteIds.push(site.site_id);

    const installmentClient = unwrap(
      await createClient({
        full_name: `Installment Buyer ${Date.now()}`,
      })
    );
    testClientIds.push(installmentClient.client_id);

    const paidClient = unwrap(
      await createClient({
        full_name: `Outright Owner ${Date.now()}`,
      })
    );
    testClientIds.push(paidClient.client_id);

    // 1. Installment flow
    const installmentLot = unwrap(
      await createAndAssignPropertyFromSubdivision({
        site_id: site.site_id,
        block_number: 1,
        lot_number: 10,
        area_size: 180,
        price_per_sqm: 10000,
        client_id: installmentClient.client_id,
        ownership_type: "installment",
        total_contract_price: 1800000,
        remaining_balance: 1500000,
      })
    );
    testPropertyIds.push(installmentLot.property_id);

    expect(installmentLot.status).toBe("Reserved");
    expect(installmentLot.client?.client_id).toBe(installmentClient.client_id);
    expect(installmentLot.active_account).not.toBeNull();
    expect(Number(installmentLot.active_account?.remaining_balance)).toBe(1500000);

    // 2. Fully-paid flow
    const paidLot = unwrap(
      await createAndAssignPropertyFromSubdivision({
        site_id: site.site_id,
        block_number: 1,
        lot_number: 11,
        area_size: 220,
        price_per_sqm: 12000,
        client_id: paidClient.client_id,
        ownership_type: "fully_paid",
        title_number: `TCT-DIRECT-${Date.now()}`,
      })
    );
    testPropertyIds.push(paidLot.property_id);

    expect(paidLot.status).toBe("Sold");
    expect(paidLot.client?.client_id).toBe(paidClient.client_id);
    expect(paidLot.title).not.toBeNull();
    expect(paidLot.active_account).toBeNull();

    // Verify both clients resolve their respective properties
    const [instDetails, paidDetails] = await Promise.all([
      getClientById(installmentClient.client_id),
      getClientById(paidClient.client_id),
    ]);
    expect(instDetails.properties?.some((p) => p.property_id === installmentLot.property_id)).toBe(true);
    expect(paidDetails.properties?.some((p) => p.property_id === paidLot.property_id)).toBe(true);
  });
});
