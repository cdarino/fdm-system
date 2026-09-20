import { describe, it, expect, beforeAll } from "vitest";
import { SiteMap } from "@/components/dashboard-properties/map-site";
import { useMapLibreMap } from "@/lib/hooks/use-maplibre-map";
import { getArcGISApplicationToken } from "@/lib/arcgis";
import { getAllSitesWithLots } from "@/lib/actions/sites";
import { seedAllSampleSites } from "@/scripts/seed-sample-site";
import { getTestAdminClient, loginAsAdmin, logoutUser } from "../framework/session";

describe("SiteMap Component & MapLibre Integration", () => {
  beforeAll(async () => {
    const admin = getTestAdminClient();
    const { data: existing } = await admin
      .from("site")
      .select("site_id")
      .in("name", ["Barangay Limao", "San Augustin", "Kaputian", "Caliclic"]);

    if (!existing || existing.length < 4) {
      await seedAllSampleSites();
    }
  });

  it("exports SiteMap and useMapLibreMap correctly", () => {
    expect(typeof SiteMap).toBe("function");
    expect(typeof useMapLibreMap).toBe("function");
  });

  it("formats satellite imagery and label overlay tile URLs with active token", async () => {
    const tokenData = await getArcGISApplicationToken();
    const token = tokenData.accessToken;
    expect(token).toBeDefined();

    const satelliteUrlTemplate = `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${token}`;
    const labelsUrlTemplate = `https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/open/hybrid/detail/static/tile/{z}/{y}/{x}?token=${token}`;

    const z = 12;
    const y = 1967;
    const x = 3477;

    const satelliteTile = satelliteUrlTemplate
      .replace("{z}", String(z))
      .replace("{y}", String(y))
      .replace("{x}", String(x));

    const labelsTile = labelsUrlTemplate
      .replace("{z}", String(z))
      .replace("{y}", String(y))
      .replace("{x}", String(x));

    expect(satelliteTile).toContain(`/tile/12/1967/3477?token=${token}`);
    expect(labelsTile).toContain(`/tile/12/1967/3477?token=${token}`);
  });

  it("formats OpenStreetMap fallback raster tile URLs", () => {
    const osmUrlTemplate = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    const z = 14;
    const x = 13908;
    const y = 7868;

    const osmTile = osmUrlTemplate
      .replace("{z}", String(z))
      .replace("{x}", String(x))
      .replace("{y}", String(y));

    expect(osmTile).toBe("https://tile.openstreetmap.org/14/13908/7868.png");
  });

  it("verifies the 4 real-world Samal Island sites exist in database with WGS84 coordinates", async () => {
    const admin = getTestAdminClient();
    const expectedSiteNames = [
      "Barangay Limao",
      "San Augustin",
      "Kaputian",
      "Caliclic",
    ];

    const { data: sites, error } = await admin
      .from("site")
      .select("site_id, name, boundary")
      .in("name", expectedSiteNames);

    expect(error).toBeNull();
    expect(sites).toBeDefined();
    expect(sites?.length).toBe(4);

    for (const site of sites!) {
      const boundary = site.boundary as [number, number][];
      expect(Array.isArray(boundary)).toBe(true);
      expect(boundary.length).toBeGreaterThanOrEqual(4);

      // Verify WGS84 bounds around Samal Island / Davao Gulf
      for (const [lng, lat] of boundary) {
        expect(lng).toBeGreaterThanOrEqual(125.5);
        expect(lng).toBeLessThanOrEqual(125.9);
        expect(lat).toBeGreaterThanOrEqual(6.8);
        expect(lat).toBeLessThanOrEqual(7.3);
      }
    }
  });

  it("verifies 48 subdivisions are seeded with partial registration (3-5 property lots per site)", async () => {
    const admin = getTestAdminClient();
    const { data: sites } = await admin
      .from("site")
      .select("site_id, name")
      .in("name", ["Barangay Limao", "San Augustin", "Kaputian", "Caliclic"]);

    expect(sites?.length).toBe(4);
    const siteIds = sites!.map((s) => s.site_id);

    const { data: subdivisions, error: subError } = await admin
      .from("site_subdivision")
      .select("subdivision_id, block_number, lot_number, boundary, site_id")
      .in("site_id", siteIds);

    expect(subError).toBeNull();
    expect(subdivisions).toBeDefined();
    expect(subdivisions!.length).toBe(48);

    for (const sub of subdivisions!) {
      const boundary = sub.boundary as [number, number][];
      expect(Array.isArray(boundary)).toBe(true);
      expect(boundary.length).toBeGreaterThanOrEqual(4);
    }

    const { data: propertyLots, error: lotError } = await admin
      .from("property_lot")
      .select("property_id, block_number, lot_number, status, site_id")
      .in("site_id", siteIds);

    expect(lotError).toBeNull();
    expect(propertyLots).toBeDefined();
    expect(propertyLots!.length).toBe(16);

    // Each site should have between 3 and 5 registered lots
    for (const siteId of siteIds) {
      const siteSubdivisions = subdivisions!.filter((s) => s.site_id === siteId);
      const siteLots = propertyLots!.filter((l) => l.site_id === siteId);

      expect(siteSubdivisions.length).toBe(12);
      expect(siteLots.length).toBeGreaterThanOrEqual(3);
      expect(siteLots.length).toBeLessThanOrEqual(5);
    }
  });

  it("verifies getAllSitesWithLots returns all sites with populated subdivisions and lots", async () => {
    await loginAsAdmin();
    try {
      const allSites = await getAllSitesWithLots();
      expect(allSites.length).toBeGreaterThanOrEqual(4);

      const samalSites = allSites.filter((s) =>
        ["Barangay Limao", "San Augustin", "Kaputian", "Caliclic"].includes(s.name)
      );
      expect(samalSites.length).toBe(4);

      for (const site of samalSites) {
        expect(site.subdivisions.length).toBe(12);
        expect(site.lots.length).toBeGreaterThanOrEqual(3);
        expect(site.lots.length).toBeLessThanOrEqual(5);
      }
    } finally {
      await logoutUser();
    }
  });
});
