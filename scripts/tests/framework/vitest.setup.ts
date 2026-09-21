import { vi } from "vitest";

export const cookieJar = new Map<string, string>();

export function clearCookieJar() {
  cookieJar.clear();
  userCache.clear();
}

export function setCookieInJar(name: string, value: string) {
  cookieJar.set(name, value);
}

export function deleteCookieFromJar(name: string) {
  cookieJar.delete(name);
}

const mockNextHeaders = {
  cookies: async () => ({
    getAll: () => Array.from(cookieJar.entries()).map(([name, value]) => ({ name, value })),
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
  headers: async () => new Headers(),
  draftMode: async () => ({ isEnabled: false, enable: () => {}, disable: () => {} }),
};

vi.mock("next/headers", () => mockNextHeaders);

const virtualDoc = {
  get cookie() {
    return Array.from(cookieJar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  },
  set cookie(cookieStr: string) {
    const parts = cookieStr.split(";");
    const [rawName, ...valParts] = parts[0].trim().split("=");
    const name = rawName.trim();
    const value = valParts.join("=").trim();
    const lower = cookieStr.toLowerCase();
    // Check if the cookie is being expired or deleted
    if (lower.includes("max-age=0") || lower.includes("expires=thu, 01 jan 1970") || !value) {
      cookieJar.delete(name);
    } else {
      cookieJar.set(name, value);
    }
  },
};

// Polyfill window and document for browser client compatibility
const g = globalThis as unknown as { window?: unknown; document?: unknown };
if (typeof g.window === "undefined") {
  g.window = {
    document: virtualDoc,
    location: { origin: "http://localhost:3000" },
    btoa: (str: string) => Buffer.from(str, "binary").toString("base64"),
    atob: (b64: string) => Buffer.from(b64, "base64").toString("binary"),
  };
}
if (typeof g.document === "undefined") {
  g.document = virtualDoc;
}

// Filter out repetitive GoTrue duplicate client notices during testing
const origConsoleWarn = console.warn;
console.warn = function (...args: unknown[]) {
  const msg = typeof args[0] === "string" ? args[0] : "";
  if (msg.includes("Multiple GoTrueClient instances detected in the same browser context")) {
    return;
  }
  origConsoleWarn.apply(console, args);
};

export const userCache = new Map<string, { body: string; headers: [string, string][]; time: number }>();

export function clearUserCache() {
  userCache.clear();
}

// Retry requests when hitting Supabase Auth rate limits and memoize frequent /auth/v1/user lookups
const origFetch = globalThis.fetch;
globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

  // Invalidate cache on mutations
  if (method !== "GET" && urlStr.includes("/auth/v1/")) {
    userCache.clear();
  }

  // Short-term cache for /auth/v1/user to prevent repetitive network requests
  if (method === "GET" && urlStr.includes("/auth/v1/user")) {
    const rawHeaders = init?.headers ?? (input instanceof Request ? input.headers : undefined);
    const authHeader =
      rawHeaders instanceof Headers
        ? rawHeaders.get("authorization")
        : Array.isArray(rawHeaders)
        ? rawHeaders.find(([k]) => k.toLowerCase() === "authorization")?.[1]
        : (rawHeaders as Record<string, string> | undefined)?.["authorization"] ??
          (rawHeaders as Record<string, string> | undefined)?.["Authorization"];

    if (authHeader) {
      const cached = userCache.get(authHeader);
      if (cached && Date.now() - cached.time < 3000) {
        return new Response(cached.body, {
          status: 200,
          headers: new Headers(cached.headers),
        });
      }
    }
  }

  let attempts = 0;
  const maxAttempts = 4;
  while (attempts < maxAttempts) {
    attempts++;
    const req = input instanceof Request ? input.clone() : input;
    const res = await origFetch(req, init);

    if (res.status === 429 && attempts < maxAttempts) {
      const retryAfter = res.headers.get("retry-after");
      const delayMs = retryAfter ? Math.max(2000, Number(retryAfter) * 1000) : 2000 * attempts;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    if (res.status === 200 && method === "GET" && urlStr.includes("/auth/v1/user")) {
      const cloned = res.clone();
      const body = await cloned.text();
      const rawHeaders = init?.headers ?? (input instanceof Request ? input.headers : undefined);
      const authHeader =
        rawHeaders instanceof Headers
          ? rawHeaders.get("authorization")
          : Array.isArray(rawHeaders)
          ? rawHeaders.find(([k]) => k.toLowerCase() === "authorization")?.[1]
          : (rawHeaders as Record<string, string> | undefined)?.["authorization"] ??
            (rawHeaders as Record<string, string> | undefined)?.["Authorization"];

      if (authHeader) {
        userCache.set(authHeader, {
          body,
          headers: Array.from(res.headers.entries()),
          time: Date.now(),
        });
      }
    }

    return res;
  }

  return origFetch(input, init);
};

