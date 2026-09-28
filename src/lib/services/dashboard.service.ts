import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { addDays, dayLabel, endOfDay, lastNDaysRange, percentChange, startOfDay, todayRange, yesterdayRange } from "@/lib/utils/date";

const COUNTED_STATUSES = ["COMPLETED", "PARTIALLY_REFUNDED"] as const;
const LOW_STOCK_THRESHOLD = 10;
const EXPIRY_ALERT_DAYS = 30;

export interface DashboardSummary {
  todaySales: number;
  todayTransactions: number;
  productsSold: number;
  lowStockCount: number;
  todayProfit: number;
  cashSales: number;
  momoSales: number;
  cardSales: number;
  salesTrend: number | null;
  transactionsTrend: number | null;
}

export interface SalesTrendPoint {
  label: string;
  date: string;
  revenue: number;
  transactions: number;
}

export interface PaymentBreakdownSlice {
  method: string;
  label: string;
  amount: number;
  count: number;
}

export interface RecentTransaction {
  id: string;
  receiptNumber: string;
  total: number;
  itemCount: number;
  status: string;
  completedAt: Date | null;
  cashierName: string;
  customerName: string | null;
  methods: string[];
}

export interface TopProduct {
  productId: string;
  name: string;
  sku: string;
  quantitySold: number;
  revenue: number;
}

export interface LowStockItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  reorderLevel: number;
  reorderQty: number;
}

export interface ExpiringItem {
  batchId: string;
  productId: string;
  name: string;
  sku: string;
  batchNumber: string;
  quantity: number;
  expiryDate: Date;
  daysUntilExpiry: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  salesTrend: SalesTrendPoint[];
  paymentBreakdown: PaymentBreakdownSlice[];
  recentTransactions: RecentTransaction[];
  topProducts: TopProduct[];
  lowStockItems: LowStockItem[];
  expiringItems: ExpiringItem[];
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Cash",
  MOMO: "Mobile Money",
  CARD_TERMINAL: "Card / POS",
  BANK_TRANSFER: "Bank transfer",
  STORE_CREDIT: "Store credit",
  LOYALTY_POINTS: "Loyalty points",
  VOUCHER: "Voucher",
};

function num(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

async function salesTotals(storeId: string, from: Date, to: Date, cashierId?: string) {
  const result = await prisma.sale.aggregate({
    where: { storeId, status: { in: [...COUNTED_STATUSES] }, completedAt: { gte: from, lte: to }, ...(cashierId ? { cashierId } : {}) },
    _sum: { total: true, refundedAmount: true },
    _count: { _all: true },
  });
  return {
    revenue: num(result._sum.total) - num(result._sum.refundedAmount),
    transactions: result._count._all,
  };
}

/** Gross margin for the day using discounted, tax-exclusive, unrefunded line values. */
async function grossProfit(storeId: string, from: Date, to: Date, cashierId?: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ profit: Prisma.Decimal | null }>>(Prisma.sql`
    SELECT COALESCE(SUM(
      (si.lineTotal - si.taxAmount)
        * (GREATEST(si.quantity - si.refundedQty, 0) / NULLIF(si.quantity, 0))
      - si.unitCost * GREATEST(si.quantity - si.refundedQty, 0)
    ), 0) AS profit
    FROM \`SaleItem\` si
    JOIN \`Sale\` s ON s.id = si.saleId
    WHERE s.storeId = ${storeId}
      AND s.status IN (${Prisma.join([...COUNTED_STATUSES])})
      AND s.completedAt BETWEEN ${from} AND ${to}
      ${cashierId ? Prisma.sql`AND s.cashierId = ${cashierId}` : Prisma.empty}
  `);
  return num(rows[0]?.profit);
}

async function paymentTotals(storeId: string, from: Date, to: Date, cashierId?: string): Promise<PaymentBreakdownSlice[]> {
  const rows = await prisma.$queryRaw<Array<{ method: string; amount: Prisma.Decimal | null; count: bigint }>>(Prisma.sql`
    SELECT p.method AS method, COALESCE(SUM(p.amount), 0) AS amount, COUNT(*) AS count
    FROM \`Payment\` p
    JOIN \`Sale\` s ON s.id = p.saleId
    WHERE s.storeId = ${storeId}
      AND p.status = 'SUCCESSFUL'
      AND p.createdAt BETWEEN ${from} AND ${to}
      ${cashierId ? Prisma.sql`AND s.cashierId = ${cashierId}` : Prisma.empty}
    GROUP BY p.method
    ORDER BY amount DESC
  `);

  return rows.map((row) => ({
    method: row.method,
    label: PAYMENT_LABELS[row.method] ?? row.method,
    amount: num(row.amount),
    count: Number(row.count),
  }));
}

async function salesTrend(storeId: string, days: number, cashierId?: string): Promise<SalesTrendPoint[]> {
  const { from, to } = lastNDaysRange(days);

  const rows = await prisma.$queryRaw<Array<{ day: Date; revenue: Prisma.Decimal | null; transactions: bigint }>>(Prisma.sql`
    SELECT DATE(s.completedAt) AS day,
           COALESCE(SUM(s.total - s.refundedAmount), 0) AS revenue,
           COUNT(*) AS transactions
    FROM \`Sale\` s
    WHERE s.storeId = ${storeId}
      AND s.status IN (${Prisma.join([...COUNTED_STATUSES])})
      AND s.completedAt BETWEEN ${from} AND ${to}
      ${cashierId ? Prisma.sql`AND s.cashierId = ${cashierId}` : Prisma.empty}
    GROUP BY DATE(s.completedAt)
    ORDER BY DATE(s.completedAt)
  `);

  const byDay = new Map(rows.map((row) => [startOfDay(new Date(row.day)).toISOString(), row]));

  return Array.from({ length: days }, (_, index) => {
    const date = startOfDay(addDays(new Date(), -(days - 1 - index)));
    const match = byDay.get(date.toISOString());
    return {
      label: dayLabel(date),
      date: date.toISOString().slice(0, 10),
      revenue: num(match?.revenue),
      transactions: Number(match?.transactions ?? 0),
    };
  });
}

async function lowStock(storeId: string, limit: number) {
  return prisma.$queryRaw<
    Array<{
      productId: string;
      name: string;
      sku: string;
      quantity: Prisma.Decimal;
      reorderLevel: Prisma.Decimal;
      reorderQty: Prisma.Decimal;
    }>
  >(Prisma.sql`
    SELECT p.id AS productId, p.name, p.sku, il.quantity, p.reorderLevel, p.reorderQty
    FROM \`InventoryLevel\` il
    JOIN \`Product\` p ON p.id = il.productId
    WHERE il.storeId = ${storeId}
      AND p.trackStock = true
      AND p.isActive = true
      AND p.deletedAt IS NULL
      AND il.quantity < ${LOW_STOCK_THRESHOLD}
    ORDER BY il.quantity ASC, p.name ASC
    LIMIT ${limit}
  `);
}

async function expiringItems(storeId: string, limit: number): Promise<ExpiringItem[]> {
  const today = startOfDay();
  const end = endOfDay(addDays(today, EXPIRY_ALERT_DAYS));
  const batches = await prisma.productBatch.findMany({
    where: {
      quantity: { gt: 0 },
      expiryDate: { gte: today, lte: end },
      product: { storeId, isActive: true, deletedAt: null },
    },
    orderBy: [{ expiryDate: "asc" }, { quantity: "desc" }],
    take: limit,
    select: { id: true, productId: true, batchNumber: true, quantity: true, expiryDate: true, product: { select: { name: true, sku: true } } },
  });

  return batches.map((batch) => ({
    batchId: batch.id,
    productId: batch.productId,
    name: batch.product.name,
    sku: batch.product.sku,
    batchNumber: batch.batchNumber,
    quantity: num(batch.quantity),
    expiryDate: batch.expiryDate as Date,
    daysUntilExpiry: Math.max(0, Math.ceil((batch.expiryDate!.getTime() - today.getTime()) / 86400000)),
  }));
}

async function topProducts(storeId: string, days: number, limit: number, cashierId?: string): Promise<TopProduct[]> {
  const { from, to } = lastNDaysRange(days);

  const rows = await prisma.$queryRaw<
    Array<{ productId: string; name: string; sku: string; quantity: Prisma.Decimal; revenue: Prisma.Decimal }>
  >(Prisma.sql`
    SELECT si.productId, si.productName AS name, si.sku,
           SUM(si.quantity - si.refundedQty) AS quantity,
           SUM(si.lineTotal) AS revenue
    FROM \`SaleItem\` si
    JOIN \`Sale\` s ON s.id = si.saleId
    WHERE s.storeId = ${storeId}
      AND s.status IN (${Prisma.join([...COUNTED_STATUSES])})
      AND s.completedAt BETWEEN ${from} AND ${to}
      ${cashierId ? Prisma.sql`AND s.cashierId = ${cashierId}` : Prisma.empty}
    GROUP BY si.productId, si.productName, si.sku
    ORDER BY revenue DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    productId: row.productId,
    name: row.name,
    sku: row.sku,
    quantitySold: num(row.quantity),
    revenue: num(row.revenue),
  }));
}

async function recentTransactions(storeId: string, limit: number, cashierId?: string): Promise<RecentTransaction[]> {
  const sales = await prisma.sale.findMany({
    where: { storeId, status: { not: "DRAFT" }, ...(cashierId ? { cashierId } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      receiptNumber: true,
      total: true,
      itemCount: true,
      status: true,
      completedAt: true,
      cashier: { select: { fullName: true } },
      customer: { select: { fullName: true } },
      payments: { where: { status: "SUCCESSFUL" }, select: { method: true } },
    },
  });

  return sales.map((sale) => ({
    id: sale.id,
    receiptNumber: sale.receiptNumber,
    total: num(sale.total),
    itemCount: sale.itemCount,
    status: sale.status,
    completedAt: sale.completedAt,
    cashierName: sale.cashier.fullName,
    customerName: sale.customer?.fullName ?? null,
    methods: Array.from(new Set(sale.payments.map((payment) => payment.method))),
  }));
}

export async function getDashboardData(storeId: string, cashierId?: string): Promise<DashboardData> {
  const today = todayRange();
  const yesterday = yesterdayRange();

  const [todayTotals, yesterdayTotals, profit, payments, trend, itemsSold, lowStockRows, top, recent, lowStockTotal, expiring] =
    await Promise.all([
      salesTotals(storeId, today.from, today.to, cashierId),
      salesTotals(storeId, yesterday.from, yesterday.to, cashierId),
      grossProfit(storeId, today.from, today.to, cashierId),
      paymentTotals(storeId, today.from, today.to, cashierId),
      salesTrend(storeId, 7, cashierId),
      prisma.saleItem.aggregate({
        where: {
          sale: { storeId, status: { in: [...COUNTED_STATUSES] }, completedAt: { gte: today.from, lte: today.to }, ...(cashierId ? { cashierId } : {}) },
        },
        _sum: { quantity: true, refundedQty: true },
      }),
      lowStock(storeId, 5),
      topProducts(storeId, 30, 5, cashierId),
      recentTransactions(storeId, 6, cashierId),
      prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(*) AS count
        FROM \`InventoryLevel\` il
        JOIN \`Product\` p ON p.id = il.productId
        WHERE il.storeId = ${storeId}
          AND p.trackStock = true
          AND p.isActive = true
          AND p.deletedAt IS NULL
          AND il.quantity < ${LOW_STOCK_THRESHOLD}
      `),
          expiringItems(storeId, 5),
    ]);

  const byMethod = (method: string) => payments.find((p) => p.method === method)?.amount ?? 0;

  return {
    summary: {
      todaySales: todayTotals.revenue,
      todayTransactions: todayTotals.transactions,
      productsSold: num(itemsSold._sum.quantity) - num(itemsSold._sum.refundedQty),
      lowStockCount: Number(lowStockTotal[0]?.count ?? 0),
      todayProfit: profit,
      cashSales: byMethod("CASH"),
      momoSales: byMethod("MOMO"),
      cardSales: byMethod("CARD_TERMINAL"),
      salesTrend: percentChange(todayTotals.revenue, yesterdayTotals.revenue),
      transactionsTrend: percentChange(todayTotals.transactions, yesterdayTotals.transactions),
    },
    salesTrend: trend,
    paymentBreakdown: payments,
    recentTransactions: recent,
    topProducts: top,
    lowStockItems: lowStockRows.map((row) => ({
      productId: row.productId,
      name: row.name,
      sku: row.sku,
      quantity: num(row.quantity),
      reorderLevel: num(row.reorderLevel),
      reorderQty: num(row.reorderQty),
    })),
    expiringItems: expiring,
  };
}

export const EMPTY_DASHBOARD: DashboardData = {
  summary: {
    todaySales: 0,
    todayTransactions: 0,
    productsSold: 0,
    lowStockCount: 0,
    todayProfit: 0,
    cashSales: 0,
    momoSales: 0,
    cardSales: 0,
    salesTrend: null,
    transactionsTrend: null,
  },
  salesTrend: Array.from({ length: 7 }, (_, index) => {
    const date = startOfDay(addDays(new Date(), -(6 - index)));
    return { label: dayLabel(date), date: date.toISOString().slice(0, 10), revenue: 0, transactions: 0 };
  }),
  paymentBreakdown: [],
  recentTransactions: [],
  topProducts: [],
  lowStockItems: [],
  expiringItems: [],
};
