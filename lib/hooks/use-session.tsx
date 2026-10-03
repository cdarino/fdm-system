"use client";

import * as React from "react";
import type { UserSession, SessionContextValue } from "@/lib/types/session";

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: UserSession;
  children: React.ReactNode;
}) {
  const value = React.useMemo<SessionContextValue>(() => {
    const roleSet = new Set(session.roles);
    const permissionSet = new Set(session.permissions);

    return {
      session,
      user: session.user,
      roles: session.roles,
      permissions: session.permissions,
      isSystemAdmin: session.isSystemAdmin,
      hasPermission: (permission: string) =>
        session.isSystemAdmin || permissionSet.has(permission),
      hasRole: (role: string) => roleSet.has(role),
    };
  }, [session]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}
