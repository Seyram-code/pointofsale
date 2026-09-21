import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth/guard";
import { getPlatformOverview } from "@/lib/services/platform.service";
import { BusinessReportsView, type BusinessReportStore } from "@/components/platform/BusinessReportsView";

export const metadata: Metadata = { title: "Business Reports" };
export const dynamic = "force-dynamic";

export default async function PlatformReportsPage() {
  const { user } = await requireSession("/platform/reports");
  if (user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const overview = await getPlatformOverview();
  const stores: BusinessReportStore[] = overview.stores.map((store) => ({
    id: store.id,
    businessId: store.businessId,
    name: store.name,
    phone: store.phone,
    email: store.email,
    isActive: store.isActive,
    createdAt: store.createdAt.toISOString(),
    staffCount: store.staffCount,
    branches: store.branches,
    plan: store.plan,
    status: store.status,
    subscriptionStart: store.subscriptionStart?.toISOString() ?? null,
    currentPeriodEnd: store.currentPeriodEnd?.toISOString() ?? null,
    monthlyPrice: store.monthlyPrice,
    totalTransactions: store.totalTransactions,
    totalSalesProcessed: store.totalSalesProcessed,
    paymentRevenue: store.paymentRevenue,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Business reports" description="Track registered business growth, subscriptions, platform usage, and operational health." />
      <BusinessReportsView
        stores={stores}
        totalTransactions={overview.metrics.totalTransactions}
        totalSalesProcessed={overview.metrics.totalSalesProcessed}
        paymentRevenue={overview.metrics.paymentRevenue}
      />
    </div>
  );
}
