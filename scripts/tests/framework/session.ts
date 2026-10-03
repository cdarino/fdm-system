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

export async function hardDeleteTestClient(clientId: string) {
  const admin = getTestAdminClient();
  // Clean dependent rows safely in reverse dependency order
  await admin.from("land_title").delete().eq("client_id", clientId);
  await admin.from("account_party").delete().eq("client_id", clientId);
  await admin.from("client_document").delete().eq("client_id", clientId);
  await admin.from("client_log").delete().eq("client_id", clientId);
  await admin.from("contact_info").delete().eq("client_id", clientId);
  await admin.from("search_index").delete().eq("entity_type", "client_document").eq("entity_id", clientId);
  await admin.from("client").delete().eq("client_id", clientId);
}

export async function hardDeleteTestProperty(propertyId: string) {
  const admin = getTestAdminClient();
  // Clean associated ledger accounts, titles, and parties before lot deletion
  await admin.from("land_title").delete().eq("property_id", propertyId);
  const { data: accounts } = await admin.from("ledger_account").select("account_id").eq("property_id", propertyId);
  if (accounts && accounts.length > 0) {
    const accountIds = accounts.map((a) => a.account_id);
    await admin.from("account_party").delete().in("account_id", accountIds);
    await admin.from("ledger_account").delete().eq("property_id", propertyId);
  }
  await admin.from("property_lot").delete().eq("property_id", propertyId);
}

export async function hardDeleteTestSite(siteId: string) {
  const admin = getTestAdminClient();
  // Clean subdivisions and detached lots before site deletion
  await admin.from("site_subdivision").delete().eq("site_id", siteId);
  await admin.from("property_lot").delete().eq("site_id", siteId);
  await admin.from("site").delete().eq("site_id", siteId);
}

export function trackTestClient(clientId: string) {
  trackCleanup(() => hardDeleteTestClient(clientId));
}

export function trackTestProperty(propertyId: string) {
  trackCleanup(() => hardDeleteTestProperty(propertyId));
}

export function trackTestSite(siteId: string) {
  trackCleanup(() => hardDeleteTestSite(siteId));
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

