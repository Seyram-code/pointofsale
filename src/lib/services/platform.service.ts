import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { normalizePlanKey } from "@/lib/config/plan-features";
import { getPlatformPlanPricing } from "@/lib/services/plan-pricing.service";

export interface PlatformStoreSummary {
  id: string;
  businessId: string | null;
  name: string;
  branchCode: string;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  region: string | null;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  staffCount: number;
  branches: number;
  plan: string | null;
  status: string | null;
  subscriptionStart: Date | null;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  monthlyPrice: number;
  nextBilling: Date | null;
  registeredByAdmin: boolean;
  ownerUserId: string | null;
  ownerEmail: string | null;
  totalTransactions: number;
  totalSalesProcessed: number;
  paymentRevenue: number;
}

export interface PlatformNotice {
  id: string;
  title: string;
  body: string;
  severity: "info" | "success" | "warning" | "danger";
  createdAt: Date;
}

export interface PlatformMetrics {
  totalRegisteredBusinesses: number;
  activeBusinesses: number;
  trialBusinesses: number;
  expiredSubscriptions: number;
  monthlyRecurringRevenue: number;
  newRegistrations: number;
  activeUsers: number;
  totalTransactions: number;
  totalSalesProcessed: number;
  paymentRevenue: number;
  subscriptionRevenue: number;
}

export interface PlatformOverview {
  stores: PlatformStoreSummary[];
  notices: PlatformNotice[];
  totals: {
    stores: number;
    activeStores: number;
    trialingStores: number;
    pastDueStores: number;
  };
  metrics: PlatformMetrics;
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const supportTicketModel = (prisma as unknown as {
    supportTicket?: { count: (args: { where: { status: { notIn: string[] } } }) => Promise<number> };
  }).supportTicket;

  const [stores, adminRegistrationLogs, planPricing, unresolvedSupportTickets] = await Promise.all([
    prisma.store.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      businessId: true,
      name: true,
      branchCode: true,
      phone: true,
      email: true,
      addressLine: true,
      city: true,
      region: true,
      currency: true,
      isActive: true,
      createdAt: true,
      _count: { select: { users: true } },
      users: {
        where: { role: "ADMIN", deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { id: true, email: true },
      },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          plan: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          trialEndsAt: true,
        },
      },
    },
    }),
    prisma.auditLog.findMany({
      where: { action: "CREATE", entity: "Store", user: { role: "SUPER_ADMIN" } },
      select: { storeId: true },
    }),
    getPlatformPlanPricing(),
    supportTicketModel?.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }) ?? Promise.resolve(0),
  ]);
  const planPrices = new Map(planPricing.map((plan) => [plan.key, plan.monthlyPrice ?? 0]));
  const adminRegisteredStoreIds = new Set(adminRegistrationLogs.map((log) => log.storeId).filter(Boolean));

  const storeSummaries: PlatformStoreSummary[] = stores.map((store) => {
    const subscription = store.subscriptions[0];
    const owner = store.users[0];
    const plan = subscription?.plan ?? "TRIAL";
    const status = subscription && subscription.currentPeriodEnd < new Date() && subscription.status !== "CANCELED"
      ? "EXPIRED"
      : subscription?.status ?? "TRIALING";
    return {
      id: store.id,
      businessId: store.businessId ?? `BUS-${store.id.slice(0, 12).toUpperCase()}`,
      name: store.name,
      branchCode: store.branchCode,
      phone: store.phone,
      email: store.email,
      addressLine: store.addressLine,
      city: store.city,
      region: store.region,
      currency: store.currency,
      isActive: store.isActive,
      createdAt: store.createdAt,
      staffCount: store._count.users,
      branches: 1,
      plan,
      status,
      subscriptionStart: subscription?.currentPeriodStart ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      trialEndsAt: subscription?.trialEndsAt ?? null,
      monthlyPrice: planPrices.get(normalizePlanKey(plan)) ?? 0,
      nextBilling: subscription?.currentPeriodEnd ?? null,
      registeredByAdmin: adminRegisteredStoreIds.has(store.id),
      ownerUserId: owner?.id ?? null,
      ownerEmail: owner?.email ?? null,
      totalTransactions: 0,
      totalSalesProcessed: 0,
      paymentRevenue: 0,
    };
  });

  const [salesByStore, paymentsByStore] = await Promise.all([
    prisma.sale.groupBy({
      by: ["storeId"],
      where: { status: { in: ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"] } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.$queryRaw<Array<{ storeId: string; total: Prisma.Decimal | number | null }>>(Prisma.sql`
      SELECT s.storeId, COALESCE(SUM(p.amount), 0) AS total
      FROM \`Payment\` p
      INNER JOIN \`Sale\` s ON s.id = p.saleId
      WHERE p.status = 'SUCCESSFUL'
      GROUP BY s.storeId
    `),
  ]);
  const salesByStoreId = new Map(salesByStore.map((row) => [row.storeId, row]));
  const paymentsByStoreId = new Map(paymentsByStore.map((row) => [row.storeId, Number(row.total ?? 0)]));
  const storeMetrics = storeSummaries.map((store) => {
    const sales = salesByStoreId.get(store.id);
    return {
      ...store,
      totalTransactions: sales?._count._all ?? 0,
      totalSalesProcessed: Number(sales?._sum.total ?? 0),
      paymentRevenue: paymentsByStoreId.get(store.id) ?? 0,
    };
  });

  const notices: PlatformNotice[] = [];

  for (const store of storeMetrics) {
    if (!store.isActive) {
      notices.push({
        id: `store-inactive-${store.id}`,
        title: `${store.name} is inactive`,
        body: `The store ${store.name} is marked inactive. Review and reactivate it when the branch is ready.`,
        severity: "warning",
        createdAt: store.createdAt,
      });
    }

    if (store.status === "TRIALING" && store.trialEndsAt && store.trialEndsAt < new Date()) {
      notices.push({
        id: `trial-ended-${store.id}`,
        title: `${store.name} trial has ended`,
        body: `The trial for ${store.name} ended on ${store.trialEndsAt.toISOString().slice(0, 10)}. Confirm billing or suspend access.`,
        severity: "danger",
        createdAt: store.trialEndsAt,
      });
    }

    if (store.status === "PAST_DUE" || store.status === "EXPIRED" || store.status === "CANCELED") {
      notices.push({
        id: `subscription-${store.id}`,
        title: `${store.name} has a subscription concern`,
        body: `${store.name} currently reports subscription status ${store.status}. Review billing and activation.`,
        severity: "danger",
        createdAt: store.createdAt,
      });
    }
  }

  if (unresolvedSupportTickets > 0) {
    notices.push({
      id: "support-tickets-open",
      title: `${unresolvedSupportTickets} support ticket${unresolvedSupportTickets === 1 ? "" : "s"} need attention`,
      body: "Review the support inbox and respond to stores with open platform issues.",
      severity: unresolvedSupportTickets >= 5 ? "danger" : "warning",
      createdAt: new Date(),
    });
  }

  const totals = {
    stores: storeMetrics.length,
    activeStores: storeMetrics.filter((store) => store.isActive).length,
    trialingStores: storeMetrics.filter((store) => store.status === "TRIALING").length,
    pastDueStores: storeMetrics.filter((store) => store.status === "PAST_DUE" || store.status === "EXPIRED" || store.status === "CANCELED").length,
  };

  const thirtyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const [salesTotal, paymentRevenue, activeUsers, totalTransactions, newRegistrations, activeBusinesses] = await Promise.all([
    prisma.sale.aggregate({ _sum: { total: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCESSFUL" }, _sum: { amount: true } }),
    prisma.user.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.sale.count(),
    prisma.store.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.store.count({ where: { isActive: true } }),
  ]);

  const subscriptionRevenue = storeMetrics.reduce((sum, store) => sum + store.monthlyPrice, 0);
  const monthlyRecurringRevenue = subscriptionRevenue;

  const metrics: PlatformMetrics = {
    totalRegisteredBusinesses: totals.stores,
    activeBusinesses,
    trialBusinesses: totals.trialingStores,
    expiredSubscriptions: totals.pastDueStores,
    monthlyRecurringRevenue,
    newRegistrations,
    activeUsers,
    totalTransactions,
    totalSalesProcessed: Number(salesTotal._sum.total ?? 0),
    paymentRevenue: Number(paymentRevenue._sum.amount ?? 0),
    subscriptionRevenue,
  };

  return { stores: storeMetrics, notices, totals, metrics };
}
