// You run this script with `npm run test:e2e`
// This script is here just to check if the supabase client is configured
// correctly, testing role assigns, user registers, etc

// TODO: this does not check if the functions in lib work, though, we need to use
// a different testing library for this, playwright seems to do the job

/**
 * scripts/e2e-user-flow.test.ts
 *
 * End-to-end integration test for the user management lifecycle:
 *   1. Create a user       (via Admin API  — mirrors registerUser() in lib/actions/admin-register.ts)
 *   2. Log in as that user (via anon client — mirrors login() in lib/auth.ts)
 *   3. Update the user's password (via anon client — mirrors updatePassword() in lib/auth.ts)
 *   4. Log in again with the new password
 *   5. Assign roles to the user (via Admin API — mirrors assignRoles() in lib/actions/admin-register.ts)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/e2e-user-flow.test.ts
 *
 * Required env vars (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *   SUPABASE_SECRET_KEY
 */
import { createClient } from "@supabase/supabase-js";
// ─────────────────────────────────────────────────────────────────────────────
// Config & validation
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY;
const missing: string[] = [];
if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SECRET_KEY");
if (missing.length > 0) {
  console.error(
    "❌  Missing required environment variables:\n" +
    missing.map((v) => `    ${v}`).join("\n") +
    "\n\n" +
    "    Make sure these are set in .env.local and run:\n" +
    "    npx tsx --env-file=.env.local scripts/e2e-user-flow.test.ts"
  );
  process.exit(1);
}
// ─────────────────────────────────────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Service-role client — bypasses RLS, mirrors createAdminClient() in lib/supabase/admin.ts
 */
const adminClient = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
/**
 * Anon client — used for user-facing auth flows, mirrors createClient() in lib/supabase/client.ts
 */
const anonClient = createClient(SUPABASE_URL!, ANON_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function pass(label: string) {
  console.log(`  ✅  ${label}`);
  passed++;
}
function fail(label: string, reason?: string) {
  console.error(`  ❌  ${label}${reason ? `: ${reason}` : ""}`);
  failed++;
}
// ─────────────────────────────────────────────────────────────────────────────
// Test data
// ─────────────────────────────────────────────────────────────────────────────
const timestamp = Date.now();
const TEST_EMAIL = `e2e-test-${timestamp}@example.com`;
const INITIAL_PASSWORD = `TestPass-${timestamp}!`;
const UPDATED_PASSWORD = `UpdatedPass-${timestamp}!`;
// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
async function testCreateUser(): Promise<string> {
  console.log("\n📋  Step 1: Create a user");
  console.log(`      Email   : ${TEST_EMAIL}`);
  // Mirrors registerUser() in lib/actions/admin-register.ts
  const { data, error } = await adminClient.auth.admin.createUser({
    email: TEST_EMAIL,
    password: INITIAL_PASSWORD,
    email_confirm: true, // bypass email confirmation — same flag used in registerUser()
  });
  if (error || !data?.user) {
    fail("createUser", error?.message ?? "No user returned");
    throw new Error("Cannot continue without a created user.");
  }
  const userId = data.user.id;
  pass(`User created — id: ${userId}`);
  return userId;
}
async function testLogin(email: string, password: string, label = "login") {
  console.log(`\n📋  ${label}`);
  // Mirrors login() in lib/auth.ts
  const { data, error } = await anonClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data?.session) {
    fail(label, error?.message ?? "No session returned");
    throw new Error(`Cannot continue after failed ${label}.`);
  }
  pass(`Signed in — user id: ${data.user.id}`);
  return data.session;
}
async function testUpdatePassword(
  session: { access_token: string; refresh_token: string },
  newPassword: string
): Promise<void> {
  console.log("\n📋  Step 3: Update user's own password");
  // We need a client that has a valid auth session.
  // This mirrors updatePassword() in lib/auth.ts which calls supabase.auth.updateUser().
  // setSession() establishes the session before calling updateUser().
  const userClient = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: sessionError } = await userClient.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (sessionError) {
    fail("updateUser (setSession)", sessionError.message);
    throw new Error("Cannot continue after failed session restore.");
  }
  const { error } = await userClient.auth.updateUser({ password: newPassword });
  if (error) {
    fail("updateUser (password)", error.message);
    throw new Error("Cannot continue after failed password update.");
  }
  pass("Password updated successfully");
}
async function testAssignRoles(userId: string): Promise<void> {
  console.log("\n📋  Step 5: Assign roles to the user");
  // 1. Fetch available active roles — mirrors getActiveRoles() in lib/actions/admin-register.ts
  const { data: roles, error: rolesError } = await adminClient
    .schema("rbac")
    .from("role")
    .select("id, name, description")
    .eq("active", true)
    .order("name");
  if (rolesError) {
    fail("getActiveRoles", rolesError.message);
    throw new Error("Cannot assign roles without fetching available roles.");
  }
  if (!roles || roles.length === 0) {
    fail("getActiveRoles", "No active roles found in rbac.role");
    throw new Error("Cannot assign roles — no roles exist.");
  }
  // Pick the first available role for the test
  const roleToAssign = roles[0];
  console.log(`      Assigning role: "${roleToAssign.name}" (${roleToAssign.id})`);
  // 2. Upsert the user_role row — mirrors assignRoles() in lib/actions/admin-register.ts
  const { error: upsertError } = await adminClient
    .schema("rbac")
    .from("user_role")
    .upsert(
      [{ user_id: userId, role_id: roleToAssign.id }],
      { onConflict: "user_id,role_id" }
    );
  if (upsertError) {
    fail("assignRoles (upsert)", upsertError.message);
    throw new Error("Role assignment failed.");
  }
  // 3. Verify the assignment persisted
  const { data: assigned, error: verifyError } = await adminClient
    .schema("rbac")
    .from("user_role")
    .select("role_id")
    .eq("user_id", userId)
    .eq("role_id", roleToAssign.id)
    .single();
  if (verifyError || !assigned) {
    fail("assignRoles (verify)", verifyError?.message ?? "Row not found after upsert");
    return;
  }
  pass(`Role "${roleToAssign.name}" assigned and verified`);
}
// ─────────────────────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────────────────────
async function cleanup(userId: string | null): Promise<void> {
  if (!userId) return;
  console.log("\n🧹  Cleanup: deleting test user");
  // rbac.user_role has a FK to auth.users without ON DELETE CASCADE,
  // so we must remove any assigned roles before deleting the auth user.
  const { error: roleCleanupError } = await adminClient
    .schema("rbac")
    .from("user_role")
    .delete()
    .eq("user_id", userId);
  if (roleCleanupError) {
    console.warn(`  ⚠️  Could not remove user roles: ${roleCleanupError.message}`);
  }
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) {
    console.warn(`  ⚠️  Cleanup failed: ${error.message}`);
    console.warn(`  ⚠️  You may need to manually delete user ${userId} (${TEST_EMAIL})`);
  } else {
    console.log(`  ✅  Test user deleted — ${TEST_EMAIL}`);
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🧪  User Management E2E Test");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  let userId: string | null = null;
  try {
    // ── Step 1: Create the user ─────────────────────────────────────────────
    userId = await testCreateUser();
    // ── Step 2: Log in as the new user ─────────────────────────────────────
    const initialSession = await testLogin(
      TEST_EMAIL,
      INITIAL_PASSWORD,
      "Step 2: Log in as new user (initial password)"
    );
    // ── Step 3: Update the user's password ─────────────────────────────────
    await testUpdatePassword(initialSession, UPDATED_PASSWORD);
    // ── Step 4: Log in again with the new password ──────────────────────────
    await testLogin(
      TEST_EMAIL,
      UPDATED_PASSWORD,
      "Step 4: Log in again with updated password"
    );
    // ── Step 5: Assign roles to the user ───────────────────────────────────
    await testAssignRoles(userId);
  } catch (err) {
    // Individual steps already logged their failure; we just stop the chain.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n⛔  Test run aborted: ${message}`);
  } finally {
    await cleanup(userId);
    // ── Summary ─────────────────────────────────────────────────────────────
    const total = passed + failed;
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  Results: ${passed}/${total} passed`);
    if (failed > 0) {
      console.error(`  ${failed} test(s) FAILED`);
    } else {
      console.log("  🎉  All tests passed!");
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    process.exit(failed > 0 ? 1 : 0);
  }
}
main().catch((err) => {
  console.error("❌  Unexpected fatal error:", err);
  process.exit(1);
});