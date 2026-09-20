import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import {
  createSite,
  deleteSite,
  createSubdivisionLot,
  deleteSubdivisionLot,
  getSiteWithLots,
} from "@/lib/actions/sites";
import { updatePropertyLot } from "@/lib/actions/properties";
import { calculatePolygonAreaSqm } from "@/lib/geometry";
import {
  loginAsAdmin,
  logoutUser,
  getTestAdminClient,
} from "../framework/session";

describe("Map Editor Actions - Plotting Lots, Deleting Plots, Creating Sites", () => {
  const testSiteIds: string[] = [];

  beforeAll(async () => {
    await loginAsAdmin();
  });

  afterAll(async () => {
    const admin = getTestAdminClient();
    for (const siteId of testSiteIds) {
      try {
        await admin.from("property_lot").delete().eq("site_id", siteId);
        await admin.from("site_subdivision").delete().eq("site_id", siteId);
        await admin.from("site").delete().eq("site_id", siteId);
      } catch {
        // Ignore cleanup errors
      }
    }
    await logoutUser();
  });

  it("calculates polygon area in square metres accurately", () => {
    // 14m x 18m rectangle at lat ~7.1 deg N (1 deg lng = 110463m, 1 deg lat = 110574m)
    const lng0 = 125.7000;
    const lat0 = 7.1000;
    const dLng = 14 / 110463;
    const dLat = 18 / 110574;

    const points: [number, number][] = [
      [lng0, lat0],
      [lng0 + dLng, lat0],
      [lng0 + dLng, lat0 + dLat],
      [lng0, lat0 + dLat],
    ];

    const area = calculatePolygonAreaSqm(points);
    expect(area).toBeGreaterThan(245);
    expect(area).toBeLessThan(255);
  });

  it("creates a new site by plotting its boundary and giving it a name", async () => {
    const siteName = `Test Site ${faker.string.alphanumeric(8)}`;
    const boundary: [number, number][] = [
      [125.71, 7.10],
      [125.72, 7.10],
      [125.72, 7.11],
      [125.71, 7.11],
    ];

    const site = await createSite({
      name: siteName,
      description: "A newly plotted test subdivision site",
      boundary,
    });

    testSiteIds.push(site.site_id);

    expect(site).toBeDefined();
    expect(site.site_id).toBeDefined();
    expect(site.name).toBe(siteName);
    expect(Array.isArray(site.boundary)).toBe(true);
    expect((site.boundary as [number, number][]).length).toBe(4);
  });

  it("creates an available lot plot on the site with block and lot number", async () => {
    const siteId = testSiteIds[0];
    expect(siteId).toBeDefined();

    const lotBoundary: [number, number][] = [
      [125.712, 7.102],
      [125.713, 7.102],
      [125.713, 7.103],
      [125.712, 7.103],
    ];

    const { subdivision, lot } = await createSubdivisionLot({
      site_id: siteId,
      block_number: 1,
      lot_number: 1,
      boundary: lotBoundary,
    });

    expect(subdivision).toBeDefined();
    expect(subdivision.block_number).toBe(1);
    expect(subdivision.lot_number).toBe(1);
    expect(subdivision.site_id).toBe(siteId);

    // Lot is available by default (subdivision slot exists, property_lot row is null until claimed)
    expect(lot).toBeNull();

    // Verify it appears in getSiteWithLots as an available subdivision
    const siteWithLots = await getSiteWithLots(siteId);
    expect(siteWithLots.subdivisions.some((s) => s.block_number === 1 && s.lot_number === 1)).toBe(true);
    expect(siteWithLots.lots.some((l) => l.block_number === 1 && l.lot_number === 1)).toBe(false);
  });


  it("rejects duplicate block and lot number on the same site", async () => {
    const siteId = testSiteIds[0];
    const lotBoundary: [number, number][] = [
      [125.712, 7.102],
      [125.713, 7.102],
      [125.713, 7.103],
      [125.712, 7.103],
    ];

    await expect(
      createSubdivisionLot({
        site_id: siteId,
        block_number: 1,
        lot_number: 1,
        boundary: lotBoundary,
      })
    ).rejects.toThrow();
  });

  it("deletes the plot if it is wrong", async () => {
    const siteId = testSiteIds[0];

    // Plot a temporary lot to delete
    const lotBoundary: [number, number][] = [
      [125.714, 7.104],
      [125.715, 7.104],
      [125.715, 7.105],
      [125.714, 7.105],
    ];

    const { subdivision } = await createSubdivisionLot({
      site_id: siteId,
      block_number: 2,
      lot_number: 5,
      boundary: lotBoundary,
    });

    // Verify it was created
    let siteWithLots = await getSiteWithLots(siteId);
    expect(siteWithLots.subdivisions.some((s) => s.block_number === 2 && s.lot_number === 5)).toBe(true);

    // Now delete the plot
    await deleteSubdivisionLot({
      subdivision_id: subdivision.subdivision_id,
      site_id: siteId,
      block_number: 2,
      lot_number: 5,
    });

    // Verify it is completely removed
    siteWithLots = await getSiteWithLots(siteId);
    expect(siteWithLots.subdivisions.some((s) => s.block_number === 2 && s.lot_number === 5)).toBe(false);
    expect(siteWithLots.lots.some((l) => l.block_number === 2 && l.lot_number === 5)).toBe(false);
  });

  it("prevents deleting a plot if the lot is reserved or sold", async () => {
    const siteId = testSiteIds[0];

    // Create a lot
    const lotBoundary: [number, number][] = [
      [125.716, 7.106],
      [125.717, 7.106],
      [125.717, 7.107],
      [125.716, 7.107],
    ];

    const { subdivision, lot } = await createSubdivisionLot({
      site_id: siteId,
      block_number: 3,
      lot_number: 1,
      boundary: lotBoundary,
      create_property_lot: true,
    });

    expect(lot).toBeDefined();
    // Mark it as Reserved
    await updatePropertyLot(lot!.property_id, { status: "Reserved" });

    // Attempt to delete the plot should fail
    await expect(
      deleteSubdivisionLot({
        subdivision_id: subdivision.subdivision_id,
        site_id: siteId,
        block_number: 3,
        lot_number: 1,
      })
    ).rejects.toThrow(/reserved/i);

    // Clean up by resetting to Open then deleting
    await updatePropertyLot(lot!.property_id, { status: "Open" });
    await deleteSubdivisionLot({
      subdivision_id: subdivision.subdivision_id,
      site_id: siteId,
      block_number: 3,
      lot_number: 1,
    });
  });

  it("deletes the created site during cleanup", async () => {
    const siteId = testSiteIds[0];
    await deleteSite(siteId);

    const admin = getTestAdminClient();
    const { data: found } = await admin.from("site").select("site_id").eq("site_id", siteId).maybeSingle();
    expect(found).toBeNull();
  });
});

