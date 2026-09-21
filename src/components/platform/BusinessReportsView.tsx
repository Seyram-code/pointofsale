"use client";

import { useState } from "react";
import { BarChart3, Building2, CalendarClock, CreditCard, Store, Users } from "lucide-react";
import { BarChart } from "@/components/charts/BarChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";

export interface BusinessReportStore {
  id: string;
  businessId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  staffCount: number;
  branches: number;
  plan: string | null;
  status: string | null;
  subscriptionStart: string | null;
  currentPeriodEnd: string | null;
  monthlyPrice: number;
  totalTransactions: number;
  totalSalesProcessed: number;
  paymentRevenue: number;
}

type Segment = "all" | "active" | "trial" | "subscribed";

const SEGMENTS: Array<{ key: Segment; label: string }> = [
  { key: "all", label: "All businesses" },
  { key: "active", label: "Active businesses" },
  { key: "trial", label: "Trial businesses" },
  { key: "subscribed", label: "Subscribed businesses" },
];

const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString("en-GB") : "—";

export function BusinessReportsView({ stores, totalTransactions, totalSalesProcessed, paymentRevenue }: { stores: BusinessReportStore[]; totalTransactions: number; totalSalesProcessed: number; paymentRevenue: number }) {
  const [segment, setSegment] = useState<Segment>("all");
  const [selectedBusinessId, setSelectedBusinessId] = useState("all");
  const segmentStores = stores.filter((store) => {
    if (segment === "active") return store.isActive;
    if (segment === "trial") return store.status === "TRIALING";
    if (segment === "subscribed") return store.status === "ACTIVE";
    return true;
  });
  const filteredStores = selectedBusinessId === "all" ? segmentStores : segmentStores.filter((store) => store.id === selectedBusinessId);
  const selectedBusiness = selectedBusinessId === "all" ? null : stores.find((store) => store.id === selectedBusinessId) ?? null;
  const planCounts = countBy(filteredStores, (store) => store.plan ?? "TRIAL");
  const statusCounts = countBy(filteredStores, (store) => store.status ?? "TRIALING");
  const registrationTrend = buildRegistrationTrend(filteredStores);
  const users = filteredStores.reduce((total, store) => total + store.staffCount, 0);
  const branches = filteredStores.reduce((total, store) => total + store.branches, 0);
  const mrr = filteredStores.reduce((total, store) => total + store.monthlyPrice, 0);
  const businessTransactions = selectedBusiness ? selectedBusiness.totalTransactions : totalTransactions;
  const businessSales = selectedBusiness ? selectedBusiness.totalSalesProcessed : totalSalesProcessed;
  const businessPaymentRevenue = selectedBusiness ? selectedBusiness.paymentRevenue : paymentRevenue;
  const renewals = [...filteredStores].filter((store) => store.currentPeriodEnd).sort((a, b) => new Date(a.currentPeriodEnd ?? 0).getTime() - new Date(b.currentPeriodEnd ?? 0).getTime()).slice(0, 8);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm font-semibold text-fg">Business segment</span>
          {SEGMENTS.map((item) => <Button key={item.key} type="button" size="sm" variant={segment === item.key ? "primary" : "outline"} onClick={() => { setSegment(item.key); setSelectedBusinessId("all"); }}>{item.label}</Button>)}
        </div>
        <div className="mt-3 max-w-md">
          <Select label="Business report" value={selectedBusinessId} onChange={(event) => setSelectedBusinessId(event.target.value)} options={[{ value: "all", label: "All businesses in segment" }, ...segmentStores.map((store) => ({ value: store.id, label: `${store.name} · ${store.businessId ?? "No ID"}` }))]} />
        </div>
        <p className="mt-2 text-xs text-fg-muted">Every card, chart, and table below is filtered to {SEGMENTS.find((item) => item.key === segment)?.label.toLowerCase()}.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportStat label="Businesses" value={filteredStores.length} icon={<Building2 className="size-5" />} />
        <ReportStat label="Users" value={users} icon={<Users className="size-5" />} />
        <ReportStat label="Branches" value={branches} icon={<Store className="size-5" />} />
        <ReportStat label="Monthly recurring revenue" value={`GHS ${mrr.toLocaleString("en-GH")}`} icon={<CreditCard className="size-5" />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <Card><CardHeader><CardTitle>Registration trend</CardTitle><p className="text-sm text-fg-muted">Businesses registered by month for the selected segment.</p></CardHeader><CardContent><BarChart data={registrationTrend} valueFormatter={(value) => `${value} businesses`} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Plans</CardTitle><p className="text-sm text-fg-muted">Selected businesses by plan.</p></CardHeader><CardContent><DonutChart slices={toSlices(planCounts, ["#16834f", "#d99b22", "#3b82f6", "#7c3aed"])} centerLabel="businesses" centerValue={String(filteredStores.length)} valueFormatter={(value) => `${value}`} size={150} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Status</CardTitle><p className="text-sm text-fg-muted">Subscription health for this segment.</p></CardHeader><CardContent><DonutChart slices={toSlices(statusCounts, ["#16834f", "#d99b22", "#dc6b4f", "#64748b"])} centerLabel="businesses" centerValue={String(filteredStores.length)} valueFormatter={(value) => `${value}`} size={150} /></CardContent></Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <ReportStat label="Transactions" value={businessTransactions} hint={selectedBusiness ? selectedBusiness.name : "Platform total"} icon={<BarChart3 className="size-5" />} />
        <ReportStat label="Sales processed" value={`GHS ${businessSales.toLocaleString("en-GH")}`} hint={selectedBusiness ? selectedBusiness.name : "Platform total"} icon={<BarChart3 className="size-5" />} />
        <ReportStat label="Payment revenue" value={`GHS ${businessPaymentRevenue.toLocaleString("en-GH")}`} hint={selectedBusiness ? selectedBusiness.name : "Platform total"} icon={<CreditCard className="size-5" />} />
      </section>

      <Card>
        <CardHeader><CardTitle>Renewal pipeline</CardTitle><p className="text-sm text-fg-muted">Upcoming subscription dates for the selected segment.</p></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm"><thead><tr className="border-b border-line text-fg-muted"><th className="px-6 py-3 font-medium">Business</th><th className="px-6 py-3 font-medium">Plan</th><th className="px-6 py-3 font-medium">Status</th><th className="px-6 py-3 font-medium">Next subscription</th><th className="px-6 py-3 font-medium">MRR</th></tr></thead><tbody>{renewals.map((store) => <tr key={store.id} className="border-b border-line/70"><td className="px-6 py-3 font-semibold text-fg">{store.name}<div className="text-xs font-normal text-fg-muted">{store.businessId}</div></td><td className="px-6 py-3 text-fg-secondary">{store.plan ?? "TRIAL"}</td><td className="px-6 py-3 text-fg-secondary">{store.status ?? "TRIALING"}</td><td className="px-6 py-3 text-fg-secondary">{formatDate(store.currentPeriodEnd)}</td><td className="px-6 py-3 text-fg-secondary">GHS {store.monthlyPrice.toLocaleString("en-GH")}</td></tr>)}</tbody></table>{renewals.length === 0 && <p className="p-6 text-sm text-fg-muted">No businesses match this segment.</p>}
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>Selected segment performance</CardTitle><p className="text-sm text-fg-muted">Operational footprint for {SEGMENTS.find((item) => item.key === segment)?.label.toLowerCase()}.</p></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><Metric label="Businesses" value={filteredStores.length} /><Metric label="Users" value={users} /><Metric label="MRR" value={`GHS ${mrr.toLocaleString("en-GH")}`} /></CardContent></Card>
    </div>
  );
}

function countBy(stores: BusinessReportStore[], getKey: (store: BusinessReportStore) => string) {
  return stores.reduce<Record<string, number>>((counts, store) => { const key = getKey(store); counts[key] = (counts[key] ?? 0) + 1; return counts; }, {});
}

function buildRegistrationTrend(stores: BusinessReportStore[]) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - (5 - index), 1));
  return months.map((month) => ({ label: month.toLocaleDateString("en-GH", { month: "short" }), value: stores.filter((store) => { const created = new Date(store.createdAt); return created.getFullYear() === month.getFullYear() && created.getMonth() === month.getMonth(); }).length }));
}

function toSlices(values: Record<string, number>, colors: string[]) {
  return Object.entries(values).map(([label, value], index) => ({ label, value, color: colors[index % colors.length] }));
}

function ReportStat({ label, value, hint, icon }: { label: string; value: string | number; hint?: string; icon: React.ReactNode }) {
  return <div className="rounded-xl border border-line bg-card p-4"><div className="flex items-center justify-between text-fg-muted"><span className="text-xs font-semibold uppercase tracking-wide">{label}</span>{icon}</div><div className="mt-3 text-2xl font-semibold text-fg">{value}</div>{hint && <div className="mt-1 text-xs text-fg-muted">{hint}</div>}</div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-line bg-muted/30 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-fg"><CalendarClock className="size-4 text-brand-600" />{label}</div><div className="mt-3 text-2xl font-semibold text-fg">{value}</div></div>;
}
