export const SUBSCRIPTION_PLANS = {
  STARTER: {
    name: "Starter",
    monthlyPrice: 99,
    price: "GHS 99 / month",
    description: "For small shops getting organised.",
    maxStaff: 2,
    features: ["1 shop portal", "Up to 2 staff accounts", "POS checkout and receipts", "Product and inventory management", "Daily sales reports"],
  },
  GROWTH: {
    name: "Growth",
    monthlyPrice: 199,
    price: "GHS 199 / month",
    description: "For growing supermarkets and teams.",
    maxStaff: 4,
    features: ["1 shop portal", "Up to 4 staff accounts", "Cash, MoMo and card payments", "Purchase orders and suppliers", "Advanced reports and audit logs"],
  },
  ENTERPRISE: {
    name: "Enterprise",
    monthlyPrice: null,
    price: "Custom pricing",
    description: "For larger retail operations.",
    maxStaff: null,
    features: ["Unlimited staff accounts", "Custom retail workflows", "Advanced permissions and reporting", "Multi-branch support planning", "Priority onboarding and support"],
  },
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS;

export function getSubscriptionPlan(plan: string) {
  return SUBSCRIPTION_PLANS[plan as SubscriptionPlan] ?? SUBSCRIPTION_PLANS.STARTER;
}

export function getSubscriptionMonthlyPrice(plan: string | null | undefined) {
  return getSubscriptionPlan(plan ?? "STARTER").monthlyPrice ?? 0;
}