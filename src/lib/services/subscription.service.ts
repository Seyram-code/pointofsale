import "server-only";
import { prisma } from "@/lib/db/prisma";

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