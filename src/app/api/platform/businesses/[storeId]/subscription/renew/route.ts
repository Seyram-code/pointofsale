import { ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ storeId: string }> },
) {
  try {
    const session = await getSession();
    if (!session) throw new UnauthorizedError();
    if (session.user.role !== "SUPER_ADMIN") throw new ForbiddenError("Only the super admin can renew business subscriptions");

    const { storeId } = await params;
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, name: true } });
    if (!store) throw ApiError.notFound("Business");

    const subscription = await prisma.storeSubscription.findFirst({
      where: { storeId },
      orderBy: { createdAt: "desc" },
    });
    if (!subscription) throw ApiError.notFound("Business subscription");

    const now = new Date();
    const periodStart = subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const renewed = await prisma.$transaction(async (tx) => {
      const updated = await tx.storeSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "ACTIVE",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          canceledAt: null,
        },
        select: {
          plan: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
        },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          userId: session.user.id,
          action: "UPDATE",
          entity: "StoreSubscription",
          entityId: subscription.id,
          summary: `Renewed subscription for ${store.name}`,
          changes: {
            status: { from: subscription.status, to: updated.status },
            currentPeriodStart: { from: subscription.currentPeriodStart.toISOString(), to: periodStart.toISOString() },
            currentPeriodEnd: { from: subscription.currentPeriodEnd.toISOString(), to: periodEnd.toISOString() },
          },
        },
      });

      return updated;
    });

    return ok(renewed);
  } catch (error) {
    return handleApiError(error);
  }
}
