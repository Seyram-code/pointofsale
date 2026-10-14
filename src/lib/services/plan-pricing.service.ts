import "server-only";
import { prisma } from "@/lib/db/prisma";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/config/subscription-plans";
import { getPromotionalMonthlyPrice, SUBSCRIPTION_PROMOTION_ENDS_AT } from "@/lib/config/subscription-promotion";

export interface PlatformPlanPricing {
  key: SubscriptionPlan;
  name: string;
  monthlyPrice: number | null;
  regularMonthlyPrice: number | null;
  promotionEndsAt: string | null;
  priceLabel: string;
}

export async function getPlatformPlanPricing(): Promise<PlatformPlanPricing[]> {
  let stored: Awaited<ReturnType<typeof prisma.platformPlan.findMany>> = [];
  const timeoutMs = Number(process.env.PLATFORM_PLAN_PRICING_TIMEOUT_MS ?? 1500);

  try {
    stored = await new Promise<Awaited<ReturnType<typeof prisma.platformPlan.findMany>>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Platform plan pricing lookup timed out.")), timeoutMs);

      prisma.platformPlan
        .findMany()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  } catch (error) {
    console.warn("Unable to load stored platform plan pricing; using defaults.", error instanceof Error ? error.message : error);
  }

  const amounts = new Map(stored.map((plan) => [plan.key, plan.monthlyPrice === null ? null : Number(plan.monthlyPrice)]));

  return (Object.keys(SUBSCRIPTION_PLANS) as SubscriptionPlan[]).map((key) => {
    const regularMonthlyPrice = amounts.has(key) ? amounts.get(key) ?? null : SUBSCRIPTION_PLANS[key].monthlyPrice;
    const promotionalPrice = getPromotionalMonthlyPrice(key, regularMonthlyPrice);
    const monthlyPrice = promotionalPrice ?? regularMonthlyPrice;
    return {
      key,
      name: SUBSCRIPTION_PLANS[key].name,
      monthlyPrice,
      regularMonthlyPrice,
      promotionEndsAt: promotionalPrice === null ? null : SUBSCRIPTION_PROMOTION_ENDS_AT.toISOString(),
      // Only the trial package is unbilled; every paid package has a real amount.
      priceLabel:
        monthlyPrice === null
          ? key === "TRIAL"
            ? "Free for 14 days"
            : "Custom pricing"
          : `GHS ${monthlyPrice.toLocaleString("en-GH")} / month`,
    };
  });
}