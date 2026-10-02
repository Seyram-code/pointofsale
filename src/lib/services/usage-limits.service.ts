import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getPlanLimits } from "@/lib/config/plan-features";

export type UsageMetric = "staff_count" | "branches" | "offline_sync_minutes" | "reports_exports";

export async function getStoreUsageStatus(storeId: string) {
  const subscription = await prisma.storeSubscription.findFirst({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    select: { plan: true },
  });

  const limits = getPlanLimits(subscription?.plan ?? "STARTER");
  const staffCount = await prisma.user.count({ where: { storeId, deletedAt: null } });

  return {
    planName: limits.label,
    maxStaff: limits.maxStaff,
    currentStaff: staffCount,
    allowedStaff: limits.maxStaff === null || staffCount < limits.maxStaff,
    maxBranches: limits.maxStaff === null ? null : 1,
    currentBranches: 1,
    offlineModeEnabled: true,
  };
}

export async function enforceUsageLimit(storeId: string, metric: UsageMetric) {
  const subscription = await prisma.storeSubscription.findFirst({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    select: { plan: true },
  });

  const limits = getPlanLimits(subscription?.plan ?? "STARTER");

  if (metric === "staff_count") {
    const currentValue = await prisma.user.count({ where: { storeId, deletedAt: null } });
    const maxValue = limits.maxStaff;
    if (maxValue !== null && currentValue > maxValue) {
      throw new Error(
        `Your ${limits.label} plan allows up to ${maxValue} staff account${maxValue === 1 ? "" : "s"}. Upgrade your plan to add more.`,
      );
    }
  }

  await prisma.usageLimit.upsert({
    where: { storeId_metric: { storeId, metric } },
    update: { currentValue: metric === "staff_count" ? await prisma.user.count({ where: { storeId, deletedAt: null } }) : 0, maxValue: limits.maxStaff ?? null },
    create: { storeId, metric, currentValue: metric === "staff_count" ? await prisma.user.count({ where: { storeId, deletedAt: null } }) : 0, maxValue: limits.maxStaff ?? null },
  });
}
