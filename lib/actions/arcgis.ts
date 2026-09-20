"use server";

import { requirePermission } from "@/lib/actions/auth-guard";
import {
  getArcGISApplicationToken,
  type ArcGISTokenResponse,
  type ArcGISTokenOptions,
} from "@/lib/arcgis";

export async function getArcGISToken(
  options?: ArcGISTokenOptions
): Promise<ArcGISTokenResponse> {
  // Ensure caller is authenticated and possesses properties.read permission
  await requirePermission("properties.read");

  return getArcGISApplicationToken(options);
}

