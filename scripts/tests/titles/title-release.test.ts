import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import {
  createLandTitle,
  updateLandTitle,
  recordLandTitleRelease,
  updatePropertyTitleNumber,
  getLandTitleByPropertyId,
} from "@/lib/actions/titles";
import {
  createPropertyLot,
  assignPropertyFullyPaid,
} from "@/lib/actions/properties";
import { createClient } from "@/lib/actions/clients";
import {
  loginAsAdmin,
  hardDeleteTestProperty,
  hardDeleteTestClient,
} from "../framework/session";
import { unwrap } from "../framework/action-helper";
import { uniqueNameSuffix } from "../framework/fake-data";

describe("Land Title Release Actions", () => {
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

  async function createReadyForClaimTitle(label: string) {
    const client = unwrap(await createClient({ full_name: `${label} Client ${uniqueNameSuffix()}` }));
    testClientIds.push(client.client_id);

    const lot = unwrap(
      await createPropertyLot({
        location: `${label} Subdivision`,
        block_number: faker.number.int({ min: 100, max: 999 }),
        lot_number: faker.number.int({ min: 1, max: 99 }),
        area_size: 150,
        price_per_sqm: 8000,
      })
    );
    testPropertyIds.push(lot.property_id);

    unwrap(await assignPropertyFullyPaid(lot.property_id, client.client_id));
    unwrap(await updatePropertyTitleNumber(lot.property_id, `TCT-${Date.now()}`));

    const title = unwrap(
      await createLandTitle({ property_id: lot.property_id, is_legacy_transferred: false })
    );

    // Progress to Ready for Claim
    const readyTitle = unwrap(
      await updateLandTitle(title.title_id, { status: "Ready for Claim" })
    );

    return { client, lot, title: readyTitle };
  }

  it("successfully releases a title in Ready for Claim status with recipient data", async () => {
    const { client, title } = await createReadyForClaimTitle("Valid Release");

    const releaseResult = await recordLandTitleRelease({
      title_id: title.title_id,
      released_to_name: client.full_name,
      released_to_id: "UMID CRN-0111-2222333-4",
      release_remarks: "Received in good order by principal buyer.",
    });

    const released = unwrap(releaseResult);
    expect(released.status).toBe("Released");
    expect(released.released_to_name).toBe(client.full_name);
    expect(released.released_to_id).toBe("UMID CRN-0111-2222333-4");
    expect(released.release_remarks).toBe("Received in good order by principal buyer.");
    expect(released.released_at).toBeTruthy();

    // Verify persisted record
    const fetched = await getLandTitleByPropertyId(title.property_id);
    expect(fetched?.status).toBe("Released");
    expect(fetched?.released_to_name).toBe(client.full_name);
    expect(fetched?.history?.some((h) => h.status === "Released")).toBe(true);
  });

  it("rejects release if title is not in Ready for Claim status", async () => {
    const { client } = await createReadyForClaimTitle("Early Release");
    const otherLot = unwrap(
      await createPropertyLot({
        location: "Prep Subdivision",
        block_number: faker.number.int({ min: 100, max: 999 }),
        lot_number: faker.number.int({ min: 1, max: 99 }),
        area_size: 150,
        price_per_sqm: 8000,
      })
    );
    testPropertyIds.push(otherLot.property_id);
    unwrap(await assignPropertyFullyPaid(otherLot.property_id, client.client_id));
    const docPrepTitle = unwrap(
      await createLandTitle({ property_id: otherLot.property_id, is_legacy_transferred: false })
    );

    const result = await recordLandTitleRelease({
      title_id: docPrepTitle.title_id,
      released_to_name: client.full_name,
      released_to_id: "DL N01-23-456789",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Only titles in 'Ready for Claim' can be marked as Released");
    }
  });

  it("rejects release if recipient name or ID is missing", async () => {
    const { title } = await createReadyForClaimTitle("Missing Data");

    const missingName = await recordLandTitleRelease({
      title_id: title.title_id,
      released_to_name: "",
      released_to_id: "Passport P1234567A",
    });
    expect(missingName.success).toBe(false);

    const missingId = await recordLandTitleRelease({
      title_id: title.title_id,
      released_to_name: "Juan Dela Cruz",
      released_to_id: " ",
    });
    expect(missingId.success).toBe(false);
  });

  it("prevents duplicate release calls on an already released title", async () => {
    const { client, title } = await createReadyForClaimTitle("Duplicate Release");

    unwrap(
      await recordLandTitleRelease({
        title_id: title.title_id,
        released_to_name: client.full_name,
        released_to_id: "PhilSys 1234-5678-9012",
      })
    );

    const secondRelease = await recordLandTitleRelease({
      title_id: title.title_id,
      released_to_name: client.full_name,
      released_to_id: "PhilSys 1234-5678-9012",
    });

    expect(secondRelease.success).toBe(false);
    if (!secondRelease.success) {
      expect(secondRelease.error).toContain("already been released");
    }
  });

  it("blocks status reversion away from Released in updateLandTitle", async () => {
    const { client, title } = await createReadyForClaimTitle("Revert Protection");

    unwrap(
      await recordLandTitleRelease({
        title_id: title.title_id,
        released_to_name: client.full_name,
        released_to_id: "PhilSys 1234-5678-9012",
      })
    );

    const revertAttempt = await updateLandTitle(title.title_id, {
      status: "Ready for Claim",
    });

    expect(revertAttempt.success).toBe(false);
    if (!revertAttempt.success) {
      expect(revertAttempt.error).toContain("cannot be reverted");
    }
  });

  it("allows updating release metadata on an already released title", async () => {
    const { client, title } = await createReadyForClaimTitle("Metadata Update");

    unwrap(
      await recordLandTitleRelease({
        title_id: title.title_id,
        released_to_name: client.full_name,
        released_to_id: "PhilSys 1234-5678-9012",
        release_remarks: "Original note",
      })
    );

    const updateResult = await updateLandTitle(title.title_id, {
      release_remarks: "Updated note with cashier OR# 99881",
    });

    const updated = unwrap(updateResult);
    expect(updated.status).toBe("Released");
    expect(updated.release_remarks).toBe("Updated note with cashier OR# 99881");
    expect(updated.released_to_name).toBe(client.full_name);
  });
});
