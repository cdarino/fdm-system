import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import {
  getLandTitles,
  getLandTitleByPropertyId,
  createLandTitle,
  updateLandTitle,
  deleteLandTitle,
} from "@/lib/actions/titles";
import { createPropertyLot } from "@/lib/actions/properties";
import { createClient } from "@/lib/actions/clients";
import {
  loginAsAdmin,
  logoutUser,
  withTemporaryUser,
  hardDeleteTestProperty,
  hardDeleteTestClient,
} from "../framework/session";
import { unwrap } from "../framework/action-helper";

describe("Land Title Management Actions", () => {
  const testPropertyIds: string[] = [];
  const testClientIds: string[] = [];

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
  });

  it("createLandTitle creates a land title record linked to property and client", async () => {
    const client = unwrap(
      await createClient({
        full_name: `Title Test Buyer ${Date.now()}`,
      })
    );
    testClientIds.push(client.client_id);

    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = unwrap(
      await createPropertyLot({
        location: "Title Test Estate",
        block_number: blockNum,
        lot_number: 1,
        area_size: 200,
        price_per_sqm: 10000,
        status: "Sold",
      })
    );
    testPropertyIds.push(lot.property_id);

    const titleNumber = `TCT-${Date.now()}`;
    const title = unwrap(
      await createLandTitle({
        property_id: lot.property_id,
        client_id: client.client_id,
        title_number: titleNumber,
        status: "Processing",
      })
    );

    expect(title.title_id).toBeDefined();
    expect(title.property_id).toBe(lot.property_id);
    expect(title.client_id).toBe(client.client_id);
    expect(title.title_number).toBe(titleNumber);
    expect(title.status).toBe("Processing");
    expect(title.client?.full_name).toBe(client.full_name);

    // Fetch by property ID
    const fetchedByProp = await getLandTitleByPropertyId(lot.property_id);
    expect(fetchedByProp).not.toBeNull();
    expect(fetchedByProp?.title_id).toBe(title.title_id);

    // List and filter by client_id
    const listResult = await getLandTitles({ client_id: client.client_id });
    expect(listResult.data.length).toBeGreaterThanOrEqual(1);
    expect(listResult.data.some((t) => t.title_id === title.title_id)).toBe(true);

    // Update title
    const updated = unwrap(
      await updateLandTitle(title.title_id, {
        status: "Ready for Release",
      })
    );
    expect(updated.status).toBe("Ready for Release");

    // Delete title
    unwrap(await deleteLandTitle(title.title_id));
    const afterDelete = await getLandTitleByPropertyId(lot.property_id);
    expect(afterDelete).toBeNull();
  });

  it("enforces unique constraint on property_id for land_title", async () => {
    const client = unwrap(
      await createClient({
        full_name: `Duplicate Title Buyer ${Date.now()}`,
      })
    );
    testClientIds.push(client.client_id);

    const blockNum = faker.number.int({ min: 100, max: 999 });
    const lot = unwrap(
      await createPropertyLot({
        location: "Unique Title Estate",
        block_number: blockNum,
        lot_number: 2,
        area_size: 180,
        price_per_sqm: 8000,
        status: "Sold",
      })
    );
    testPropertyIds.push(lot.property_id);

    unwrap(
      await createLandTitle({
        property_id: lot.property_id,
        client_id: client.client_id,
        title_number: `TCT-1-${Date.now()}`,
      })
    );

    // Second insert for same lot must fail
    const secondRes = await createLandTitle({
      property_id: lot.property_id,
      client_id: client.client_id,
      title_number: `TCT-2-${Date.now()}`,
    });

    expect(secondRes.success).toBe(false);
    if (!secondRes.success) {
      expect(secondRes.error).toMatch(/duplicate key value|uq_land_title_property/i);
    }
  });

  it("rejects mutations when user lacks legal.create permission", async () => {
    await logoutUser();

    await withTemporaryUser({ roleNames: ["billing_staff"] }, async () => {
      const res = await createLandTitle({
        property_id: faker.string.uuid(),
        client_id: faker.string.uuid(),
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/Forbidden|permission 'legal.create'/i);
      }
    });

    await loginAsAdmin();
  });
});
