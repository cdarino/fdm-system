import "./vitest.setup";
import { createClient } from "@supabase/supabase-js";
import { login, logout } from "@/lib/auth";
import { clearCookieJar } from "./vitest.setup";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin";
const ADMIN_EMAIL = "admin@example.com";

export function getTestAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const cleanupStack: Array<() => Promise<void>> = [];

export function trackCleanup(cleanupFn: () => Promise<void>) {
  cleanupStack.push(cleanupFn);
}

export async function runTrackedCleanups() {
  while (cleanupStack.length > 0) {
    const fn = cleanupStack.pop();
    if (fn) {
      try {
        await fn();
      } catch (err) {
        console.warn("Cleanup error:", err instanceof Error ? err.message : err);
      }
    }
  }
}

export async function loginAsAdmin() {
  clearCookieJar();
  return login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
}

export async function loginAs(email: string, password: string) {
  clearCookieJar();
  return login({ email, password });
}

export async function logoutUser() {
  try {
    await logout();
  } catch {
    // Ignore error if already signed out
  }
  clearCookieJar();
}

export interface TemporaryUserOptions {
  emailPrefix?: string;
  roleNames?: string[];
  password?: string;
  firstName?: string;
  lastName?: string;
}

export interface TemporaryUser {
  id: string;
  email: string;
  password: string;
  roleNames: string[];
  cleanup: () => Promise<void>;
}

export async function createTemporaryUser(
  options: TemporaryUserOptions = {}
): Promise<TemporaryUser> {
  const adminClient = getTestAdminClient();
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);
  const email = `${options.emailPrefix ?? "test-user"}-${timestamp}-${rand}@example.com`;
  const password = options.password ?? `TempPass-${timestamp}!`;
  const firstName = options.firstName ?? "Temp";
  const lastName = options.lastName ?? `User-${rand}`;
  const roleNames = options.roleNames ?? [];

  const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  });

  if (createError || !userData?.user) {
    throw new Error(`Failed to create temporary user: ${createError?.message}`);
  }

  const userId = userData.user.id;

  // Resolve and assign requested RBAC roles
  if (roleNames.length > 0) {
    const { data: roles, error: rolesError } = await adminClient
      .schema("rbac")
      .from("role")
      .select("id, name")
      .in("name", roleNames);

    if (rolesError) {
      throw new Error(`Failed to lookup roles [${roleNames.join(", ")}]: ${rolesError.message}`);
    }

    if (roles && roles.length > 0) {
      const rows = roles.map((r) => ({ user_id: userId, role_id: r.id }));
      const { error: assignError } = await adminClient
        .schema("rbac")
        .from("user_role")
        .upsert(rows, { onConflict: "user_id,role_id" });

      if (assignError) {
        throw new Error(`Failed to assign roles to temp user: ${assignError.message}`);
      }
    }
  }

  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    await adminClient.schema("rbac").from("user_role").delete().eq("user_id", userId);
    await adminClient.auth.admin.deleteUser(userId);
  };

  trackCleanup(cleanup);

  return { id: userId, email, password, roleNames, cleanup };
}

export async function withTemporaryUser<T>(
  options: TemporaryUserOptions,
  fn: (user: TemporaryUser) => Promise<T>
): Promise<T> {
  const user = await createTemporaryUser(options);
  try {
    await loginAs(user.email, user.password);
    return await fn(user);
  } finally {
    await logoutUser();
    await user.cleanup();
  }
}

