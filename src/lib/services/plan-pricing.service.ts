import "server-only";
import { prisma } from "@/lib/db/prisma";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/config/subscription-plans";

export interface PlatformPlanPricing {
  key: SubscriptionPlan;
  name: string;
  monthlyPrice: number | null;
  priceLabel: string;
}

export async function getPlatformPlanPricing(): Promise<PlatformPlanPricing[]> {
  let stored: Awaited<ReturnType<typeof prisma.platformPlan.findMany>> = [];
  try {
    stored = await prisma.platformPlan.findMany();
  } catch {
    console.warn("Unable to load stored platform plan pricing; using defaults.");
    stored = [];
  }
  const amounts = new Map(stored.map((plan) => [plan.key, plan.monthlyPrice === null ? null : Number(plan.monthlyPrice)]));

  return (Object.keys(SUBSCRIPTION_PLANS) as SubscriptionPlan[]).map((key) => {
    const fallback = SUBSCRIPTION_PLANS[key].monthlyPrice;
    const monthlyPrice = amounts.has(key) ? amounts.get(key) ?? null : fallback;
    return {
      key,
      name: SUBSCRIPTION_PLANS[key].name,
      monthlyPrice,
      priceLabel: monthlyPrice === null ? "Custom pricing" : `GHS ${monthlyPrice.toLocaleString("en-GH")} / month`,
    };
  });
}