import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import { NextRequest } from "next/server";
import {
  getArcGISApplicationToken,
  resetArcGISTokenCache,
} from "@/lib/arcgis";
import { getArcGISToken } from "@/lib/actions/arcgis";
import { GET, POST } from "@/app/api/arcgis/token/route";
import {
  loginAsAdmin,
  loginAs,
  logoutUser,
  createTemporaryUser,
  runTrackedCleanups,
  type TemporaryUser,
} from "../framework/session";

describe("ArcGIS Token Service & Authentication Guard", () => {
  let unprivilegedUser: TemporaryUser;

  beforeAll(async () => {
    unprivilegedUser = await createTemporaryUser({
      emailPrefix: faker.internet.username().toLowerCase(),
      roleNames: [],
    });
  });

  beforeEach(async () => {
    resetArcGISTokenCache();
    await logoutUser();
  });

  afterAll(async () => {
    resetArcGISTokenCache();
    await logoutUser();
    await runTrackedCleanups();
  });

  describe("Core Service (lib/arcgis)", () => {
    it("fetches an ArcGIS application token and caches it in memory", async () => {
      const first = await getArcGISApplicationToken();
      expect(first.accessToken).toBeDefined();
      expect(typeof first.accessToken).toBe("string");
      expect(first.accessToken.length).toBeGreaterThan(20);
      expect(first.expiresAt).toBeGreaterThan(Date.now());
      expect(first.expiresIn).toBeGreaterThan(0);

      // Verify second invocation reuses the in-memory cached token
      const second = await getArcGISApplicationToken();
      expect(second.accessToken).toBe(first.accessToken);
      expect(second.expiresAt).toBe(first.expiresAt);
    });

    it("fetches a fresh token when forceRefresh is requested", async () => {
      const initial = await getArcGISApplicationToken();
      const refreshed = await getArcGISApplicationToken({ forceRefresh: true });

      expect(refreshed.accessToken).toBeDefined();
      expect(refreshed.expiresAt).toBeGreaterThanOrEqual(initial.expiresAt);
    });
  });

  describe("Server Action (lib/actions/arcgis)", () => {
    it("rejects unauthenticated requests", async () => {
      await expect(getArcGISToken()).rejects.toThrow(/unauthorized/i);
    });

    it("rejects callers missing properties.read permission", async () => {
      await loginAs(unprivilegedUser.email, unprivilegedUser.password);
      await expect(getArcGISToken()).rejects.toThrow(/forbidden.*properties\.read/i);
    });

    it("grants a token to authenticated callers with properties.read", async () => {
      await loginAsAdmin();
      const tokenData = await getArcGISToken();

      expect(tokenData.accessToken).toBeDefined();
      expect(tokenData.expiresIn).toBeGreaterThan(0);
      expect(tokenData.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe("Route Handler (app/api/arcgis/token)", () => {
    it("returns 401 when request is unauthenticated", async () => {
      const request = new NextRequest("http://localhost:3000/api/arcgis/token");
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toMatch(/unauthorized/i);
    });

    it("returns 403 when user lacks properties.read", async () => {
      await loginAs(unprivilegedUser.email, unprivilegedUser.password);

      const request = new NextRequest("http://localhost:3000/api/arcgis/token");
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toMatch(/forbidden.*properties\.read/i);
    });

    it("returns 200 with token metadata via GET for authorized users", async () => {
      await loginAsAdmin();

      const request = new NextRequest("http://localhost:3000/api/arcgis/token");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.access_token).toBeDefined();
      expect(data.expires_in).toBeGreaterThan(0);
      expect(data.expires_at).toBeGreaterThan(Date.now());
    });

    it("returns 200 with token metadata via POST for authorized users", async () => {
      await loginAsAdmin();

      const request = new NextRequest("http://localhost:3000/api/arcgis/token", {
        method: "POST",
        body: JSON.stringify({ force: false }),
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.access_token).toBeDefined();
      expect(data.expires_in).toBeGreaterThan(0);
      expect(data.expires_at).toBeGreaterThan(Date.now());
    });
  });
});

