import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { startOfDay } from "@/lib/utils/date";

type TxClient = Prisma.TransactionClient | typeof prisma;

export interface SalesSummaryDelta {
  grossSales: number;
  discountTotal: number;
  taxTotal: number;
  refundTotal: number;
  costOfGoods: number;
  cashTotal: number;
  momoTotal: number;
  cardTerminalTotal: number;
  cardTotal: number;
  otherTotal: number;
  transactionCount: number;
  itemCount: number;
}

const money = (value: number) => new Prisma.Decimal(value.toFixed(2));
const qty = (value: number) => new Prisma.Decimal(value.toFixed(3));

/**
 * Applies a signed delta to the day's rollup. Sales pass positive values and
 * refunds pass negative ones, so the table stays correct without a rebuild.
 */
export async function applySalesSummary(
  client: TxClient,
  storeId: string,
  when: Date,
  delta: SalesSummaryDelta,
): Promise<void> {
  const date = startOfDay(when);
  const netSales = delta.grossSales - delta.refundTotal;
  const grossProfit = netSales - delta.taxTotal - delta.costOfGoods;

  await client.dailySalesSummary.upsert({
    where: { storeId_date: { storeId, date } },
    create: {
      storeId,
      date,
      grossSales: money(delta.grossSales),
      discountTotal: money(delta.discountTotal),
      taxTotal: money(delta.taxTotal),
      refundTotal: money(delta.refundTotal),
      netSales: money(netSales),
      costOfGoods: money(delta.costOfGoods),
      grossProfit: money(grossProfit),
      cashTotal: money(delta.cashTotal),
      momoTotal: money(delta.momoTotal),
      cardTerminalTotal: money(delta.cardTerminalTotal),
      cardTotal: money(delta.cardTotal),
      otherTotal: money(delta.otherTotal),
      transactionCount: delta.transactionCount,
      itemCount: qty(delta.itemCount),
    },
    update: {
      grossSales: { increment: money(delta.grossSales) },
      discountTotal: { increment: money(delta.discountTotal) },
      taxTotal: { increment: money(delta.taxTotal) },
      refundTotal: { increment: money(delta.refundTotal) },
      netSales: { increment: money(netSales) },
      costOfGoods: { increment: money(delta.costOfGoods) },
      grossProfit: { increment: money(grossProfit) },
      cashTotal: { increment: money(delta.cashTotal) },
      momoTotal: { increment: money(delta.momoTotal) },
      cardTerminalTotal: { increment: money(delta.cardTerminalTotal) },
      cardTotal: { increment: money(delta.cardTotal) },
      otherTotal: { increment: money(delta.otherTotal) },
      transactionCount: { increment: delta.transactionCount },
      itemCount: { increment: qty(delta.itemCount) },
    },
  });
}

export async function getSalesSummaries(storeId: string, from: Date, to: Date) {
  return prisma.dailySalesSummary.findMany({
    where: { storeId, date: { gte: startOfDay(from), lte: startOfDay(to) } },
    orderBy: { date: "asc" },
  });
}
