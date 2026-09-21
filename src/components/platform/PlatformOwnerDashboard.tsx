import { Banknote, Building2, CreditCard, FileWarning, Store, Users, ShoppingCart, BarChart3, UserRound, Receipt, Repeat } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { RenewSubscriptionButton } from "@/components/platform/RenewSubscriptionButton";
import { PlatformPlanManager } from "@/components/platform/PlatformPlanManager";
import type { PlatformOverview } from "@/lib/services/platform.service";

export function PlatformOwnerDashboard({ overview }: { overview: PlatformOverview }) {
  const statusTone: Record<string, string> = {
    TRIALING: "bg-amber-500/15 text-amber-700",
    ACTIVE: "bg-emerald-500/15 text-emerald-700",
    PAST_DUE: "bg-rose-500/15 text-rose-700",
    CANCELED: "bg-slate-500/15 text-slate-700",
    EXPIRED: "bg-red-500/15 text-red-700",
  };

  return (
    <>
      <PageHeader
        title="Platform ownership"
        description="Registry of businesses, supermarkets, stores and operational notices."
        actions={<PlatformPlanManager />}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-line bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Total businesses</span>
            <Building2 className="size-4 text-brand-600" />
          </div>
          <div className="text-3xl font-semibold text-fg">{overview.metrics.totalRegisteredBusinesses}</div>
          <div className="text-xs text-fg-muted">registered businesses</div>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Active businesses</span>
            <Store className="size-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-semibold text-fg">{overview.metrics.activeBusinesses}</div>
          <div className="text-xs text-fg-muted">stores online</div>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Trial businesses</span>
            <Banknote className="size-4 text-amber-600" />
          </div>
          <div className="text-3xl font-semibold text-fg">{overview.metrics.trialBusinesses}</div>
          <div className="text-xs text-fg-muted">trialing businesses</div>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Expired subscriptions</span>
            <FileWarning className="size-4 text-rose-600" />
          </div>
          <div className="text-3xl font-semibold text-fg">{overview.metrics.expiredSubscriptions}</div>
          <div className="text-xs text-fg-muted">subscription issues</div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-line bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Monthly recurring revenue</span>
            <CreditCard className="size-4 text-brand-600" />
          </div>
          <div className="text-3xl font-semibold text-fg">GHS {overview.metrics.monthlyRecurringRevenue}</div>
          <div className="text-xs text-fg-muted">subscription recurring</div>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">New registrations</span>
            <Users className="size-4 text-sky-600" />
          </div>
          <div className="text-3xl font-semibold text-fg">{overview.metrics.newRegistrations}</div>
          <div className="text-xs text-fg-muted">last 30 days</div>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Active users</span>
            <UserRound className="size-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-semibold text-fg">{overview.metrics.activeUsers}</div>
          <div className="text-xs text-fg-muted">account holders</div>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Transactions</span>
            <ShoppingCart className="size-4 text-violet-600" />
          </div>
          <div className="text-3xl font-semibold text-fg">{overview.metrics.totalTransactions}</div>
          <div className="text-xs text-fg-muted">sales records</div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-line bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Total sales processed</span>
            <BarChart3 className="size-4 text-brand-600" />
          </div>
          <div className="text-3xl font-semibold text-fg">GHS {overview.metrics.totalSalesProcessed}</div>
          <div className="text-xs text-fg-muted">gross sales</div>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Payment revenue</span>
            <Receipt className="size-4 text-cyan-600" />
          </div>
          <div className="text-3xl font-semibold text-fg">GHS {overview.metrics.paymentRevenue}</div>
          <div className="text-xs text-fg-muted">gateway payments</div>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Subscription revenue</span>
            <Repeat className="size-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-semibold text-fg">GHS {overview.metrics.subscriptionRevenue}</div>
          <div className="text-xs text-fg-muted">business subscriptions</div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(640px,1.7fr)_minmax(320px,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <div>
              <h2 className="text-lg font-semibold text-fg">Registered businesses</h2>
              <p className="text-xs text-fg-muted">Stores and supermarkets created in the platform</p>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-fg-muted">
                  <th className="px-3 py-2 font-medium">Business</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Users</th>
                  <th className="px-3 py-2 font-medium">Branches</th>
                  <th className="px-3 py-2 font-medium">MRR</th>
                  <th className="px-3 py-2 font-medium">Next billing</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {overview.stores.map((store) => (
                  <tr key={store.id} className="border-b border-line/70 align-top">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-fg">{store.name}</div>
                      <div className="text-xs text-fg-muted">Business ID: {store.businessId}</div>
                      <div className="text-xs text-fg-muted">{store.city ?? store.region ?? "No location"}</div>
                    </td>
                    <td className="px-3 py-3 text-fg-secondary">{store.plan ?? "No plan"}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[store.status ?? "ACTIVE"] ?? "bg-slate-500/15 text-slate-700"}`}>{store.status ?? "ACTIVE"}</span>
                    </td>
                    <td className="px-3 py-3 text-fg-secondary">{store.staffCount}</td>
                    <td className="px-3 py-3 text-fg-secondary">{store.branches}</td>
                    <td className="px-3 py-3 text-fg-secondary">GHS {store.monthlyPrice}</td>
                    <td className="px-3 py-3 text-fg-secondary">{store.nextBilling ? store.nextBilling.toLocaleDateString("en-GB") : "—"}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button className="rounded-lg border border-line px-2 py-1 text-[11px] text-fg">View</button>
                        <button className="rounded-lg border border-line px-2 py-1 text-[11px] text-fg">Activate</button>
                        <button className="rounded-lg border border-line px-2 py-1 text-[11px] text-fg">Suspend</button>
                        <button className="rounded-lg border border-line px-2 py-1 text-[11px] text-fg">Cancel</button>
                        <button className="rounded-lg border border-line px-2 py-1 text-[11px] text-fg">Change plan</button>
                        <RenewSubscriptionButton storeId={store.id} businessName={store.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="text-lg font-semibold text-fg">Important notices</h2>
              <p className="text-xs text-fg-muted">Platform health signals</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.notices.length === 0 && (
              <div className="rounded-xl border border-dashed border-line p-4 text-sm text-fg-muted">
                No platform notices at the moment.
              </div>
            )}

            {overview.notices.map((notice) => (
              <article key={notice.id} className="rounded-xl border border-line bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-fg">
                    {notice.severity}
                  </span>
                  <span className="text-[11px] text-fg-muted">{notice.createdAt.toLocaleDateString("en-GB")}</span>
                </div>
                <h3 className="mt-2 font-semibold text-fg">{notice.title}</h3>
                <p className="mt-1 text-sm leading-6 text-fg-secondary">{notice.body}</p>
              </article>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-card p-4">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-brand-600" />
            <span className="text-sm font-semibold text-fg">Stores with staff</span>
          </div>
          <div className="mt-4 text-3xl font-semibold text-fg">{overview.stores.reduce((sum, store) => sum + store.staffCount, 0)}</div>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <div className="flex items-center gap-2">
            <Store className="size-4 text-brand-600" />
            <span className="text-sm font-semibold text-fg">Active branch count</span>
          </div>
          <div className="mt-4 text-3xl font-semibold text-fg">{overview.totals.activeStores}</div>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <div className="flex items-center gap-2">
            <FileWarning className="size-4 text-brand-600" />
            <span className="text-sm font-semibold text-fg">Subscription issues</span>
          </div>
          <div className="mt-4 text-3xl font-semibold text-fg">{overview.totals.pastDueStores}</div>
        </div>
      </section>
    </>
  );
}
