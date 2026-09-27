import { authorize } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { MOMO_NETWORK_PREFIXES } from "@/lib/config/constants";
import { PaymentError } from "@/lib/payments/errors";
import { getPaymentProvider } from "@/lib/payments/registry";
import { generateStoreScopedReference } from "@/lib/services/id-registry";
import { getPlatformPlanPricing } from "@/lib/services/plan-pricing.service";
import { normalizeGhanaPhone } from "@/lib/utils/format";
import { z } from "zod";

export async function GET() {
  try {
    const session = await authorize();
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const subscription = await prisma.storeSubscription.findFirst({
      where: { storeId: session.user.storeId },
      orderBy: { createdAt: "desc" },
      select: { plan: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, trialEndsAt: true, provider: true },
    });
    if (!subscription) throw ApiError.notFound("Subscription");
    const expired = subscription.currentPeriodEnd < new Date() && subscription.status !== "CANCELED";
    return ok({ ...subscription, status: expired ? "EXPIRED" : subscription.status });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await authorize();
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const { plan, paymentMethod, paymentPhone } = z.object({
      plan: z.enum(["STARTER", "GROWTH", "ENTERPRISE"]),
      paymentMethod: z.enum(["CARD", "MOMO"]).optional(),
      paymentPhone: z.string().trim().optional(),
    }).parse(await request.json());
    const subscription = await prisma.storeSubscription.findFirst({ where: { storeId: session.user.storeId }, orderBy: { createdAt: "desc" } });
    if (!subscription) throw ApiError.notFound("Subscription");
    if (!["TRIALING", "ACTIVE"].includes(subscription.status) || subscription.currentPeriodEnd < new Date()) throw ApiError.badRequest("Renew your subscription before changing an expired plan");
    if (plan === subscription.plan) return ok({ plan: subscription.plan, status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd });

    let providerId: string | undefined;
    let externalRef: string | null = null;
    const pricing = await getPlatformPlanPricing();
    const selectedPlan = pricing.find((option) => option.key === plan);
    if (!selectedPlan) throw ApiError.badRequest("This subscription plan is unavailable");
    if (selectedPlan.monthlyPrice !== null) {
      if (!paymentMethod) throw ApiError.badRequest("Choose a payment method for this plan");
      if (paymentMethod === "MOMO" && !paymentPhone) throw ApiError.badRequest("A Mobile Money number is required");

      const provider = getPaymentProvider(paymentMethod);
      const normalizedPhone = paymentMethod === "MOMO" ? normalizeGhanaPhone(paymentPhone!) : null;
      const momoNetwork = normalizedPhone
        ? Object.entries(MOMO_NETWORK_PREFIXES).find(([, prefixes]) => prefixes.includes(normalizedPhone.slice(0, 3)))?.[0]
        : undefined;
      if (paymentMethod === "MOMO" && (!normalizedPhone || !momoNetwork)) throw ApiError.badRequest("Enter a valid Ghanaian Mobile Money number");

      let paymentResult;
      try {
        paymentResult = await provider.initiate({
          method: paymentMethod,
          amount: selectedPlan.monthlyPrice,
          currency: "GHS",
          reference: generateStoreScopedReference(session.user.storeId, "SUB", 12),
          description: `${selectedPlan.name} subscription`,
          storeId: session.user.storeId,
          cashierId: session.user.id,
          momo: paymentMethod === "MOMO" ? { network: momoNetwork as "MTN" | "VODAFONE" | "AIRTELTIGO", phone: normalizedPhone! } : undefined,
        });
      } catch (error) {
        if (error instanceof PaymentError) throw ApiError.badRequest(error.message);
        throw error;
      }
      if (paymentResult.state !== "SUCCESSFUL") throw ApiError.badRequest(paymentResult.failureReason ?? paymentResult.message ?? "Payment was not completed");
      providerId = provider.id;
      externalRef = paymentResult.externalRef;
    }

    const updated = await prisma.storeSubscription.update({ where: { id: subscription.id }, data: { plan, ...(providerId ? { provider: providerId, providerSubscriptionId: externalRef } : {}) }, select: { plan: true, status: true, currentPeriodEnd: true } });
    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}