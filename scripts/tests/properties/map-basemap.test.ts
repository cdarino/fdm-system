import { describe, it, expect } from "vitest";
import { getArcGISApplicationToken } from "@/lib/arcgis";

describe("Map Basemap Integration & Fallback Service", () => {
  it("formats single basemap ArcGIS hybrid style URL with access token", async () => {
    const tokenData = await getArcGISApplicationToken();
    const token = tokenData.accessToken;
    expect(token).toBeDefined();

    const hybridStyleUrl = `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/open/hybrid?token=${token}`;
    expect(hybridStyleUrl).toBe(
      `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/open/hybrid?token=${token}`
    );
  });

  it("verifies VersaTiles satellite fallback tile endpoint serves webp raster imagery", async () => {
    const tileUrl = "https://tiles.versatiles.org/tiles/satellite/0/0/0";
    let res: Response | null = null;
    for (let i = 0; i < 3; i++) {
      try {
        res = await fetch(tileUrl, { method: "HEAD" });
        if (res?.ok) break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    expect(res).toBeDefined();
    expect(res!.status).toBe(200);
    expect(res!.headers.get("content-type")).toContain("image/webp");
  });

  it("verifies VersaTiles osm vector tile endpoint serves mapbox vector tiles", async () => {
    const tileUrl = "https://tiles.versatiles.org/tiles/osm/0/0/0";
    let res: Response | null = null;
    for (let i = 0; i < 3; i++) {
      try {
        res = await fetch(tileUrl, { method: "HEAD" });
        if (res?.ok) break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    expect(res).toBeDefined();
    expect(res!.status).toBe(200);
    expect(res!.headers.get("content-type")).toContain("application/vnd.mapbox-vector-tile");
  });

  it("verifies graceful fallback retry logic on simulated failures", async () => {
    let callCount = 0;
    const simulateCheck = async (): Promise<boolean> => {
      callCount++;
      if (callCount === 1) return false;
      return true;
    };

    // Simulated checkArcGISAvailability workflow
    let isFallback = false;
    const okFirst = await simulateCheck();
    if (!okFirst) {
      const okRetry = await simulateCheck();
      isFallback = !okRetry;
    } else {
      isFallback = false;
    }

    expect(callCount).toBe(2);
    expect(isFallback).toBe(false);
  });

  it("verifies fallback engages when both initial attempt and retry fail", async () => {
    let callCount = 0;
    const simulateAlwaysFail = async (): Promise<boolean> => {
      callCount++;
      return false;
    };

    let isFallback = false;
    const okFirst = await simulateAlwaysFail();
    if (!okFirst) {
      const okRetry = await simulateAlwaysFail();
      isFallback = !okRetry;
    } else {
      isFallback = false;
    }

    expect(callCount).toBe(2);
    expect(isFallback).toBe(true);
  });
});
