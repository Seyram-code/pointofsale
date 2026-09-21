"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/auth/types";
import type { Permission } from "@/lib/auth/permissions";

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useCurrentUser(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useCurrentUser must be used within a SessionProvider");
  return user;
}

export function usePermission() {
  const user = useCurrentUser();
  return {
    can: (permission: Permission) => user.permissions.includes(permission),
    canAny: (permissions: Permission[]) => permissions.some((p) => user.permissions.includes(p)),
    canAll: (permissions: Permission[]) => permissions.every((p) => user.permissions.includes(p)),
  };
}
