import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/response";
import { nextNumber } from "@/lib/services/numbering.service";
import { DECIMAL_MONEY, DECIMAL_QTY } from "@/lib/services/cart.service";
import { calculateOfflineSaleTotals } from "@/lib/utils/offline-pos";

export interface OfflineDraftSalePayload {
  id: string;
  customerId?: string | null;
  note?: string | null;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  createdAt: string;
}

export async function createOfflineDraftSale(storeId: string, cashierId: string | null, payload: OfflineDraftSalePayload) {
  const payloadValue = payload as unknown as Prisma.InputJsonValue;
  return prisma.offlineSaleDraft.create({
    data: {
      storeId,
      cashierId,
      payload: payloadValue,
    },
  });
}

export async function processOfflineDraftSale(storeId: string, cashierId: string | null, payload: OfflineDraftSalePayload) {
  if (!cashierId) throw ApiError.badRequest("Cashier is required to sync an offline sale");

  const itemIds = [...new Set(payload.items.map((item) => item.productId))];
  if (itemIds.length === 0) throw ApiError.badRequest("Offline sale is empty");

  const products = await prisma.product.findMany({
    where: { id: { in: itemIds }, storeId, deletedAt: null },
    select: {
      id: true,
      name: true,
      sku: true,
      costPrice: true,
      trackStock: true,
      taxRate: { select: { rate: true } },
      barcodes: { where: { isPrimary: true }, take: 1, select: { code: true } },
    },
  });

  const productMap = new Map(products.map((product) => [product.id, product]));
  const missing = itemIds.filter((productId) => !productMap.has(productId));
  if (missing.length > 0) {
    throw ApiError.notFound(`Some products are no longer available: ${missing[0]}`);
  }

  const totals = calculateOfflineSaleTotals(payload);

  return prisma.$transaction(async (tx) => {
    const receiptNumber = await nextNumber(tx, storeId, "RECEIPT");

    const sale = await tx.sale.create({
      data: {
        storeId,
        cashierId,
        customerId: payload.customerId ?? null,
        receiptNumber,
        status: "COMPLETED",
        subtotal: DECIMAL_MONEY(totals.subtotal),
        discountAmount: DECIMAL_MONEY(0),
        taxAmount: DECIMAL_MONEY(0),
        total: DECIMAL_MONEY(totals.total),
        amountPaid: DECIMAL_MONEY(totals.total),
        changeDue: DECIMAL_MONEY(0),
        itemCount: totals.itemCount,
        note: payload.note ?? null,
        completedAt: new Date(),
        items: {
          create: payload.items.map((item) => {
            const product = productMap.get(item.productId)!;
            return {
              productId: item.productId,
              productName: product.name,
              sku: product.sku,
              barcode: product.barcodes[0]?.code ?? null,
              quantity: DECIMAL_QTY(item.quantity),
              unitPrice: DECIMAL_MONEY(item.unitPrice),
              unitCost: DECIMAL_MONEY(Number(product.costPrice)),
              taxRate: new Prisma.Decimal(product.taxRate ? Number(product.taxRate.rate).toFixed(4) : "0"),
              taxAmount: DECIMAL_MONEY(0),
              lineTotal: DECIMAL_MONEY(item.quantity * item.unitPrice),
            };
          }),
        },
        payments: {
          create: [{
            method: "CASH",
            status: "SUCCESSFUL",
            amount: DECIMAL_MONEY(totals.total),
            tenderedAmount: DECIMAL_MONEY(totals.total),
            changeAmount: DECIMAL_MONEY(0),
            paidAt: new Date(),
          }],
        },
      },
      select: { id: true },
    });

    for (const item of payload.items) {
      const product = productMap.get(item.productId)!;
      if (!product.trackStock) continue;

      const stockUpdate = await tx.inventoryLevel.updateMany({
        where: {
          storeId,
          productId: item.productId,
          quantity: { gte: DECIMAL_QTY(item.quantity) },
        },
        data: { quantity: { decrement: DECIMAL_QTY(item.quantity) } },
      });

      if (stockUpdate.count !== 1) {
        throw ApiError.badRequest(`Insufficient stock for ${product.name}`);
      }

      const level = await tx.inventoryLevel.findUniqueOrThrow({
        where: { storeId_productId: { storeId, productId: item.productId } },
        select: { quantity: true },
      });

      await tx.stockMovement.create({
        data: {
          storeId,
          productId: item.productId,
          type: "SALE",
          quantity: DECIMAL_QTY(-item.quantity),
          balanceAfter: level.quantity,
          unitCost: DECIMAL_MONEY(Number(product.costPrice)),
          referenceType: "SALE",
          referenceId: sale.id,
          performedById: cashierId,
        },
      });
    }

    if (payload.customerId) {
      await tx.customer.updateMany({
        where: { id: payload.customerId, storeId, isActive: true, deletedAt: null },
        data: {
          totalSpent: { increment: DECIMAL_MONEY(totals.total) },
          visitCount: { increment: 1 },
          lastVisitAt: new Date(),
        },
      });
    }

    await tx.offlineSaleDraft.update({
      where: { id: payload.id },
      data: { syncedAt: new Date() },
    });

    return sale.id;
  });
}

export async function listOfflineDraftSales(storeId: string) {
  return prisma.offlineSaleDraft.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
  });
}

export async function syncOfflineDraftSales(storeId: string, cashierId: string | null) {
  const drafts = await prisma.offlineSaleDraft.findMany({
    where: { storeId, syncedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const results = [] as Array<{ id: string; saleId: string | null; createdAt: Date }>;

  for (const draft of drafts) {
    try {
      const payload = draft.payload as unknown as OfflineDraftSalePayload;
      const saleId = await processOfflineDraftSale(storeId, cashierId, { ...payload, id: draft.id });
      results.push({ id: draft.id, saleId, createdAt: draft.createdAt });
    } catch {
      // Keep failed draft entries for retry once the issue is resolved.
    }
  }

  return results;
}
