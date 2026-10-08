import "server-only";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const ISSUED_AT_RETRY_DELAY_MS = 1000;

/**
 * Retries a database request once when PostgREST rejects a token as
 * "JWT issued at future".
 *
 * Right after sign-in, the first query can reach the database a moment before
 * its clock passes the token's `iat`, so the request is refused even though
 * the session is valid. Permission checks then read as denied and data loads
 * fail, which is why some users saw errors on their first click after logging
 * in. Waiting a second and sending the same request again succeeds.
 *
 * Only `/rest/v1/` calls are retried: their bodies are strings that can be
 * sent twice, unlike storage uploads.
 */
async function fetchWithIssuedAtRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);

  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (response.status !== 401 || !url.includes("/rest/v1/")) {
    return response;
  }

  const body = await response.clone().text();
  if (!body.includes("JWT issued at future")) {
    return response;
  }

  await new Promise((resolve) => setTimeout(resolve, ISSUED_AT_RETRY_DELAY_MS));
  return fetch(input, init);
}

/**
 * Request-scoped Supabase server client.
 *
 * Wrapped in React `cache()` so every call site within one request shares a
 * single client. Independent clients each carry their own session state and
 * will each try to refresh an expired access token; with refresh-token
 * rotation enabled the losers of that race get "refresh token already used",
 * which ends the session and signs the user out mid-navigation.
 *
 * `cache()` is scoped to a single request, not global, so this still honours
 * the "never store a client in a global variable" rule. Sessions cannot leak
 * between requests, including under Fluid compute.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { fetch: fetchWithIssuedAtRetry },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    },
  );
});
