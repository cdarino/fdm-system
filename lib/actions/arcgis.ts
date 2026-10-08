"use server";

import { createScope } from "@/lib/actions/action-handler";
import {
  getArcGISApplicationToken,
  type ArcGISTokenResponse,
  type ArcGISTokenOptions,
} from "@/lib/arcgis";

const property = createScope(["properties.read"]);

export async function getArcGISToken(
  options?: ArcGISTokenOptions
): Promise<ArcGISTokenResponse> {
  return property.query(async () => {
    return getArcGISApplicationToken(options);
  });
}

export async function getArcGISHybridStyle(
  options?: ArcGISTokenOptions
): Promise<{ style: unknown; token: string }> {
  return property.query(async () => {
    const tokenData = await getArcGISApplicationToken(options);
    const token = tokenData.accessToken;
    const styleUrl = `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/open/hybrid?token=${token}`;

    const res = await fetch(styleUrl, {
      headers: {
        Referer: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000/",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to load ArcGIS hybrid style: ${res.status}`);
    }

    const rawStyle = await res.json();
    const layers = Array.isArray(rawStyle?.layers)
      ? [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#0b1120" },
          },
          ...rawStyle.layers.filter(
            (layer: { type?: string }) => layer?.type !== "background"
          ),
        ]
      : [];
    const style = { ...rawStyle, layers };
    return { style, token };
  });
}
