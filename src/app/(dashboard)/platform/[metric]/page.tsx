import { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarChart3, Building2, CalendarDays, CreditCard, FileWarning, Receipt, Repeat, Store, UserRound, Users, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { requireSession } from "@/lib/auth/guard";
import { getPlatformOverview } from "@/lib/services/platform.service";
import { PlatformBusinessActions } from "@/components/platform/PlatformBusinessActions";
import { PlatformRegistrationPanel } from "@/components/platform/PlatformRegistrationPanel";
import { PlatformOwnerCredentials } from "@/components/platform/PlatformOwnerCredentials";

export const metadata: Metadata = { title: "Platform Metric" };

const metricMap = {
  "total-registered-businesses": {
    title: "Total registered businesses",
    description: "All stores and businesses opened in the platform.",
    icon: Building2,
    value: (overview: Awaited<ReturnType<typeof getPlatformOverview>>) => overview.metrics.totalRegisteredBusinesses,
    format: (value: number) => `${Number(value).toLocaleString("en-GH")}`,
  },
  "active-businesses": {
    title: "Active businesses",
    description: "Businesses currently marked active and able to operate.",
    icon: Store,
    value: (overview: Awaited<ReturnType<typeof getPlatformOverview>>) => overview.metrics.activeBusinesses,
    format: (value: number) => `${Number(value).toLocaleString("en-GH")}`,
  },
  "trial-businesses": {
    title: "Trial businesses",
    description: "Businesses currently in a trial subscription phase.",
    icon: CalendarDays,
    value: (overview: Awaited<ReturnType<typeof getPlatformOverview>>) => overview.metrics.trialBusinesses,
    format: (value: number) => `${Number(value).toLocaleString("en-GH")}`,
  },
  "expired-subscriptions": {
    title: "Expired subscriptions",
    description: "Businesses with subscription or billing concerns.",
    icon: FileWarning,
    value: (overview: Awaited<ReturnType<typeof getPlatformOverview>>) => overview.metrics.expiredSubscriptions,
    format: (value: number) => `${Number(value).toLocaleString("en-GH")}`,
  },
  "monthly-recurring-revenue": {
    title: "Monthly recurring revenue",
    description: "Platform monthly recurring subscription revenue.",
    icon: CreditCard,
    value: (overview: Awaited<ReturnType<typeof getPlatformOverview>>) => overview.metrics.monthlyRecurringRevenue,
    format: (value: number) => `GHS ${Number(value).toLocaleString("en-GH")}`,
  },
  "new-registrations": {
    title: "New registrations",
    description: "Businesses created in the last 30 days.",
    icon: Users,
    value: (overview: Awaited<ReturnType<typeof getPlatformOverview>>) => overview.metrics.newRegistrations,
    format: (value: number) => `${Number(value).toLocaleString("en-GH")}`,
  },
  "active-users": {
    title: "Active users",
    description: "Active account holders across the platform.",
    icon: UserRound,
    value: (overview: Awaited<ReturnType<typeof getPlatformOverview>>) => overview.metrics.activeUsers,
    format: (value: number) => `${Number(value).toLocaleString("en-GH")}`,
  },
  "total-transactions": {
    title: "Total transactions",
    description: "Total receipt and transaction records processed.",
    icon: ShoppingCart,
    value: (overview: Awaited<ReturnType<typeof getPlatformOverview>>) => overview.metrics.totalTransactions,
    format: (value: number) => `${Number(value).toLocaleString("en-GH")}`,
  },
  "total-sales-processed": {
    title: "Total sales processed",
    description: "Gross sales processed through the platform.",
    icon: BarChart3,
    value: (overview: Awaited<ReturnType<typeof getPlatformOverview>>) => overview.metrics.totalSalesProcessed,
    format: (value: number) => `GHS ${Number(value).toLocaleString("en-GH")}`,
  },
  "payment-revenue": {
    title: "Payment revenue",
    description: "Revenue derived from successful payment collection.",
    icon: Receipt,
    value: (overview: Awaited<ReturnType<typeof getPlatformOverview>>) => overview.metrics.paymentRevenue,
    format: (value: number) => `GHS ${Number(value).toLocaleString("en-GH")}`,
  },
  "subscription-revenue": {
    title: "Subscription revenue",
    description: "Recurring business subscription revenue.",
    icon: Repeat,
    value: (overview: Awaited<ReturnType<typeof getPlatformOverview>>) => overview.metrics.subscriptionRevenue,
    format: (value: number) => `GHS ${Number(value).toLocaleString("en-GH")}`,
  },
} as const;

export default async function PlatformMetricPage({ params }: { params: Promise<{ metric: string }> }) {
  const { user } = await requireSession();
  if (user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const { metric } = await params;
  const def = metricMap[metric as keyof typeof metricMap];
  if (!def) redirect("/platform");

  const overview = await getPlatformOverview();
  const Icon = def.icon;
  const value = def.value(overview);
  const tableMetrics = ["total-registered-businesses", "active-businesses", "trial-businesses", "expired-subscriptions", "new-registrations"] as const;
  const newRegistrationSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return (
    <>
      <PageHeader title={def.title} description={def.description} />
      <section className="grid gap-4">
        <Card className="overflow-hidden">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <span className="rounded-xl border border-line bg-card p-3">
                    <Icon className="size-6 text-brand-600" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Platform metric</span>
                </div>
                <div className="mt-4 text-5xl font-semibold tracking-tight text-fg">{def.format(value)}</div>
              </div>
              <span className="rounded-full border border-line px-4 py-2 text-xs font-semibold uppercase text-fg-muted">
                {overview.metrics.totalRegisteredBusinesses} businesses
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {metric === "new-registrations" && (
        <section className="mt-6 flex justify-end">
          <PlatformRegistrationPanel />
        </section>
      )}

      {metric === "active-users" && (
        <section className="mt-6">
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <div className="border-b border-line px-6 py-4">
                <h2 className="text-lg font-semibold text-fg">Registered business accounts</h2>
                <p className="text-xs text-fg-muted">Business owner login details and secure password management</p>
              </div>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-fg-muted">
                    <th className="px-6 py-3 font-medium">Business name</th>
                    <th className="px-6 py-3 font-medium">Business ID</th>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.stores.map((store) => (
                    <tr key={store.id} className="border-b border-line/70 align-top">
                      <td className="px-6 py-3 font-semibold text-fg">{store.name}</td>
                      <td className="px-6 py-3 text-fg-secondary">{store.businessId}</td>
                      <td className="px-6 py-3 text-fg-secondary">{store.ownerEmail ?? "—"}</td>
                      <td className="px-6 py-3">
                        <PlatformOwnerCredentials
                          storeId={store.id}
                          businessName={store.name}
                          ownerUserId={store.ownerUserId}
                          ownerEmail={store.ownerEmail}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      )}

      {tableMetrics.includes(metric as (typeof tableMetrics)[number]) && (
        <section className="mt-6">
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <div className="border-b border-line px-6 py-4">
                <h2 className="text-lg font-semibold text-fg">
                  {metric === "active-businesses" ? "Active businesses" : metric === "trial-businesses" ? "Trial businesses" : metric === "expired-subscriptions" ? "Expired subscriptions" : metric === "new-registrations" ? "Business registered by Admin" : "Registered businesses"}
                </h2>
                <p className="text-xs text-fg-muted">Business identity, contact, operating details, and subscription dates</p>
              </div>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-fg-muted">
                    {metric === "expired-subscriptions" ? (
                      <>
                        <th className="px-6 py-3 font-medium">Business ID</th>
                        <th className="px-6 py-3 font-medium">Business name</th>
                        <th className="px-6 py-3 font-medium">Phone</th>
                        <th className="px-6 py-3 font-medium">Email</th>
                        <th className="px-6 py-3 font-medium">Plan</th>
                        <th className="px-6 py-3 font-medium">Date of expiry</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-3 font-medium">Business name</th>
                        <th className="px-6 py-3 font-medium">Business ID</th>
                        <th className="px-6 py-3 font-medium">Branch</th>
                        <th className="px-6 py-3 font-medium">Location</th>
                        <th className="px-6 py-3 font-medium">Phone</th>
                        <th className="px-6 py-3 font-medium">Email</th>
                        <th className="px-6 py-3 font-medium">Plan</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium">Email verification</th>
                        <th className="px-6 py-3 font-medium">Subscription date</th>
                        <th className="px-6 py-3 font-medium">Next subscription</th>
                        <th className="px-6 py-3 font-medium">Users</th>
                        <th className="px-6 py-3 font-medium">Branches</th>
                        <th className="px-6 py-3 font-medium">MRR</th>
                        <th className="px-6 py-3 font-medium">Currency</th>
                        <th className="px-6 py-3 font-medium">Created</th>
                      </>
                    )}
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.stores.filter((store) => {
                    if (metric === "active-businesses") return store.isActive;
                    if (metric === "trial-businesses") return store.status === "TRIALING";
                    if (metric === "expired-subscriptions") return ["EXPIRED", "PAST_DUE", "CANCELED"].includes(store.status ?? "");
                    if (metric === "new-registrations") return store.registeredByAdmin && store.createdAt >= newRegistrationSince;
                    return true;
                  }).map((store) => (
                    <tr key={store.id} className="border-b border-line/70 align-top">
                      {metric === "expired-subscriptions" ? (
                        <>
                          <td className="px-6 py-3 text-fg-secondary">{store.businessId}</td>
                          <td className="px-6 py-3 font-semibold text-fg">{store.name}</td>
                          <td className="px-6 py-3 text-fg-secondary">{store.phone ?? "—"}</td>
                          <td className="px-6 py-3 text-fg-secondary">{store.email ?? "—"}</td>
                          <td className="px-6 py-3 text-fg-secondary">{store.plan ?? "TRIAL"}</td>
                          <td className="px-6 py-3 text-fg-secondary">{store.currentPeriodEnd?.toLocaleDateString("en-GB") ?? "—"}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-3">
                            <div className="font-semibold text-fg">{store.name}</div>
                          </td>
                          <td className="px-6 py-3 text-fg-secondary">{store.businessId}</td>
                          <td className="px-6 py-3 text-fg-secondary">{store.branchCode}</td>
                          <td className="px-6 py-3 text-fg-secondary">{[store.city, store.region].filter(Boolean).join(", ") || "—"}</td>
                          <td className="px-6 py-3 text-fg-secondary">{store.phone ?? "—"}</td>
                          <td className="px-6 py-3 text-fg-secondary">{store.email ?? "—"}</td>
                          <td className="px-6 py-3 text-fg-secondary">{store.plan ?? "TRIAL"}</td>
                          <td className="px-6 py-3 text-fg-secondary">{store.status ?? "TRIALING"}</td>
                          <td className="px-6 py-3 text-fg-secondary">{store.emailVerifiedAt ? "Verified" : "Pending"}</td>
                          <td className="px-6 py-3 text-fg-secondary">{store.subscriptionStart?.toLocaleDateString("en-GB") ?? "—"}</td>
                          <td className="px-6 py-3 text-fg-secondary">{store.currentPeriodEnd?.toLocaleDateString("en-GB") ?? "—"}</td>
                          <td className="px-6 py-3 text-fg-secondary">{store.staffCount}</td>
                          <td className="px-6 py-3 text-fg-secondary">{store.branches}</td>
                          <td className="px-6 py-3 text-fg-secondary">GHS {store.monthlyPrice.toLocaleString("en-GH")}</td>
                          <td className="px-6 py-3 text-fg-secondary">{store.currency}</td>
                          <td className="px-6 py-3 text-fg-secondary">{store.createdAt.toLocaleDateString("en-GB")}</td>
                        </>
                      )}
                      <td className="px-6 py-3">
                        <PlatformBusinessActions store={store} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      )}
    </>
  );
}
