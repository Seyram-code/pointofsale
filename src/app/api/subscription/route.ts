import { authorize } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { MOMO_NETWORK_PREFIXES } from "@/lib/config/constants";
import { PaymentError } from "@/lib/payments/errors";
import { getPaymentProvider } from "@/lib/payments/registry";
import { generateStoreScopedReference } from "@/lib/services/id-registry";
import { getPlatformPlanPricing } from "@/lib/services/plan-pricing.service";
import { normalizePlanKey } from "@/lib/config/plan-features";
import { normalizeGhanaPhone } from "@/lib/utils/format";
import { isPaystackEnabled } from "@/lib/services/payment-settings.service";
import { isPaystackMethod } from "@/lib/payments/config";
import { z } from "zod";

export async function GET() {
  try {
    const session = await authorize(undefined, { allowExpiredSubscription: true });
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
    const session = await authorize(undefined, { allowExpiredSubscription: true });
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const { plan, paymentMethod, paymentPhone, paymentEmail, reference, months } = z.object({
      // Trial is granted by the platform at sign-up, so it is never purchasable.
      plan: z.enum(["STARTER", "PREMIUM", "ENTERPRISE"]),
      paymentMethod: z.enum(["CARD", "MOMO"]).optional(),
      paymentPhone: z.string().trim().optional(),
      paymentEmail: z.string().trim().email().max(254).optional(),
      reference: z.string().trim().min(1).max(100).optional(),
      months: z.coerce.number().int().min(1).max(12).default(1),
    }).parse(await request.json());
    const subscription = await prisma.storeSubscription.findFirst({ where: { storeId: session.user.storeId }, orderBy: { createdAt: "desc" } });
    if (!subscription) throw ApiError.notFound("Subscription");
    const now = new Date();
    // An ended subscription must be paid for to renew; a live one only changes plan.
    const expired = subscription.status === "CANCELED" || !["TRIALING", "ACTIVE"].includes(subscription.status) || subscription.currentPeriodEnd < now;
    // Compare against the normalised key so legacy rows (e.g. GROWTH) are not re-charged.
    const currentPlan = normalizePlanKey(subscription.plan);
    let providerId: string | undefined;
    let externalRef: string | null = null;
    const pricing = await getPlatformPlanPricing();
    const selectedPlan = pricing.find((option) => option.key === plan);
    if (!selectedPlan) throw ApiError.badRequest("This subscription plan is unavailable");
    if (plan === currentPlan && !expired && !reference && selectedPlan.monthlyPrice === null) {
      return ok({ plan: subscription.plan, status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd });
    }
    const totalPrice = selectedPlan.monthlyPrice === null ? null : selectedPlan.monthlyPrice * months;
    if (selectedPlan.monthlyPrice !== null) {
      if (!paymentMethod) throw ApiError.badRequest("Choose a payment method for this plan");
      if (!reference && paymentMethod === "MOMO" && !paymentPhone) throw ApiError.badRequest("A Mobile Money number is required");
      if (!reference && !paymentEmail) throw ApiError.badRequest("A customer email is required for Paystack checkout");

      const provider = getPaymentProvider(paymentMethod);
      if (isPaystackMethod(paymentMethod) && !(await isPaystackEnabled(session.user.storeId))) {
        throw ApiError.badRequest("Paystack payments are disabled for this shop. Choose another payment method.");
      }
      if (reference) {
        if (!provider.getStatus) throw ApiError.badRequest("This provider cannot verify hosted checkout payments");
        const verified = await provider.getStatus(reference);
        if (verified.state !== "SUCCESSFUL" || Math.abs(verified.amount - totalPrice!) >= 0.01) {
          throw ApiError.badRequest("Paystack has not confirmed the correct payment amount yet");
        }
        if (provider.id.startsWith("momo.paystack") || provider.id.startsWith("card.live")) {
          const data = (verified.raw?.data ?? {}) as Record<string, unknown>;
          const metadataValue = data.metadata;
          let metadata: Record<string, unknown> = {};
          if (typeof metadataValue === "string") {
            try {
              metadata = JSON.parse(metadataValue) as Record<string, unknown>;
            } catch {
              metadata = {};
            }
          } else if (metadataValue && typeof metadataValue === "object" && !Array.isArray(metadataValue)) {
            metadata = metadataValue as Record<string, unknown>;
          }
          const expectedChannel = paymentMethod === "MOMO" ? "mobile_money" : "card";
          const expectedReferencePrefix = `SUB${plan}M${months}-${session.user.storeId.slice(0, 8).toUpperCase()}-`;
          const metadataStore = metadata.subscription_store_id;
          const metadataPlan = metadata.subscription_plan;
          const isNewPlanScopedReference = reference.startsWith(expectedReferencePrefix);
          const isLegacyReference = reference.startsWith(`SUB-${session.user.storeId.slice(0, 8).toUpperCase()}-`) &&
            String(metadataStore ?? "") === session.user.storeId &&
            String(metadataPlan ?? "") === plan;
          const channel = String(data.channel ?? "").toLowerCase();
          const mismatches: string[] = [];
          if (String(data.currency ?? "").toUpperCase() !== "GHS") mismatches.push("currency");
          if (Number(metadata.subscription_months ?? 1) !== months) mismatches.push("subscription length");
          if (!isNewPlanScopedReference && !isLegacyReference) mismatches.push("store/plan reference");
          if (isNewPlanScopedReference && channel !== expectedChannel) mismatches.push("payment method");
          if (!isNewPlanScopedReference && !channel) mismatches.push("payment channel");
          if (metadataStore !== undefined && String(metadataStore) !== session.user.storeId) mismatches.push("store metadata");
          if (metadataPlan !== undefined && String(metadataPlan) !== plan) mismatches.push("plan metadata");
          if (mismatches.length > 0) {
            throw ApiError.badRequest(`Verified payment mismatch: ${mismatches.join(", ")}. Start a new checkout if you have not paid.`);
          }
        }
        providerId = provider.id;
        externalRef = verified.externalRef;
      } else {
      const normalizedPhone = paymentMethod === "MOMO" ? normalizeGhanaPhone(paymentPhone!) : null;
      const momoNetwork = normalizedPhone
        ? Object.entries(MOMO_NETWORK_PREFIXES).find(([, prefixes]) => prefixes.includes(normalizedPhone.slice(0, 3)))?.[0]
        : undefined;
      if (paymentMethod === "MOMO" && (!normalizedPhone || !momoNetwork)) throw ApiError.badRequest("Enter a valid Ghanaian Mobile Money number");

      let paymentResult;
      const transactionReference = generateStoreScopedReference(session.user.storeId, `SUB${plan}M${months}`, 12);
      try {
        paymentResult = await provider.initiate({
          method: paymentMethod,
          amount: totalPrice!,
          currency: "GHS",
          reference: transactionReference,
          description: `${selectedPlan.name} subscription`,
          storeId: session.user.storeId,
          cashierId: session.user.id,
          callbackUrl: `${new URL(request.url).origin}/subscription?reference=${encodeURIComponent(transactionReference)}&plan=${plan}&method=${paymentMethod}&months=${months}`,
          metadata: { subscription_store_id: session.user.storeId, subscription_plan: plan, subscription_months: String(months), payment_method: paymentMethod },
          momo: paymentMethod === "MOMO" ? { network: momoNetwork as "MTN" | "VODAFONE" | "AIRTELTIGO", phone: normalizedPhone!, email: paymentEmail } : undefined,
          card: paymentMethod === "CARD" ? { email: paymentEmail } : undefined,
        });
      } catch (error) {
        if (error instanceof PaymentError) throw ApiError.badRequest(error.message);
        throw error;
      }
      if (paymentResult.state === "PROCESSING" && paymentResult.authorizationUrl) {
        return ok({ checkoutUrl: paymentResult.authorizationUrl, reference: paymentResult.externalRef });
      }
      if (paymentResult.state !== "SUCCESSFUL") throw ApiError.badRequest(paymentResult.failureReason ?? paymentResult.message ?? "Payment was not completed");
      providerId = provider.id;
      externalRef = paymentResult.externalRef;
      }
    }

    const data: Prisma.StoreSubscriptionUpdateInput = { plan };
    if (providerId) {
      data.provider = providerId;
      data.providerSubscriptionId = externalRef;
    }
    if (providerId && selectedPlan.monthlyPrice !== null) {
      // Add the purchased duration after the current period, or from now if it has ended.
      const periodStart = subscription.status !== "TRIALING" && subscription.currentPeriodEnd > now
        ? subscription.currentPeriodEnd
        : now;
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + months);
      data.status = "ACTIVE";
      if (expired || subscription.status === "TRIALING") data.currentPeriodStart = now;
      data.currentPeriodEnd = periodEnd;
      data.canceledAt = null;
    }

    const updated = await prisma.storeSubscription.update({ where: { id: subscription.id }, data, select: { plan: true, status: true, currentPeriodEnd: true } });
    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}