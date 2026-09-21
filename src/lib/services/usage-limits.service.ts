import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getSubscriptionPlan } from "@/lib/config/subscription-plans";

export type UsageMetric = "staff_count" | "branches" | "offline_sync_minutes" | "reports_exports";

const DEFAULT_LIMITS: Record<string, { max: number | null }> = {
  STARTER: { max: 2 },
  GROWTH: { max: 4 },
  ENTERPRISE: { max: null },
};

export async function getStoreUsageStatus(storeId: string) {
  const subscription = await prisma.storeSubscription.findFirst({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    select: { plan: true },
  });

  const plan = getSubscriptionPlan(subscription?.plan ?? "STARTER");
  const staffCount = await prisma.user.count({ where: { storeId, deletedAt: null } });

  return {
    planName: plan.name,
    maxStaff: plan.maxStaff,
    currentStaff: staffCount,
    allowedStaff: plan.maxStaff === null || staffCount < plan.maxStaff,
    maxBranches: plan.maxStaff === null ? null : 1,
    currentBranches: 1,
    offlineModeEnabled: plan.maxStaff === null || plan.maxStaff >= 4,
  };
}

export async function enforceUsageLimit(storeId: string, metric: UsageMetric) {
  const subscription = await prisma.storeSubscription.findFirst({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    select: { plan: true },
  });

  const planKey = (subscription?.plan ?? "STARTER").toUpperCase();
  const planDefaults = DEFAULT_LIMITS[planKey] ?? DEFAULT_LIMITS.STARTER;

  if (metric === "staff_count") {
    const currentValue = await prisma.user.count({ where: { storeId, deletedAt: null } });
    const maxValue = planDefaults.max;
    if (maxValue !== null && currentValue > maxValue) {
      throw new Error(`Your ${planKey.toLowerCase()} plan allows up to ${maxValue} staff accounts. Upgrade your plan to add more.`);
    }
  }

  await prisma.usageLimit.upsert({
    where: { storeId_metric: { storeId, metric } },
    update: { currentValue: metric === "staff_count" ? await prisma.user.count({ where: { storeId, deletedAt: null } }) : 0, maxValue: planDefaults.max ?? null },
    create: { storeId, metric, currentValue: metric === "staff_count" ? await prisma.user.count({ where: { storeId, deletedAt: null } }) : 0, maxValue: planDefaults.max ?? null },
  });
}
