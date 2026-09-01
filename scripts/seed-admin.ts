/**
 * scripts/seed-admin.ts
 *
 * Creates the admin@example.com user via the Supabase Admin API and assigns
 * both the `admin_staff` and `system_admin` roles via rbac.user_role.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-admin.ts
 *
 * Required env vars (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 *   ADMIN_PASSWORD
 */

import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_ROLES = ["system_admin"];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const missing: string[] = [];
if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SECRET_KEY");
if (!ADMIN_PASSWORD) missing.push("ADMIN_PASSWORD");

if (missing.length > 0) {
  console.error(
    "❌  Missing required environment variables:\n" +
    missing.map((v) => `    ${v}`).join("\n") +
    "\n\n" +
    "    Make sure these are set in .env.local and run:\n" +
    "    npx tsx --env-file=.env.local scripts/seed-admin.ts"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Client (service role — bypasses RLS)
// ---------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n🌱  Seeding admin user: ${ADMIN_EMAIL}\n`);

  // 1. Create (or retrieve existing) user via Admin API.
  //    This safely handles auth.identities and all required auth columns.
  let userId: string;

  const { data: createData, error: createError } =
    await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true, // bypass email confirmation
    });

  if (createError) {
    // If the user already exists, look them up instead of failing
    if (createError.message.toLowerCase().includes("already been registered")) {
      console.log("ℹ️   User already exists — fetching existing user...");

      const { data: listData, error: listError } =
        await supabase.auth.admin.listUsers();

      if (listError) {
        console.error("❌  Failed to list users:", listError.message);
        process.exit(1);
      }

      const existing = listData.users.find((u) => u.email === ADMIN_EMAIL);
      if (!existing) {
        console.error("❌  Could not find existing user after conflict.");
        process.exit(1);
      }

      userId = existing.id;
      console.log(`✅  Found existing user: ${userId}`);
    } else {
      console.error("❌  Failed to create user:", createError.message);
      process.exit(1);
    }
  } else {
    userId = createData.user.id;
    console.log(`✅  Created user: ${userId}`);
  }

  // 2. Resolve role IDs from rbac.role
  const { data: roles, error: rolesError } = await supabase
    .schema("rbac")
    .from("role")
    .select("id, name")
    .in("name", ADMIN_ROLES);

  if (rolesError) {
    console.error("❌  Failed to fetch roles:", rolesError.message);
    process.exit(1);
  }

  const foundRoleNames = roles?.map((r) => r.name) ?? [];
  const missingRoles = ADMIN_ROLES.filter((r) => !foundRoleNames.includes(r));

  if (missingRoles.length > 0) {
    console.error(
      `❌  The following roles were not found in rbac.role: ${missingRoles.join(", ")}\n` +
      "    Make sure your migrations have been applied (npx supabase db push)."
    );
    process.exit(1);
  }

  console.log(`✅  Resolved roles: ${foundRoleNames.join(", ")}`);

  // 3. Remove any stale role assignments (e.g., admin_staff was previously added)
  const systemAdminRoleId = roles!.find((r) => r.name === 'system_admin')!.id;
  const { error: deleteError } = await supabase
    .schema('rbac')
    .from('user_role')
    .delete()
    .eq('user_id', userId)
    .neq('role_id', systemAdminRoleId);

  if (deleteError) {
    console.error('❌  Failed to clean up roles:', deleteError.message);
    process.exit(1);
  }

  // 4. Assign roles via rbac.user_role (upsert = safe to re-run)
  const userRoleRows = roles!.map((role) => ({
    user_id: userId,
    role_id: role.id,
  }));

  const { error: insertError } = await supabase
    .schema("rbac")
    .from("user_role")
    .upsert(userRoleRows, { onConflict: "user_id,role_id" });

  if (insertError) {
    console.error("❌  Failed to assign roles:", insertError.message);
    process.exit(1);
  }

  console.log(
    `✅  Assigned roles [${ADMIN_ROLES.join(", ")}] to ${ADMIN_EMAIL}\n`
  );
  console.log("🎉  Done! Admin user is ready.\n");
}

main().catch((err) => {
  console.error("❌  Unexpected error:", err);
  process.exit(1);
});
