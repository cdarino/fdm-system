"use server";

import { getUserInfo } from "@/lib/user";
import { hasPermission } from "@/lib/permissions";

export async function getAuthorizedCaller(): Promise<
  { id: string } | { error: string }
> {
  const user = await getUserInfo();

  if (!user) {
    return { error: "You must be logged in to perform this action." };
  }

  const allowed = await hasPermission("system.create", user.id);
  if (!allowed) {
    return {
      error: "Access denied. You do not have permission to manage this resource.",
    };
  }

  return { id: user.id };
}

export async function requirePermission(permissionName: string): Promise<string> {
  const user = await getUserInfo();
  if (!user) {
    throw new Error("Unauthorized: You must be logged in to perform this action.");
  }

  const allowed = await hasPermission(permissionName, user.id);
  if (!allowed) {
    throw new Error(`Forbidden: You do not have permission '${permissionName}'.`);
  }

  return user.id;
}

// TBD: we could also give ONLY read access to property and users, instead of having ANY
export async function requireAnyPermission(permissionNames: string[]): Promise<string> {
  const user = await getUserInfo();
  if (!user) {
    throw new Error("Unauthorized: You must be logged in to perform this action.");
  }

  for (const name of permissionNames) {
    const allowed = await hasPermission(name, user.id);
    if (allowed) return user.id;
  }

  throw new Error(`Forbidden: You do not have any of the required permissions: ${permissionNames.join(", ")}`);
}

