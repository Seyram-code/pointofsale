import { ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { z } from "zod";

const TRIAL_LENGTH_MS = 14 * 24 * 60 * 60 * 1000;

const actionSchema = z.object({
  action: z.enum(["activate", "suspend", "cancel", "change_plan"]),
  plan: z.enum(["TRIAL", "STARTER", "PREMIUM", "ENTERPRISE"]).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ storeId: string }> },
) {
  try {
    const session = await getSession();
    if (!session) throw new UnauthorizedError();
    if (session.user.role !== "SUPER_ADMIN") throw new ForbiddenError("Only the super admin can manage registered businesses");

    const { storeId } = await params;
    const input = actionSchema.parse(await request.json());
    if (input.action === "change_plan" && !input.plan) throw ApiError.badRequest("A subscription plan is required");

    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, name: true, isActive: true } });
    if (!store) throw ApiError.notFound("Business");

    const subscription = await prisma.storeSubscription.findFirst({
      where: { storeId },
      orderBy: { createdAt: "desc" },
    });
    if (!subscription) throw ApiError.notFound("Business subscription");

    const now = new Date();
    // Assigning a plan is how the platform issues a subscription, so no payment
    // is collected here — the change is applied immediately.
    const periodExpired = subscription.currentPeriodEnd < now;
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;
    let trialEndsAt: Date | null | undefined;

    const changes: Record<string, { from: string | boolean; to: string | boolean }> = {};
    const data = {
      storeActive: store.isActive,
      subscriptionStatus: subscription.status,
      plan: subscription.plan,
    };

    if (input.action === "activate") {
      data.storeActive = true;
      data.subscriptionStatus = subscription.status === "CANCELED" ? "ACTIVE" : subscription.status;
      changes.isActive = { from: store.isActive, to: true };
      if (subscription.status === "CANCELED") changes.status = { from: subscription.status, to: "ACTIVE" };
    } else if (input.action === "suspend") {
      data.storeActive = false;
      changes.isActive = { from: store.isActive, to: false };
    } else if (input.action === "cancel") {
      data.storeActive = false;
      data.subscriptionStatus = "CANCELED";
      changes.isActive = { from: store.isActive, to: false };
      changes.status = { from: subscription.status, to: "CANCELED" };
    } else if (input.plan) {
      data.plan = input.plan;
      changes.plan = { from: subscription.plan, to: input.plan };

      // Issuing a plan always re-activates the subscription.
      const isTrial = input.plan === "TRIAL";
      const nextStatus = isTrial ? ("TRIALING" as const) : ("ACTIVE" as const);
      data.subscriptionStatus = nextStatus;
      if (subscription.status !== nextStatus) changes.status = { from: subscription.status, to: nextStatus };

      if (isTrial) {
        // A trial always starts a fresh 14-day window from today.
        periodStart = now;
        trialEndsAt = new Date(now.getTime() + TRIAL_LENGTH_MS);
        periodEnd = trialEndsAt;
      } else if (periodExpired) {
        // A lapsed period needs covering before paid access can resume.
        periodStart = now;
        const end = new Date(periodStart);
        end.setMonth(end.getMonth() + 1);
        periodEnd = end;
        trialEndsAt = null;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.store.update({ where: { id: storeId }, data: { isActive: data.storeActive } });
      const updatedSubscription = await tx.storeSubscription.update({
        where: { id: subscription.id },
        data: {
          status: data.subscriptionStatus,
          plan: data.plan,
          ...(periodStart ? { currentPeriodStart: periodStart } : {}),
          ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
          ...(trialEndsAt !== undefined ? { trialEndsAt } : {}),
          canceledAt: input.action === "cancel" ? new Date() : input.action === "change_plan" || input.action === "activate" ? null : subscription.canceledAt,
        },
        select: { plan: true, status: true, currentPeriodStart: true, currentPeriodEnd: true },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          userId: session.user.id,
          action: "UPDATE",
          entity: "StoreSubscription",
          entityId: subscription.id,
          summary: `${input.action.replace("_", " ")} business ${store.name}`,
          changes,
        },
      });

      return { isActive: data.storeActive, subscription: updatedSubscription };
    });

    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
