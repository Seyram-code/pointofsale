import "server-only";
import { prisma } from "@/lib/db/prisma";
import { addDays, endOfDay, startOfDay } from "@/lib/utils/date";
import type { ReportQuery } from "@/lib/validations/report.schema";

const SALE_STATUSES = ["COMPLETED", "PARTIALLY_REFUNDED"] as const;

export interface ReportPoint {
  label: string;
  date: string;
  sales: number;
  transactions: number;
  profit: number;
}

export interface ReportData {
  range: { from: string; to: string };
  summary: {
    totalSales: number;
    transactions: number;
    productsSold: number;
    cashSales: number;
    momoSales: number;
    ghanaPosSales: number;
    cardSales: number;
    discounts: number;
    refunds: number;
    costOfGoods: number;
    grossProfit: number;
    averageTransactionValue: number;
  };
  chart: ReportPoint[];
  topProducts: Array<{ name: string; sku: string; quantity: number; sales: number }>;
  cashiers: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; sku: string }>;
  categories: Array<{ id: string; name: string }>;
}

function n(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function dateRange(query: ReportQuery) {
  if (query.from || query.to) {
    const from = startOfDay(new Date(`${query.from ?? query.to}T00:00:00Z`));
    const to = endOfDay(new Date(`${query.to ?? query.from}T00:00:00Z`));
    return { from, to };
  }

  const now = new Date();
  if (query.period === "weekly") return { from: startOfDay(addDays(now, -6)), to: endOfDay(now) };
  if (query.period === "monthly") return { from: startOfDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))), to: endOfDay(now) };
  if (query.period === "yearly") return { from: startOfDay(new Date(Date.UTC(now.getUTCFullYear(), 0, 1))), to: endOfDay(now) };
  return { from: startOfDay(now), to: endOfDay(now) };
}

export async function getReportData(storeId: string, query: ReportQuery, scopedCashierId?: string): Promise<ReportData> {
  const { from, to } = dateRange(query);
  const sales = await prisma.sale.findMany({
    where: {
      storeId,
      status: { in: [...SALE_STATUSES] },
      completedAt: { gte: from, lte: to },
      ...(scopedCashierId || query.cashierId ? { cashierId: scopedCashierId ?? query.cashierId } : {}),
      ...(query.paymentMethod !== "all" ? { payments: { some: { method: query.paymentMethod, status: "SUCCESSFUL" } } } : {}),
      ...(query.productId ? { items: { some: { productId: query.productId } } } : {}),
      ...(query.categoryId ? { items: { some: { product: { categoryId: query.categoryId } } } } : {}),
    },
    orderBy: { completedAt: "asc" },
    include: {
      cashier: { select: { id: true, fullName: true } },
      payments: { where: { status: "SUCCESSFUL" }, select: { method: true, amount: true } },
      items: { select: { productId: true, productName: true, sku: true, quantity: true, unitCost: true, taxAmount: true, lineTotal: true, refundedQty: true } },
    },
  });

  const summary = { totalSales: 0, transactions: sales.length, productsSold: 0, cashSales: 0, momoSales: 0, ghanaPosSales: 0, cardSales: 0, discounts: 0, refunds: 0, costOfGoods: 0, grossProfit: 0, averageTransactionValue: 0 };
  const productMap = new Map<string, { name: string; sku: string; quantity: number; sales: number }>();
  const pointMap = new Map<string, ReportPoint>();
  const cashierMap = new Map<string, string>();

  for (const sale of sales) {
    const total = n(sale.total);
    const refund = n(sale.refundedAmount);
    summary.totalSales += total - refund;
    summary.discounts += n(sale.discountAmount);
    summary.refunds += refund;
    cashierMap.set(sale.cashier.id, sale.cashier.fullName);

    for (const payment of sale.payments) {
      const amount = n(payment.amount);
      if (payment.method === "CASH") summary.cashSales += amount;
      if (payment.method === "MOMO") summary.momoSales += amount;
      if (payment.method === "CARD_TERMINAL") summary.ghanaPosSales += amount;
      if (payment.method === "CARD") summary.cardSales += amount;
    }

    let cost = 0;
    let remainingTax = 0;
    for (const item of sale.items) {
      const quantity = Math.max(n(item.quantity) - n(item.refundedQty), 0);
      const salesAmount = n(item.lineTotal);
      summary.productsSold += quantity;
      cost += n(item.unitCost) * quantity;
      remainingTax += n(item.quantity) > 0 ? n(item.taxAmount) * (quantity / n(item.quantity)) : 0;
      const existing = productMap.get(item.productId) ?? { name: item.productName, sku: item.sku, quantity: 0, sales: 0 };
      existing.quantity += quantity;
      existing.sales += salesAmount;
      productMap.set(item.productId, existing);
    }
    summary.costOfGoods += cost;
    summary.grossProfit += total - refund - remainingTax - cost;

    const date = startOfDay(sale.completedAt ?? sale.createdAt);
    const key = date.toISOString().slice(0, 10);
    const point = pointMap.get(key) ?? { label: new Intl.DateTimeFormat("en-GH", { day: "2-digit", month: "short" }).format(date), date: key, sales: 0, transactions: 0, profit: 0 };
    point.sales += total - refund;
    point.transactions += 1;
    point.profit += total - refund - remainingTax - cost;
    pointMap.set(key, point);
  }

  summary.averageTransactionValue = summary.transactions > 0 ? summary.totalSales / summary.transactions : 0;

  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where: { storeId, isActive: true, deletedAt: null }, select: { id: true, name: true, sku: true }, orderBy: { name: "asc" }, take: 500 }),
    prisma.category.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return {
    range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    summary,
    chart: Array.from(pointMap.values()),
    topProducts: Array.from(productMap.values()).sort((a, b) => b.sales - a.sales).slice(0, 8),
    cashiers: Array.from(cashierMap, ([id, name]) => ({ id, name })),
    products,
    categories,
  };
}
