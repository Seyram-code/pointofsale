import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission, type Permission } from "@/lib/auth/permissions";
import type { AuthenticatedSession } from "@/lib/auth/types";

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertStoreScope(session: AuthenticatedSession, storeId: string | null, resource = "record") {
  if (!session.user.storeId) throw new ForbiddenError("This account is not linked to a business store");
  if (!storeId || session.user.storeId !== storeId) {
    throw new ForbiddenError(`This ${resource} belongs to another store`);
  }
}

export function assertBusinessScope(session: AuthenticatedSession, businessId: string | null, resource = "record") {
  if (!session.user.businessId) throw new ForbiddenError("This account is not linked to a business");
  if (!businessId || session.user.businessId !== businessId) {
    throw new ForbiddenError(`This ${resource} belongs to another business`);
  }
}

/** For server components — redirects to the login page when unauthenticated. */
export async function requireSession(returnTo?: string): Promise<AuthenticatedSession> {
  const session = await getSession();
  if (!session) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  }
  return session;
}

export async function requirePermission(
  permission: Permission | Permission[],
  returnTo?: string,
): Promise<AuthenticatedSession> {
  const session = await requireSession(returnTo);
  if (!hasPermission(session.user.permissions, permission)) {
    redirect("/forbidden");
  }
  return session;
}

/** For route handlers — throws instead of redirecting so the API can return JSON. */
export async function authorize(
  permission?: Permission | Permission[],
  options: { any?: boolean } = {},
): Promise<AuthenticatedSession> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  if (!session.user.storeId) throw new ForbiddenError("This account is not linked to a business store");
  if (!session.user.businessId) throw new ForbiddenError("This account is not linked to a business");
  if (!permission) return session;

  const list = Array.isArray(permission) ? permission : [permission];
  const ok = options.any
    ? hasAnyPermission(session.user.permissions, list)
    : hasPermission(session.user.permissions, list);
  if (!ok) throw new ForbiddenError();
  return session;
}
