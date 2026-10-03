import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { hashToken, signSessionToken, verifySessionToken } from "@/lib/auth/jwt";
import { resolvePermissions } from "@/lib/auth/permissions";
import { getPlanLimits, normalizePlanKey } from "@/lib/config/plan-features";
import type { AuthenticatedSession, SessionUser } from "@/lib/auth/types";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "mypos_session";
const TTL_HOURS = Number(process.env.AUTH_SESSION_TTL_HOURS ?? 12);
const REMEMBERED_TTL_HOURS = 24 * 14;

export function sessionCookieName() {
  return COOKIE_NAME;
}

export async function createSession(
  userId: string,
  context: { ipAddress?: string | null; userAgent?: string | null; rememberDevice?: boolean } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      storeId: true,
      store: { select: { id: true, businessId: true } },
    },
  });

  const ttlHours = context.rememberDevice ? REMEMBERED_TTL_HOURS : TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  // The row is created first so its id can be embedded in the token claims.
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: `pending:${crypto.randomUUID()}`,
      expiresAt,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
    select: { id: true },
  });

  const token = await signSessionToken(
    { sub: user.id, sid: session.id, role: user.role, storeId: user.storeId, businessId: user.store?.businessId ?? null },
    expiresAt,
  );

  await prisma.session.update({
    where: { id: session.id },
    data: { tokenHash: await hashToken(token) },
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return { token, expiresAt };
}

/** Resolves the current session, deduped per request. Returns null when unauthenticated. */
export const getSession = cache(async (): Promise<AuthenticatedSession | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const record = await prisma.session.findUnique({
    where: { id: claims.sid },
    include: {
      user: {
        include: {
          permissions: { select: { key: true, allowed: true } },
          employeeProfile: { select: { id: true } },
          store: { select: { id: true, businessId: true, name: true, businessType: true } },
        },
      },
    },
  });

  if (!record || record.revokedAt || record.expiresAt < new Date()) return null;
  if (record.tokenHash !== (await hashToken(token))) return null;
  if (record.user.status !== "ACTIVE" || record.user.deletedAt) return null;
  // NOTE: Subscription access is enforced per surface — the dashboard layout and the
  // API layer (`authorize`) — rather than here, so an expired shop can still sign in
  // and reach `/subscription` to renew. See `hasSubscriptionAccess`.

  // Effective package for plan gating in the UI. Super admins see everything;
  // a missing subscription falls back to the most restrictive package.
  let planKey = "STARTER";
  let scannerOnPos = false;
  let scannerOutsidePos = false;
  let subscriptionActive = false;
  if (record.user.role === "SUPER_ADMIN") {
    planKey = "ENTERPRISE";
    scannerOnPos = true;
    scannerOutsidePos = true;
    subscriptionActive = true;
  } else if (record.user.storeId) {
    const subscription = await prisma.storeSubscription.findFirst({
      where: { storeId: record.user.storeId },
      orderBy: { createdAt: "desc" },
      select: {
        plan: true,
        status: true,
        currentPeriodEnd: true,
        store: { select: { isActive: true } },
      },
    });
    planKey = normalizePlanKey(subscription?.plan);
    const limits = getPlanLimits(planKey);
    scannerOnPos = limits.scannerOnPos;
    scannerOutsidePos = limits.scannerOutsidePos;
    subscriptionActive = Boolean(
      subscription &&
        subscription.store.isActive &&
        (subscription.status === "TRIALING" || subscription.status === "ACTIVE") &&
        subscription.currentPeriodEnd >= new Date(),
    );
  }

  const user: SessionUser = {
    id: record.user.id,
    fullName: record.user.fullName,
    email: record.user.email,
    staffCode: record.user.staffCode,
    role: record.user.role,
    isEmployee: record.user.employeeProfile !== null,
    storeId: record.user.storeId,
    businessId: record.user.store?.businessId ?? null,
    storeName: record.user.store?.name ?? null,
    businessType: record.user.store?.businessType ?? null,
    avatarUrl: record.user.avatarUrl,
    mustChangePassword: record.user.mustChangePassword,
    permissions: resolvePermissions(record.user.role, record.user.permissions),
    plan: planKey,
    subscriptionActive,
    scannerOnPos,
    scannerOutsidePos,
  };

  return { user, sessionId: record.id, expiresAt: record.expiresAt };
});

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    const claims = await verifySessionToken(token);
    if (claims) {
      await prisma.session.updateMany({
        where: { id: claims.sid, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }
  store.delete(COOKIE_NAME);
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
