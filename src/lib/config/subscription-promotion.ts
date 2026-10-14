import type { SubscriptionPlan } from "@/lib/config/subscription-plans";

export const SUBSCRIPTION_PROMOTION_ENDS_AT = new Date("2027-01-01T00:00:00.000Z");

const PROMOTIONAL_MONTHLY_PRICES: Partial<Record<SubscriptionPlan, number>> = {
  STARTER: 69,
  PREMIUM: 99,
  ENTERPRISE: 139,
};

export function getPromotionalMonthlyPrice(
  plan: SubscriptionPlan,
  regularPrice: number | null,
  now = new Date(),
) {
  const promotionalPrice = PROMOTIONAL_MONTHLY_PRICES[plan];
  if (
    now >= SUBSCRIPTION_PROMOTION_ENDS_AT ||
    regularPrice === null ||
    promotionalPrice === undefined ||
    promotionalPrice >= regularPrice
  ) {
    return null;
  }

  return promotionalPrice;
}
