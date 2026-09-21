import {
  Banknote,
  Boxes,
  CreditCard,
  ClipboardList,
  PackageMinus,
  Receipt,
  ShoppingBasket,
  Smartphone,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardContent } from "@/components/ui/Card";
import { SalesChartCard } from "@/components/dashboard/SalesChartCard";
import { PaymentMethodCard } from "@/components/dashboard/PaymentMethodCard";
import { RecentTransactionsCard } from "@/components/dashboard/RecentTransactionsCard";
import { TopProductsCard } from "@/components/dashboard/TopProductsCard";
import { LowStockCard } from "@/components/dashboard/LowStockCard";
import { ExpiringProductsCard } from "@/components/dashboard/ExpiringProductsCard";
import { formatCurrency, formatDate, formatNumber, formatQuantity } from "@/lib/utils/format";
import type { DashboardData } from "@/lib/services/dashboard.service";
import type { SessionUser } from "@/lib/auth/types";

export function DashboardView({ user, data }: { user: SessionUser; data: DashboardData }) {
  const { summary } = data;
  const canSeeProfit = user.permissions.includes(PERMISSIONS.REPORTS_PROFIT);
  const isRestaurant = user.businessType === "RESTAURANT";

  const stats = [
    {
      label: isRestaurant ? "Today's revenue" : "Today's sales",
      value: formatCurrency(summary.todaySales),
      icon: <TrendingUp className="size-5" />,
      tone: "brand" as const,
      trend: summary.salesTrend === null ? undefined : { value: summary.salesTrend, label: "vs yesterday" },
      hint: summary.salesTrend === null ? "No sales yesterday" : undefined,
    },
    {
      label: isRestaurant ? "Orders today" : "Transactions",
      value: formatNumber(summary.todayTransactions),
      icon: <Receipt className="size-5" />,
      tone: "accent" as const,
      trend:
        summary.transactionsTrend === null ? undefined : { value: summary.transactionsTrend, label: "vs yesterday" },
    },
    {
      label: isRestaurant ? "Menu items sold" : "Products sold",
      value: formatQuantity(summary.productsSold),
      icon: <ShoppingBasket className="size-5" />,
      tone: "neutral" as const,
      hint: isRestaurant ? "Items served today" : "Units sold today",
    },
    {
      label: "Low stock",
      value: formatNumber(summary.lowStockCount),
      icon: <PackageMinus className="size-5" />,
      tone: summary.lowStockCount > 0 ? ("danger" as const) : ("success" as const),
      hint: summary.lowStockCount > 0 ? "Needs reordering" : "All levels healthy",
    },
    ...(canSeeProfit
      ? [
          {
            label: "Today's profit",
            value: formatCurrency(summary.todayProfit),
            icon: <Wallet className="size-5" />,
            tone: "success" as const,
            hint: "Gross margin",
          },
        ]
      : []),
    {
      label: "MoMo sales",
      value: formatCurrency(summary.momoSales),
      icon: <Smartphone className="size-5" />,
      tone: "accent" as const,
      hint: "Mobile money today",
    },
    {
      label: "POS sales",
      value: formatCurrency(summary.cardSales),
      icon: <CreditCard className="size-5" />,
      tone: "brand" as const,
      hint: "Card terminal today",
    },
    {
      label: "Cash sales",
      value: formatCurrency(summary.cashSales),
      icon: <Banknote className="size-5" />,
      tone: "success" as const,
      hint: "Cash drawer today",
    },
  ];

  return (
    <>
      <PageHeader
        title={isRestaurant ? `Restaurant overview, ${user.fullName.split(" ")[0]}` : `Welcome back, ${user.fullName.split(" ")[0]}`}
        description={`${user.storeName ?? "No store assigned"} · ${formatDate(new Date(), "long")}`}
      />

      {!user.storeId && (
        <Card className="mb-4 border-accent-300 bg-accent-50 dark:border-accent-800 dark:bg-accent-900/20">
          <CardContent className="text-sm text-fg-secondary">
            Your account is not linked to a store yet, so the figures below are empty. Ask an administrator to assign
            you to a branch.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {isRestaurant && (
        <div className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-3">
          <Link href="/pos" className="flex items-center gap-3 rounded-xl border border-line bg-card p-4 transition-colors hover:border-brand-400 hover:bg-muted">
            <Receipt className="size-5 text-brand-600" />
            <span><strong className="block text-sm text-fg">Open order screen</strong><span className="text-xs text-fg-muted">Start a customer order</span></span>
          </Link>
          <Link href="/products" className="flex items-center gap-3 rounded-xl border border-line bg-card p-4 transition-colors hover:border-brand-400 hover:bg-muted">
            <ClipboardList className="size-5 text-brand-600" />
            <span><strong className="block text-sm text-fg">Manage menu</strong><span className="text-xs text-fg-muted">Update menu items and prices</span></span>
          </Link>
          <Link href="/inventory" className="flex items-center gap-3 rounded-xl border border-line bg-card p-4 transition-colors hover:border-brand-400 hover:bg-muted">
            <Boxes className="size-5 text-brand-600" />
            <span><strong className="block text-sm text-fg">Check ingredients</strong><span className="text-xs text-fg-muted">Review stock and expiry alerts</span></span>
          </Link>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:mt-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesChartCard points={data.salesTrend} />
        </div>
        <PaymentMethodCard slices={data.paymentBreakdown} />
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 lg:grid-cols-2">
        <TopProductsCard products={data.topProducts} />
        <LowStockCard items={data.lowStockItems} total={summary.lowStockCount} />
      </div>

      <div className="mt-4 sm:mt-6">
        <ExpiringProductsCard items={data.expiringItems} />
      </div>

      <div className="mt-4 sm:mt-6">
        <RecentTransactionsCard transactions={data.recentTransactions} />
      </div>
    </>
  );
}
