import {
  PLAN_KEYS,
  PLAN_LIMITS,
  SELECTABLE_PLAN_KEYS,
  getPlanLimits,
  normalizePlanKey,
  type PlanKey,
} from "@/lib/config/plan-features";

/**
 * Marketing/pricing view of the four subscription packages.
 *
 * Feature access and staff limits live in `plan-features.ts`
 * (`getPlanLimits`); this map only carries display + billing data so the
 * two can never drift apart.
 */
export const SUBSCRIPTION_PLANS: Record<
  PlanKey,
  { name: string; monthlyPrice: number | null; price: string; description: string; maxStaff: number | null; features: string[] }
> = {
  TRIAL: {
    name: "Trial",
    monthlyPrice: null,
    price: "Free for 14 days",
    description: "Try every MyPOS feature free for 14 days.",
    maxStaff: PLAN_LIMITS.TRIAL.maxStaff,
    features: [...PLAN_LIMITS.TRIAL.features],
  },
  STARTER: {
    name: "Starter",
    monthlyPrice: 99,
    price: "GHS 99 / month",
    description: "For small shops getting organised.",
    maxStaff: PLAN_LIMITS.STARTER.maxStaff,
    features: [...PLAN_LIMITS.STARTER.features],
  },
  PREMIUM: {
    name: "Premium",
    monthlyPrice: 130,
    price: "GHS 130 / month",
    description: "For growing supermarkets and teams.",
    maxStaff: PLAN_LIMITS.PREMIUM.maxStaff,
    features: [...PLAN_LIMITS.PREMIUM.features],
  },
  ENTERPRISE: {
    name: "Enterprise",
    monthlyPrice: 170,
    price: "GHS 170 / month",
    description: "Every feature, without restrictions.",
    maxStaff: PLAN_LIMITS.ENTERPRISE.maxStaff,
    features: [...PLAN_LIMITS.ENTERPRISE.features],
  },
};

export type SubscriptionPlan = PlanKey;

/** Plans a shop can pick when self-registering or switching plan. */
export const SELECTABLE_SUBSCRIPTION_PLANS = SELECTABLE_PLAN_KEYS;

export { PLAN_KEYS, SELECTABLE_PLAN_KEYS, getPlanLimits, normalizePlanKey };
export type { PlanKey };

export function getSubscriptionPlan(plan: string) {
  const key = normalizePlanKey(plan);
  return { key, ...SUBSCRIPTION_PLANS[key] };
}

export function getSubscriptionMonthlyPrice(plan: string | null | undefined) {
  return getSubscriptionPlan(plan ?? "STARTER").monthlyPrice ?? 0;
}
