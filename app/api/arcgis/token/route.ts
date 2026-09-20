import { NextResponse, type NextRequest } from "next/server";
import { getUserInfo } from "@/lib/user";
import { hasPermission } from "@/lib/permissions";
import { getArcGISApplicationToken } from "@/lib/arcgis";

async function authorizeTokenRequest() {
  const user = await getUserInfo();
  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized: You must be logged in to request a token." },
        { status: 401 }
      ),
    };
  }

  const allowed = await hasPermission("properties.read", user.id);
  if (!allowed) {
    return {
      errorResponse: NextResponse.json(
        { error: "Forbidden: You do not have permission 'properties.read'." },
        { status: 403 }
      ),
    };
  }

  return { user };
}

// NOTE: GET and POST seems to do the same thing!

export async function GET(request: NextRequest) {
  const authResult = await authorizeTokenRequest();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const forceRefresh = request.nextUrl.searchParams.get("force") === "true";

  try {
    const tokenData = await getArcGISApplicationToken({ forceRefresh });
    return NextResponse.json({
      access_token: tokenData.accessToken,
      expires_in: tokenData.expiresIn,
      expires_at: tokenData.expiresAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate ArcGIS token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await authorizeTokenRequest();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  let forceRefresh = false;
  try {
    const body = await request.json();
    forceRefresh = body?.force === true || body?.force === "1";
  } catch {
    // Body is optional; fallback to query param if not JSON
    forceRefresh = request.nextUrl.searchParams.get("force") === "true";
  }

  try {
    const tokenData = await getArcGISApplicationToken({ forceRefresh });
    return NextResponse.json({
      access_token: tokenData.accessToken,
      expires_in: tokenData.expiresIn,
      expires_at: tokenData.expiresAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate ArcGIS token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

