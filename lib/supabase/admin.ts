/**
 * lib/supabase/admin.ts
 *
 * A service-role Supabase client for server-side admin operations (e.g. creating
 * users when public sign-ups are disabled). This module must NEVER be imported
 * in client components — the "server-only" package enforces this at build time.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client authenticated as the service role.
 * The service role bypasses Row Level Security — use only in trusted server
 * contexts such as Server Actions and Route Handlers.
 *
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing required environment variables: " +
        "NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. " +
        "Make sure they are set in .env.local."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
