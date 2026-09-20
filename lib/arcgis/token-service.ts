import { ApplicationCredentialsManager } from "@esri/arcgis-rest-request";

export interface ArcGISTokenResponse {
  accessToken: string;
  expiresAt: number;
  expiresIn: number;
}

export interface ArcGISTokenOptions {
  forceRefresh?: boolean;
  durationInMinutes?: number;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;
let cachedManager: ApplicationCredentialsManager | null = null;

function resolveCredentials() {
  const clientId = process.env.ARCGIS_CLIENT_ID;
  // TODO: typo, oops!
  const clientSecret =
    process.env.ARCGIS_CLIENT_SECRET || process.env.ACRGIS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "ArcGIS credentials are not configured in environment variables."
    );
  }

  return { clientId, clientSecret };
}

export async function getArcGISApplicationToken(
  options: ArcGISTokenOptions = {}
): Promise<ArcGISTokenResponse> {
  const { forceRefresh = false, durationInMinutes = 120 } = options;
  const { clientId, clientSecret } = resolveCredentials();

  // Initialize or recreate credentials manager when credentials or duration change
  if (
    !cachedManager ||
    cachedManager.clientId !== clientId ||
    cachedManager.clientSecret !== clientSecret ||
    cachedManager.duration !== durationInMinutes
  ) {
    cachedManager = ApplicationCredentialsManager.fromCredentials({
      clientId,
      clientSecret,
      duration: durationInMinutes,
    });
  }

  const now = Date.now();
  const isExpiringSoon =
    !cachedManager.token ||
    !cachedManager.expires ||
    cachedManager.expires.getTime() - now <= FIVE_MINUTES_MS;

  // Refresh token when expired, close to expiration, or forced by caller
  if (forceRefresh || isExpiringSoon) {
    await cachedManager.refreshToken();
  }

  const expiresAt = cachedManager.expires.getTime();
  const expiresIn = Math.max(0, Math.floor((expiresAt - now) / 1000));

  return {
    accessToken: cachedManager.token,
    expiresAt,
    expiresIn,
  };
}

export function resetArcGISTokenCache(): void {
  cachedManager = null;
}

