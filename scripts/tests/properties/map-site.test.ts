import { describe, it, expect } from "vitest";
import { SiteMap } from "@/components/dashboard-properties/map-site";
import { useLeafletMap } from "@/lib/hooks/use-leaflet-map";
import { getArcGISApplicationToken } from "@/lib/arcgis";

describe("SiteMap Component & Leaflet Integration", () => {
  it("exports SiteMap and useLeafletMap correctly", () => {
    expect(typeof SiteMap).toBe("function");
    expect(typeof useLeafletMap).toBe("function");
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
});

