export type FeatureKey =
  | "multiBranch"
  | "usageLimits"
  | "notifications"
  | "auditLogs"
  | "backups"
  | "offlinePos"
  | "mobileOptimization"
  | "advancedAnalytics"
  | "platformBilling";

export const PLAN_FEATURE_LIMITS = {
  STARTER: {
    multiBranch: false,
    usageLimits: false,
    notifications: false,
    auditLogs: true,
    backups: false,
    offlinePos: false,
    mobileOptimization: true,
    advancedAnalytics: false,
    platformBilling: false,
    maxStaff: 2,
    maxBranches: 1,
    dailyBackup: false,
  },
  GROWTH: {
    multiBranch: true,
    usageLimits: true,
    notifications: true,
    auditLogs: true,
    backups: true,
    offlinePos: false,
    mobileOptimization: true,
    advancedAnalytics: true,
    platformBilling: false,
    maxStaff: 4,
    maxBranches: 2,
    dailyBackup: true,
  },
  ENTERPRISE: {
    multiBranch: true,
    usageLimits: true,
    notifications: true,
    auditLogs: true,
    backups: true,
    offlinePos: true,
    mobileOptimization: true,
    advancedAnalytics: true,
    platformBilling: true,
    maxStaff: null,
    maxBranches: null,
    dailyBackup: true,
  },
} as const;

export const FEATURE_META: Record<FeatureKey, { label: string; description: string }> = {
  multiBranch: { label: "Multi-branch", description: "Support multiple stores and branch-level operations." },
  usageLimits: { label: "Usage limits", description: "Plan enforcement for seats, branches, and operational usage." },
  notifications: { label: "Notifications", description: "Alerts for staff actions, billing, and system events." },
  auditLogs: { label: "Audit logs", description: "Track login, stock, sales, and change events across the store." },
  backups: { label: "Automated backups", description: "Scheduled data protection and retention snapshots." },
  offlinePos: { label: "Offline POS", description: "Continue checkout and sales capture while connectivity is down." },
  mobileOptimization: { label: "Mobile optimization", description: "Responsive layouts for phones and small screens." },
  advancedAnalytics: { label: "Advanced analytics", description: "Reporting and trend analysis for growth and operations." },
  platformBilling: { label: "Platform billing/admin", description: "Super-admin billing control, plan pricing, and platform reporting." },
};

export function getPlanFeatureStatus(plan: string | null | undefined, feature: FeatureKey) {
  const key = (plan ?? "STARTER").toUpperCase();
  const planStatus = PLAN_FEATURE_LIMITS[key as keyof typeof PLAN_FEATURE_LIMITS] ?? PLAN_FEATURE_LIMITS.STARTER;
  return planStatus[feature] as boolean;
}

export function getPlanFeatureLabel(plan: string | null | undefined) {
  const key = (plan ?? "STARTER").toUpperCase();
  return key === "GROWTH" ? "Growth" : key === "ENTERPRISE" ? "Enterprise" : "Starter";
}
