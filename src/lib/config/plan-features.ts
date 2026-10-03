/**
 * Single source of truth for what each subscription package unlocks.
 *
 * Used on the server (`getPlanLimits`/`hasPlanFeature`) and indirectly on the client,
 * via the session payload, so the UI can hide or lock gated features.
 *
 * Legacy plan names (GROWTH, PROFESSIONAL) are mapped onto the current packages so
 * existing rows keep their data — see `normalizePlanKey`.
 */
export type PlanKey = "TRIAL" | "STARTER" | "PREMIUM" | "ENTERPRISE";

export const PLAN_KEYS: PlanKey[] = ["TRIAL", "STARTER", "PREMIUM", "ENTERPRISE"];

/** Plans a shopper can pick when self-registering. */
export const SELECTABLE_PLAN_KEYS: PlanKey[] = ["STARTER", "PREMIUM", "ENTERPRISE"];

export type ReportPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface PlanLimits {
  label: string;
  /** Marketing blurb. */
  description: string;
  /**
   * Monthly amount in GHS. `null` means the package is not billed: only the
   * Trial package, which is free for its first 14 days.
   */
  monthlyPrice: number | null;
  /** Marketing bullet list. */
  features: string[];
  /** Max active staff accounts, or `null` for unlimited. */
  maxStaff: number | null;
  /** Whether the customer records page/API is available. */
  customers: boolean;
  /** Whether the supplier records page/API is available. */
  suppliers: boolean;
  /** Whether the returns page/API is available. */
  returns: boolean;
  /**
   * Whether camera/hardware barcode scanning may be used on the sales
   * (POS) page. Starter has no scanning at all; Premium unlocks it here.
   */
  scannerOnPos: boolean;
  /**
   * Whether camera scanning may be used outside the sales page (for
   * example the product create/edit barcode buttons). Only Trial (to let
   * shops try everything) and Enterprise unlock this.
   */
  scannerOutsidePos: boolean;
  /**
   * Reporting: the plan may query daily/weekly breakdowns plus a custom
   * range of up to roughly one month (31 days). `false` means full,
   * unrestricted history.
   */
  oneMonthReportsOnly: boolean;
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  TRIAL: {
    label: "Trial",
    description: "Try every VidyPOS feature free for 14 days.",
    monthlyPrice: null,
    features: [
      "14-day full-feature trial",
      "1 staff account",
      "POS checkout and receipts",
      "Products, inventory and customers",
      "Suppliers, returns and reports",
      "Camera and barcode scanning",
    ],
    maxStaff: 1,
    customers: true,
    suppliers: true,
    returns: true,
    scannerOnPos: true,
    scannerOutsidePos: true,
    oneMonthReportsOnly: false,
  },
  STARTER: {
    label: "Starter",
    description: "For small shops getting organised.",
    monthlyPrice: 99,
    features: [
      "1 staff account",
      "POS checkout and receipts",
      "Products and inventory",
      "Sales records",
      "One-month reports",
    ],
    maxStaff: 1,
    customers: false,
    suppliers: false,
    returns: false,
    scannerOnPos: false,
    scannerOutsidePos: false,
    oneMonthReportsOnly: true,
  },
  PREMIUM: {
    label: "Premium",
    description: "For growing supermarkets and teams.",
    monthlyPrice: 130,
    features: [
      "Up to 3 staff accounts",
      "Customers and suppliers",
      "Returns and refunds",
      "Camera and barcode scanning on the sales page",
      "Unlimited reports",
    ],
    maxStaff: 3,
    customers: true,
    suppliers: true,
    returns: true,
    scannerOnPos: true,
    scannerOutsidePos: false,
    oneMonthReportsOnly: false,
  },
  ENTERPRISE: {
    label: "Enterprise",
    description: "Every feature, without restrictions.",
    monthlyPrice: 170,
    features: [
      "Unlimited staff accounts",
      "Every feature, no restrictions",
      "Customers, suppliers and returns",
      "Camera and barcode scanning everywhere",
      "Unlimited reports",
    ],
    maxStaff: null,
    customers: true,
    suppliers: true,
    returns: true,
    scannerOnPos: true,
    scannerOutsidePos: true,
    oneMonthReportsOnly: false,
  },
};

const LEGACY_PLAN_ALIASES: Record<string, PlanKey> = {
  TRIAL: "TRIAL",
  STARTER: "STARTER",
  PREMIUM: "PREMIUM",
  ENTERPRISE: "ENTERPRISE",
  GROWTH: "PREMIUM",
  PROFESSIONAL: "ENTERPRISE",
};

/**
 * Collapses a stored plan string onto a current package key.
 *
 * Unknown or missing values fall back to STARTER — the safest, most restrictive
 * package — so a bad value can never silently unlock paid features.
 */
export function normalizePlanKey(plan: string | null | undefined): PlanKey {
  if (!plan) return "STARTER";
  return LEGACY_PLAN_ALIASES[plan.toUpperCase()] ?? "STARTER";
}

export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[normalizePlanKey(plan)];
}

export function getPlanLabel(plan: string | null | undefined): string {
  return getPlanLimits(plan).label;
}

export function planIncludesReportPeriod(
  plan: string | null | undefined,
  period: "daily" | "weekly" | "monthly" | "yearly",
): boolean {
  const limits = getPlanLimits(plan);
  if (!limits.oneMonthReportsOnly) return true;
  // Starter is limited to roughly one month of reporting — daily/weekly
  // breakdowns plus the current-month window. Yearly history requires
  // Premium or Enterprise.
  return period !== "yearly";
}

/**
 * Maximum custom report span in days for plans with a one-month reporting
 * cap. `null` means unrestricted history.
 */
export function getMaxReportSpanDays(plan: string | null | undefined): number | null {
  return getPlanLimits(plan).oneMonthReportsOnly ? 31 : null;
}

/**
 * Whether a custom from/to report range fits inside the plan's reporting cap.
 * Named periods (daily/weekly/monthly/yearly) are handled by
 * `planIncludesReportPeriod`; this covers explicit calendar ranges.
 */
export function isReportRangeAllowed(
  plan: string | null | undefined,
  from: string | undefined,
  to: string | undefined,
): boolean {
  const maxDays = getMaxReportSpanDays(plan);
  if (maxDays === null) return true;
  if (!from && !to) return true;
  const start = new Date(`${from ?? to}T00:00:00Z`).getTime();
  const end = new Date(`${to ?? from}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return Math.abs(end - start) / 86_400_000 <= maxDays;
}

/**
 * A 14-day trial (or any plan) is still "active" only while its period is unexpired.
 * Kept next to the limits so callers agree on what an active package means.
 */
export function isSubscriptionActive(
  subscription: { currentPeriodEnd: Date; status: string } | null | undefined,
  now = new Date(),
): boolean {
  if (!subscription) return false;
  return subscription.status !== "CANCELED" && subscription.currentPeriodEnd >= now;
}
