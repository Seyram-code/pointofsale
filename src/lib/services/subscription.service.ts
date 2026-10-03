import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getPlanLabel, getPlanLimits, normalizePlanKey } from "@/lib/config/plan-features";
import { getPlanFeatureStatus } from "@/lib/config/platform-features";
import type { SubscriptionPlan } from "@/lib/config/subscription-plans";

const ACCESSIBLE_STATUSES = new Set(["TRIALING", "ACTIVE"]);

export async function hasSubscriptionAccess(storeId: string) {
  const subscription = await prisma.storeSubscription.findFirst({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    select: { status: true, currentPeriodEnd: true, store: { select: { isActive: true } } },
  });

  return Boolean(
    subscription &&
      subscription.store.isActive &&
      ACCESSIBLE_STATUSES.has(subscription.status) &&
      subscription.currentPeriodEnd >= new Date(),
  );
}

/** Number of days before `currentPeriodEnd` that the dashboard starts warning. */
export const SUBSCRIPTION_EXPIRY_WARNING_DAYS = 5;

export interface SubscriptionStatusInfo {
  plan: string;
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";
  currentPeriodEnd: Date;
  daysLeft: number;
  expired: boolean;
  expiringSoon: boolean;
}

/**
 * Read-only snapshot for the store dashboard banner. `EXPIRED` is derived from
 * `currentPeriodEnd` because the stored status is not mutated when a period lapses
 * (run `npm run subscriptions:expire` to persist it for reporting).
 */
export async function getSubscriptionStatus(
  storeId: string,
  warningDays = SUBSCRIPTION_EXPIRY_WARNING_DAYS,
): Promise<SubscriptionStatusInfo | null> {
  const subscription = await prisma.storeSubscription.findFirst({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    select: { plan: true, status: true, currentPeriodEnd: true },
  });
  if (!subscription) return null;

  const now = new Date();
  const canceled = subscription.status === "CANCELED";
  const expired = !canceled && subscription.currentPeriodEnd < now;
  const daysLeft = Math.max(0, Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / 86_400_000));
  const expiringSoon = !expired && !canceled && daysLeft <= warningDays;

  return {
    plan: subscription.plan,
    status: expired ? "EXPIRED" : subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    daysLeft,
    expired,
    expiringSoon,
  };
}

export type PlanFeatureKey = "customers" | "suppliers" | "returns" | "scannerOnPos" | "scannerOutsidePos" | "offlinePos";

export interface StorePlanInfo {
  plan: SubscriptionPlan;
  planLabel: string;
  status: string;
  /** Effective feature limits for the store's current package. */
  limits: ReturnType<typeof getPlanLimits>;
}

/** Latest subscription row plus the effective limits for the store's package. */
export async function getStorePlan(storeId: string): Promise<StorePlanInfo> {
  const subscription = await prisma.storeSubscription.findFirst({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    select: { plan: true, status: true },
  });
  const key = normalizePlanKey(subscription?.plan);
  return {
    plan: key,
    planLabel: getPlanLabel(key),
    status: subscription?.status ?? "NONE",
    limits: getPlanLimits(key),
  };
}

/**
 * Whether the store's package unlocks a gated feature. Returns a copy-friendly
 * "upgrade to X" hint so APIs and pages can tell Starter shops what to do.
 */
export async function requirePlanFeature(
  storeId: string,
  feature: PlanFeatureKey,
): Promise<{ allowed: true; planLabel: string } | { allowed: false; planLabel: string; message: string }> {
  const info = await getStorePlan(storeId);
  const allowed = feature === "offlinePos"
    ? getPlanFeatureStatus(info.plan, feature)
    : info.limits[feature];
  if (allowed) return { allowed: true, planLabel: info.planLabel };
  const featureName =
    feature === "customers"
      ? "the customers page"
      : feature === "suppliers"
        ? "the suppliers page"
        : feature === "returns"
          ? "the returns page"
          : feature === "scannerOnPos"
            ? "camera and barcode scanning on the sales page"
            : feature === "scannerOutsidePos"
              ? "camera and barcode scanning outside the sales page"
              : "Offline POS";
  return {
    allowed: false,
    planLabel: info.planLabel,
    message: `Your ${info.planLabel} plan does not include ${featureName}. Upgrade your package to unlock it.`,
  };
}