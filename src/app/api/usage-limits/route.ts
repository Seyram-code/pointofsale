import { authorize } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { getSubscriptionPlan } from "@/lib/config/subscription-plans";
import { handleApiError, ok } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await authorize();
    if (!session.user.storeId) throw new Error("Store is required");

    const subscription = await prisma.storeSubscription.findFirst({
      where: { storeId: session.user.storeId },
      orderBy: { createdAt: "desc" },
      select: { plan: true },
    });

    const plan = getSubscriptionPlan(subscription?.plan ?? "STARTER");
    const staffCount = await prisma.user.count({ where: { storeId: session.user.storeId, deletedAt: null } });

    return ok({
      plan: plan.name,
      maxStaff: plan.maxStaff,
      staffCount,
      staffRemaining: plan.maxStaff === null ? null : Math.max(plan.maxStaff - staffCount, 0),
      offlinePosEnabled: plan.maxStaff === null || plan.maxStaff >= 4,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
