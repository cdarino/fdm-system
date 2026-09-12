import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import {
  createPropertyLot,
  getPropertyLots,
  getPropertyLotById,
  updatePropertyLot,
  deletePropertyLot,
  assignPropertyClient,
} from "@/lib/actions/properties";
import { createClient } from "@/lib/actions/clients";
import {
  loginAsAdmin,
  logoutUser,
  getTestAdminClient,
  runTrackedCleanups,
} from "../framework/session";

describe("Property Lot Management Actions", () => {
  const testPropertyIds: string[] = [];
  const testClientIds: string[] = [];

  beforeAll(async () => {
    await loginAsAdmin();
  });

  afterAll(async () => {
    const adminClient = getTestAdminClient();
    for (const id of testPropertyIds) {
      try {
        await adminClient.from("property_lot").delete().eq("property_id", id);
      } catch {
        // Ignore cleanup errors
      }
    }
    for (const id of testClientIds) {
      try {
        await adminClient.from("client").delete().eq("client_id", id);
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

    const lot = await createPropertyLot({
      location: subdivision,
      block_number: blockNum,
      lot_number: lotNum,
      area_size: areaSize,
      price_per_sqm: pricePerSqm,
    });

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

    const lot = await createPropertyLot({
      location: locationName,
      block_number: blockNum,
      lot_number: lotNum,
      area_size: 200,
      price_per_sqm: 15000,
    });
    testPropertyIds.push(lot.property_id);

    // Attempt to create identical block and lot at same location
    await expect(
      createPropertyLot({
        location: locationName,
        block_number: blockNum,
        lot_number: lotNum,
        area_size: 220,
        price_per_sqm: 16000,
      })
    ).rejects.toThrow();
  });

  it("getPropertyLots filters by location search, status, and block/lot", async () => {
    const uniqueLoc = `Search Hills ${Date.now()}`;
    const lot1 = await createPropertyLot({
      location: uniqueLoc,
      block_number: 10,
      lot_number: 1,
      area_size: 120,
      price_per_sqm: 8000,
      status: "Open",
    });
    const lot2 = await createPropertyLot({
      location: uniqueLoc,
      block_number: 10,
      lot_number: 2,
      area_size: 140,
      price_per_sqm: 8000,
      status: "Sold",
    });
    testPropertyIds.push(lot1.property_id, lot2.property_id);

    // Filter by search/location
    const searchRes = await getPropertyLots({ search: uniqueLoc });
    expect(searchRes.data.length).toBe(2);

    // Filter by status Open
    const statusRes = await getPropertyLots({ search: uniqueLoc, status: "Open" });
    expect(statusRes.data.length).toBe(1);
    expect(statusRes.data[0].property_id).toBe(lot1.property_id);

    // Filter by block and lot number
    const blockLotRes = await getPropertyLots({
      search: uniqueLoc,
      block_number: 10,
      lot_number: 2,
    });
    expect(blockLotRes.data.length).toBe(1);
    expect(blockLotRes.data[0].property_id).toBe(lot2.property_id);
  });

  it("updatePropertyLot modifies property dimensions and price", async () => {
    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = await createPropertyLot({
      location: "Update Estate",
      block_number: blockNum,
      lot_number: 8,
      area_size: 150,
      price_per_sqm: 10000,
    });
    testPropertyIds.push(lot.property_id);

    const updated = await updatePropertyLot(lot.property_id, {
      area_size: 175.25,
      price_per_sqm: 11200,
      status: "Reserved",
    });

    expect(Number(updated.area_size)).toBe(175.25);
    expect(Number(updated.price_per_sqm)).toBe(11200);
    expect(updated.status).toBe("Reserved");
  });

  it("assignPropertyClient assigns lot to client with default Reserved status", async () => {
    const clientName = faker.person.fullName();
    const client = await createClient({ full_name: clientName });
    testClientIds.push(client.client_id);

    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = await createPropertyLot({
      location: "Assignment Palms",
      block_number: blockNum,
      lot_number: 3,
      area_size: 160,
      price_per_sqm: 11000,
    });
    testPropertyIds.push(lot.property_id);

    // Assign client without explicit status -> should default to Reserved
    const assigned = await assignPropertyClient(lot.property_id, client.client_id);
    expect(assigned.client_id).toBe(client.client_id);
    expect(assigned.status).toBe("Reserved");

    // Verify joined client data in detail retrieval
    const detail = await getPropertyLotById(lot.property_id);
    expect(detail.client).not.toBeNull();
    expect(detail.client?.full_name).toBe(clientName);
  });

  it("assignPropertyClient updates status to Sold when explicitly specified", async () => {
    const client = await createClient({ full_name: faker.person.fullName() });
    testClientIds.push(client.client_id);

    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = await createPropertyLot({
      location: "Closing Palms",
      block_number: blockNum,
      lot_number: 4,
      area_size: 160,
      price_per_sqm: 11000,
    });
    testPropertyIds.push(lot.property_id);

    const soldLot = await assignPropertyClient(lot.property_id, client.client_id, "Sold");
    expect(soldLot.client_id).toBe(client.client_id);
    expect(soldLot.status).toBe("Sold");
  });

  it("assignPropertyClient clears client and resets status to Open", async () => {
    const client = await createClient({ full_name: faker.person.fullName() });
    testClientIds.push(client.client_id);

    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = await createPropertyLot({
      location: "Reset Estate",
      block_number: blockNum,
      lot_number: 7,
      area_size: 190,
      price_per_sqm: 9500,
      client_id: client.client_id,
      status: "Reserved",
    });
    testPropertyIds.push(lot.property_id);

    // Unassign client -> should default to Open
    const cleared = await assignPropertyClient(lot.property_id, null);
    expect(cleared.client_id).toBeNull();
    expect(cleared.status).toBe("Open");
  });

  it("deletePropertyLot removes lot from database", async () => {
    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = await createPropertyLot({
      location: "Delete Estate",
      block_number: blockNum,
      lot_number: 99,
      area_size: 210,
      price_per_sqm: 13000,
    });

    await deletePropertyLot(lot.property_id);

    await expect(getPropertyLotById(lot.property_id)).rejects.toThrow("Property lot not found");
  });
});
