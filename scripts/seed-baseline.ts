/**
 * scripts/seed-baseline.ts
 *
 * Seeds baseline data into Supabase:
 * - Creates (or finds) the superadmin user via Supabase Admin API.
 * - Ensures the `system_admin` role from rbac.role is assigned via rbac.user_role.
 *
 * Can be imported as a module or executed directly via CLI:
 *   npx tsx --env-file=.env.local scripts/seed-baseline.ts
 */

import { createClient } from "@supabase/supabase-js";

export interface SeedBaselineOptions {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  adminEmail?: string;
  adminPassword?: string;
}

export async function seedBaseline(options: SeedBaselineOptions = {}): Promise<{ userId: string; email: string }> {
  const supabaseUrl = options.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = options.serviceRoleKey ?? process.env.SUPABASE_SECRET_KEY;
  const adminPassword = options.adminPassword ?? process.env.ADMIN_PASSWORD;
  const adminEmail = options.adminEmail ?? process.env.ADMIN_EMAIL ?? "admin@example.com";

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SECRET_KEY");
  if (!adminPassword) missing.push("ADMIN_PASSWORD");

  if (missing.length > 0) {
    throw new Error(
      `❌  Missing required environment variables:\n` +
      missing.map((v) => `    ${v}`).join("\n")
    );
  }

  const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const adminRoles = ["system_admin"];

  console.log(`\n🌱  Seeding baseline superadmin: ${adminEmail}`);

  // 1. Create (or retrieve existing) user via Admin API.
  let userId: string;

  const { data: createData, error: createError } =
    await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

  if (createError) {
    if (createError.message.toLowerCase().includes("already been registered")) {
      console.log("ℹ️   User already exists — fetching existing user...");

      const { data: listData, error: listError } =
        await supabase.auth.admin.listUsers();

      if (listError) {
        throw new Error(`Failed to list users: ${listError.message}`);
      }

      const existing = listData.users.find((u) => u.email === adminEmail);
      if (!existing) {
        throw new Error(`Could not find existing user for ${adminEmail} after conflict.`);
      }

      userId = existing.id;
      console.log(`✅  Found existing user: ${userId} (password unchanged)`);
    } else {
      throw new Error(`Failed to create user: ${createError.message}`);
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
    .in("name", adminRoles);

  if (rolesError) {
    throw new Error(`Failed to fetch roles: ${rolesError.message}`);
  }

  const foundRoleNames = roles?.map((r) => r.name) ?? [];
  const missingRoles = adminRoles.filter((r) => !foundRoleNames.includes(r));

  if (missingRoles.length > 0) {
    throw new Error(
      `The following roles were not found in rbac.role: ${missingRoles.join(", ")}\n` +
      "Make sure migrations have been applied (npx supabase db push)."
    );
  }

  console.log(`✅  Resolved roles: ${foundRoleNames.join(", ")}`);

  // 3. Remove stale role assignments if present
  const systemAdminRoleId = roles!.find((r) => r.name === "system_admin")!.id;
  const { error: deleteError } = await supabase
    .schema("rbac")
    .from("user_role")
    .delete()
    .eq("user_id", userId)
    .neq("role_id", systemAdminRoleId);

  if (deleteError) {
    throw new Error(`Failed to clean up roles: ${deleteError.message}`);
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
    throw new Error(`Failed to assign roles: ${insertError.message}`);
  }

  console.log(`✅  Assigned roles [${adminRoles.join(", ")}] to ${adminEmail}`);
  console.log("🎉  Baseline seed complete!\n");

  return { userId, email: adminEmail };
}

async function main() {
  try {
    await seedBaseline();
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error("❌  Unexpected error:", err);
    }
    process.exit(1);
  }
}

if (process.argv[1]?.includes("seed-baseline")) {
  main();
}

