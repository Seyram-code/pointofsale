import { ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { getPaymentProvider } from "@/lib/payments/registry";
import { PaymentError } from "@/lib/payments/errors";
import { generateStoreScopedReference } from "@/lib/services/id-registry";
import { MOMO_NETWORK_PREFIXES } from "@/lib/config/constants";
import { getPlatformPlanPricing } from "@/lib/services/plan-pricing.service";
import { normalizeGhanaPhone } from "@/lib/utils/format";
import { z } from "zod";

const actionSchema = z.object({
  action: z.enum(["activate", "suspend", "cancel", "change_plan"]),
  plan: z.enum(["STARTER", "GROWTH", "ENTERPRISE"]).optional(),
  paymentMethod: z.enum(["CARD", "MOMO"]).optional(),
  paymentPhone: z.string().trim().optional(),
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

    let paymentProviderId: string | null = null;
    let paymentExternalRef: string | null = null;
    if (input.action === "change_plan" && input.plan && input.plan !== "ENTERPRISE") {
      if (!input.paymentMethod) throw ApiError.badRequest("Choose a payment method for this plan");
      if (input.paymentMethod === "MOMO" && !input.paymentPhone) throw ApiError.badRequest("A business phone number is required for Mobile Money");

      const planPricing = await getPlatformPlanPricing();
      const selectedPlan = planPricing.find((plan) => plan.key === input.plan);
      if (!selectedPlan || selectedPlan.monthlyPrice === null) throw ApiError.badRequest("This plan does not have a payable amount");

      const provider = getPaymentProvider(input.paymentMethod);
      const normalizedPhone = input.paymentMethod === "MOMO" ? normalizeGhanaPhone(input.paymentPhone!) : null;
      const momoNetwork = normalizedPhone
        ? Object.entries(MOMO_NETWORK_PREFIXES).find(([, prefixes]) => prefixes.includes(normalizedPhone.slice(0, 3)))?.[0]
        : undefined;
      if (input.paymentMethod === "MOMO" && (!normalizedPhone || !momoNetwork)) throw ApiError.badRequest("Enter a valid Ghanaian Mobile Money number");
      let paymentResult;
      try {
        paymentResult = await provider.initiate({
          method: input.paymentMethod,
          amount: selectedPlan.monthlyPrice,
          currency: "GHS",
          reference: generateStoreScopedReference(storeId, "SUB", 12),
          description: `${selectedPlan.name} subscription for ${store.name}`,
          storeId,
          cashierId: session.user.id,
          momo: input.paymentMethod === "MOMO" ? { network: momoNetwork as "MTN" | "VODAFONE" | "AIRTELTIGO", phone: normalizedPhone! } : undefined,
        });
      } catch (error) {
        if (error instanceof PaymentError) throw ApiError.badRequest(error.message);
        throw error;
      }

      if (paymentResult.state !== "SUCCESSFUL") {
        throw ApiError.badRequest(paymentResult.failureReason ?? paymentResult.message ?? "Payment was not completed");
      }
      paymentProviderId = provider.id;
      paymentExternalRef = paymentResult.externalRef;
    }

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
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.store.update({ where: { id: storeId }, data: { isActive: data.storeActive } });
      const updatedSubscription = await tx.storeSubscription.update({
        where: { id: subscription.id },
        data: {
          status: data.subscriptionStatus,
          plan: data.plan,
          ...(paymentProviderId ? { provider: paymentProviderId, providerSubscriptionId: paymentExternalRef } : {}),
          canceledAt: input.action === "cancel" ? new Date() : input.action === "activate" ? null : subscription.canceledAt,
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
