import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import {
  createPropertyLot,
  getPropertyLots,
  getPropertyLotById,
  updatePropertyLot,
  archivePropertyLot,
  unarchivePropertyLot,
  deletePropertyLot,
  assignPropertyClient,
  assignPropertyParties,
  assignPropertyFullyPaid,
} from "@/lib/actions/properties";
import {
  createSite,
  archiveSite,
  unarchiveSite,
  deleteSite,
  getSiteWithLots,
} from "@/lib/actions/sites";
import { createClient } from "@/lib/actions/clients";
import {
  loginAsAdmin,
  logoutUser,
  getTestAdminClient,
  hardDeleteTestProperty,
  hardDeleteTestClient,
  hardDeleteTestSite,
  runTrackedCleanups,
} from "../framework/session";
import { unwrap } from "../framework/action-helper";

describe("Property Lot Management Actions", () => {
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
    await logoutUser();
    await runTrackedCleanups();
  });

  it("getPropertyLots rejects when unauthenticated", async () => {
    await logoutUser();
    await expect(getPropertyLots()).rejects.toThrow("Unauthorized: You must be logged in");
    await loginAsAdmin();
  });

  it("createPropertyLot creates a new property lot with default Open status", async () => {
    const subdivision = `${faker.location.city()} Hills Subdivision`;
    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lotNum = faker.number.int({ min: 1, max: 50 });
    const areaSize = faker.number.float({ min: 100, max: 500, fractionDigits: 1 });
    const pricePerSqm = faker.number.int({ min: 8000, max: 25000 });

    const lot = unwrap(await createPropertyLot({
      location: subdivision,
      block_number: blockNum,
      lot_number: lotNum,
      area_size: areaSize,
      price_per_sqm: pricePerSqm,
    }));

    expect(lot.property_id).toBeDefined();
    expect(lot.location).toBe(subdivision);
    expect(lot.status).toBe("Open");
    testPropertyIds.push(lot.property_id);

    const retrieved = await getPropertyLotById(lot.property_id);
    expect(retrieved.property_id).toBe(lot.property_id);
    expect(Number(retrieved.block_number)).toBe(blockNum);
    expect(Number(retrieved.lot_number)).toBe(lotNum);
  });

  it("createPropertyLot enforces unique constraint on (location, block, lot)", async () => {
    const locationName = `${faker.location.city()} Unique Village`;
    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lotNum = faker.number.int({ min: 1, max: 50 });

    const lot = unwrap(await createPropertyLot({
      location: locationName,
      block_number: blockNum,
      lot_number: lotNum,
      area_size: 200,
      price_per_sqm: 15000,
    }));
    testPropertyIds.push(lot.property_id);

    // Attempt to create identical block and lot at same location
    const dupRes = await createPropertyLot({
      location: locationName,
      block_number: blockNum,
      lot_number: lotNum,
      area_size: 220,
      price_per_sqm: 16000,
    });
    expect(dupRes.success).toBe(false);
  });

  it("getPropertyLots filters by location search, status, and block/lot", async () => {
    const uniqueLoc = `Search Hills ${Date.now()}`;
    const lot1 = unwrap(await createPropertyLot({
      location: uniqueLoc,
      block_number: 10,
      lot_number: 1,
      area_size: 120,
      price_per_sqm: 8000,
      status: "Open",
    }));
    const lot2 = unwrap(await createPropertyLot({
      location: uniqueLoc,
      block_number: 10,
      lot_number: 2,
      area_size: 140,
      price_per_sqm: 8000,
    }));
    testPropertyIds.push(lot1.property_id, lot2.property_id);

    // Assign lot2 to fully-paid client so its status derives to Sold
    const client = unwrap(await createClient({ full_name: faker.person.fullName() }));
    testClientIds.push(client.client_id);
    unwrap(await assignPropertyFullyPaid(lot2.property_id, client.client_id));

    // Filter by search/location
    const searchRes = await getPropertyLots({ search: uniqueLoc });
    expect(searchRes.data.length).toBe(2);

    // Filter by status Open
    const statusRes = await getPropertyLots({ search: uniqueLoc, status: "Open" });
    expect(statusRes.data.length).toBe(1);
    expect(statusRes.data[0].property_id).toBe(lot1.property_id);

    // Filter by status Sold
    const soldStatusRes = await getPropertyLots({ search: uniqueLoc, status: "Sold" });
    expect(soldStatusRes.data.length).toBe(1);
    expect(soldStatusRes.data[0].property_id).toBe(lot2.property_id);

    // Filter by block and lot number
    const blockLotRes = await getPropertyLots({
      search: uniqueLoc,
      block_number: 10,
      lot_number: 2,
    });
    expect(blockLotRes.data.length).toBe(1);
    expect(blockLotRes.data[0].property_id).toBe(lot2.property_id);
  });

  it("updatePropertyLot modifies property dimensions and price while status remains derived", async () => {
    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = unwrap(await createPropertyLot({
      location: "Update Estate",
      block_number: blockNum,
      lot_number: 8,
      area_size: 150,
      price_per_sqm: 10000,
    }));
    testPropertyIds.push(lot.property_id);

    const updated = unwrap(await updatePropertyLot(lot.property_id, {
      area_size: 175.25,
      price_per_sqm: 11200,
    }));

    expect(Number(updated.area_size)).toBe(175.25);
    expect(Number(updated.price_per_sqm)).toBe(11200);
    expect(updated.status).toBe("Open");
  });

  it("assignPropertyClient assigns lot to client with default Reserved status", async () => {
    const clientName = faker.person.fullName();
    const client = unwrap(await createClient({ full_name: clientName }));
    testClientIds.push(client.client_id);

    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = unwrap(await createPropertyLot({
      location: "Assignment Palms",
      block_number: blockNum,
      lot_number: 3,
      area_size: 160,
      price_per_sqm: 11000,
    }));
    testPropertyIds.push(lot.property_id);

    // Assign client without explicit status -> should default to Reserved
    const assigned = unwrap(await assignPropertyClient(lot.property_id, client.client_id));
    expect(assigned.client_id).toBe(client.client_id);
    expect(assigned.status).toBe("Reserved");

    // Verify joined client data in detail retrieval
    const detail = await getPropertyLotById(lot.property_id);
    expect(detail.client).not.toBeNull();
    expect(detail.client?.full_name).toBe(clientName);
  });

  it("refuses to give a reserved lot to a second client on every assignment path", async () => {
    const first = unwrap(await createClient({ full_name: faker.person.fullName() }));
    const second = unwrap(await createClient({ full_name: faker.person.fullName() }));
    testClientIds.push(first.client_id, second.client_id);

    const lot = unwrap(await createPropertyLot({
      location: "Double Sale Guard Palms",
      block_number: faker.number.int({ min: 100, max: 999 }),
      lot_number: 6,
      area_size: 160,
      price_per_sqm: 11000,
    }));
    testPropertyIds.push(lot.property_id);

    unwrap(await assignPropertyClient(lot.property_id, first.client_id));

    const viaClient = await assignPropertyClient(lot.property_id, second.client_id);
    expect(viaClient.success).toBe(false);
    if (!viaClient.success) expect(viaClient.error).toMatch(/already reserved/i);

    await expect(
      assignPropertyParties(lot.property_id, [{ client_id: second.client_id, is_primary: true }])
    ).rejects.toThrow(/already reserved/i);

    const viaFullyPaid = await assignPropertyFullyPaid(lot.property_id, second.client_id);
    expect(viaFullyPaid.success).toBe(false);

    // The first buyer keeps the lot, alone on its account
    const detail = await getPropertyLotById(lot.property_id);
    expect(detail.client?.client_id).toBe(first.client_id);
    expect(detail.active_account?.parties.map((p) => p.client_id)).toEqual([first.client_id]);

    // Assigning to the same buyer again is still allowed
    unwrap(await assignPropertyClient(lot.property_id, first.client_id));
  });

  it("rejects assigning a lot to an inactive client", async () => {
    const client = unwrap(await createClient({ full_name: faker.person.fullName(), status: "Inactive" }));
    testClientIds.push(client.client_id);

    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = unwrap(await createPropertyLot({
      location: "Inactive Guard Palms",
      block_number: blockNum,
      lot_number: 5,
      area_size: 160,
      price_per_sqm: 11000,
    }));
    testPropertyIds.push(lot.property_id);

    const reserved = await assignPropertyClient(lot.property_id, client.client_id);
    expect(reserved.success).toBe(false);
    if (!reserved.success) expect(reserved.error).toMatch(/not active/i);

    const fullyPaid = await assignPropertyFullyPaid(lot.property_id, client.client_id);
    expect(fullyPaid.success).toBe(false);

    const detail = await getPropertyLotById(lot.property_id);
    expect(detail.status).toBe("Open");
    expect(detail.client).toBeNull();
  });

  it("assignPropertyFullyPaid assigns fully-paid client and derives Sold status via land title", async () => {
    const client = unwrap(await createClient({ full_name: faker.person.fullName() }));
    testClientIds.push(client.client_id);

    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = unwrap(await createPropertyLot({
      location: "Closing Palms",
      block_number: blockNum,
      lot_number: 4,
      area_size: 160,
      price_per_sqm: 11000,
    }));
    testPropertyIds.push(lot.property_id);

    // Fully paid means cleared by Billing. Legal creates the title afterwards.
    const soldLot = unwrap(await assignPropertyFullyPaid(lot.property_id, client.client_id));
    expect(soldLot.client?.client_id).toBe(client.client_id);
    expect(soldLot.status).toBe("Sold");
    expect(soldLot.active_account?.cleared_at).toBeTruthy();
    expect(soldLot.title).toBeNull();
  });

  it("assignPropertyClient clears client and resets status to Open", async () => {
    const client = unwrap(await createClient({ full_name: faker.person.fullName() }));
    testClientIds.push(client.client_id);

    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = unwrap(await createPropertyLot({
      location: "Reset Estate",
      block_number: blockNum,
      lot_number: 7,
      area_size: 190,
      price_per_sqm: 9500,
      status: "Open",
    }));
    testPropertyIds.push(lot.property_id);

    // Assign client first
    unwrap(await assignPropertyClient(lot.property_id, client.client_id));

    // Unassign client -> should default to Open
    const cleared = unwrap(await assignPropertyClient(lot.property_id, null));
    expect(cleared.client_id).toBeNull();
    expect(cleared.status).toBe("Open");
    expect(cleared.active_account).toBeNull();
  });

  it("assignPropertyParties supports multiple co-owners on a single lot", async () => {
    const client1 = unwrap(await createClient({ full_name: faker.person.fullName() }));
    const client2 = unwrap(await createClient({ full_name: faker.person.fullName() }));
    testClientIds.push(client1.client_id, client2.client_id);

    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = unwrap(await createPropertyLot({
      location: "Co-Ownership Estates",
      block_number: blockNum,
      lot_number: 12,
      area_size: 200,
      price_per_sqm: 10000,
    }));
    testPropertyIds.push(lot.property_id);

    const assigned = await assignPropertyParties(
      lot.property_id,
      [
        { client_id: client1.client_id, role: "Principal Buyer", ownership_percentage: 60, is_primary: true },
        { client_id: client2.client_id, role: "Co-Buyer", ownership_percentage: 40, is_primary: false },
      ],
      "Reserved"
    );

    expect(assigned.status).toBe("Reserved");
    expect(assigned.client?.client_id).toBe(client1.client_id);
    expect(assigned.active_account?.parties.length).toBe(2);

    const detail = await getPropertyLotById(lot.property_id);
    expect(detail.active_account?.parties.length).toBe(2);
    expect(Number(detail.active_account?.total_contract_price)).toBe(2000000);
  });

  it("database enforces single active ledger per lot preventing double-selling", async () => {
    const client1 = unwrap(await createClient({ full_name: faker.person.fullName() }));
    testClientIds.push(client1.client_id);

    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = unwrap(await createPropertyLot({
      location: "Double Sell Prevention Park",
      block_number: blockNum,
      lot_number: 15,
      area_size: 150,
      price_per_sqm: 12000,
    }));
    testPropertyIds.push(lot.property_id);

    unwrap(await assignPropertyClient(lot.property_id, client1.client_id));

    // Direct database attempt to insert a second active ledger for the same lot
    const adminClient = getTestAdminClient();
    const secondInsert = adminClient.from("ledger_account").insert({
      property_id: lot.property_id,
      status: "Active",
      total_contract_price: 1800000,
      remaining_balance: 1800000,
    });

    const { error } = await secondInsert;
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/uq_active_lot_ledger|duplicate key value/i);
  });

  it("deletePropertyLot removes lot from database", async () => {
    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = unwrap(await createPropertyLot({
      location: "Delete Estate",
      block_number: blockNum,
      lot_number: 99,
      area_size: 210,
      price_per_sqm: 13000,
    }));

    unwrap(await deletePropertyLot(lot.property_id));

    await expect(getPropertyLotById(lot.property_id)).rejects.toThrow("Property lot not found");
  });

  it("archivePropertyLot sets is_archived and archived_at, unarchive resets them", async () => {
    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = unwrap(await createPropertyLot({
      location: "Archive Test Estate",
      block_number: blockNum,
      lot_number: 1,
      area_size: 150,
      price_per_sqm: 10000,
    }));
    testPropertyIds.push(lot.property_id);

    const archived = unwrap(await archivePropertyLot(lot.property_id));
    expect(archived.is_archived).toBe(true);
    expect(archived.archived_at).not.toBeNull();

    const restored = unwrap(await unarchivePropertyLot(lot.property_id));
    expect(restored.is_archived).toBe(false);
    expect(restored.archived_at).toBeNull();
  });

  it("archiveSite, unarchiveSite, and deleteSite manage site lifecycle", async () => {
    const siteName = `Test Site ${Date.now()}`;
    const site = unwrap(await createSite({
      name: siteName,
      description: "Test site description",
      boundary: [[0, 0], [10, 0], [10, 10], [0, 10]],
    }));
    testSiteIds.push(site.site_id);

    const archived = unwrap(await archiveSite(site.site_id));
    expect(archived.is_archived).toBe(true);
    expect(archived.archived_at).not.toBeNull();

    const restored = unwrap(await unarchiveSite(site.site_id));
    expect(restored.is_archived).toBe(false);
    expect(restored.archived_at).toBeNull();

    unwrap(await deleteSite(site.site_id));
    await expect(getSiteWithLots(site.site_id)).rejects.toThrow("Site not found");
  });
});


