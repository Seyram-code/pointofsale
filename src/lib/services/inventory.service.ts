import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/response";
import { DECIMAL_MONEY, DECIMAL_QTY } from "@/lib/services/cart.service";
import type { InventoryQuery, StockAdjustmentInput, StockReceiptInput } from "@/lib/validations/inventory.schema";

function number(value: Prisma.Decimal | number | null | undefined) {
  return value === null || value === undefined ? 0 : Number(value);
}

const productSelect = {
  id: true,
  sku: true,
  name: true,
  sellingPrice: true,
  costPrice: true,
  reorderLevel: true,
  reorderQty: true,
  trackStock: true,
  isActive: true,
  category: { select: { id: true, name: true } },
  barcodes: { where: { isPrimary: true }, take: 1, select: { code: true } },
  inventoryLevels: { take: 1, select: { quantity: true, averageCost: true, updatedAt: true } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

function mapProduct(product: ProductRow) {
  const level = product.inventoryLevels[0];
  const quantity = number(level?.quantity);
  const reorderLevel = number(product.reorderLevel);
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    barcode: product.barcodes[0]?.code ?? null,
    categoryId: product.category?.id ?? null,
    categoryName: product.category?.name ?? "Uncategorised",
    quantity,
    reorderLevel,
    reorderQty: number(product.reorderQty),
    averageCost: number(level?.averageCost) || number(product.costPrice),
    costPrice: number(product.costPrice),
    sellingPrice: number(product.sellingPrice),
    trackStock: product.trackStock,
    isActive: product.isActive,
    lastUpdatedAt: level?.updatedAt ?? null,
    stockStatus: quantity <= 0 ? "out" : quantity < 10 ? "low" : "ok",
  } as const;
}

export async function listInventory(storeId: string, query: InventoryQuery) {
  const term = query.q?.trim();
  const products = await prisma.product.findMany({
    where: {
      storeId,
      isActive: true,
      trackStock: true,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(term
        ? {
            OR: [
              { name: { contains: term } },
              { sku: { contains: term } },
              { barcodes: { some: { code: { contains: term } } } },
            ],
          }
        : {}),
    },
    select: { ...productSelect, inventoryLevels: { take: 1, select: { quantity: true, averageCost: true, updatedAt: true } } },
    orderBy: { name: "asc" },
    take: query.limit,
  });

  const mapped = products.map(mapProduct);
  return query.status === "all" ? mapped : mapped.filter((product) => product.stockStatus === query.status);
}

export async function listInventoryCategories(storeId: string) {
  return prisma.category.findMany({
    where: { isActive: true, products: { some: { storeId, isActive: true, deletedAt: null } } },
    select: { id: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/** Receives stock and writes the receipt movement and audit atomically. */
export async function receiveStock(storeId: string, userId: string, input: StockReceiptInput) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: input.productId, storeId, isActive: true, deletedAt: null },
      select: { id: true, name: true, costPrice: true },
    });
    if (!product) throw ApiError.notFound("Product");

    const level = await tx.inventoryLevel.upsert({
      where: { storeId_productId: { storeId, productId: product.id } },
      create: { storeId, productId: product.id, quantity: DECIMAL_QTY(0) },
      update: {},
      select: { quantity: true, averageCost: true },
    });

    const previousQuantity = number(level.quantity);
    const nextQuantity = previousQuantity + input.quantity;
    const unitCost = input.unitCost ?? number(product.costPrice);
    const weightedCost = nextQuantity > 0
      ? (previousQuantity * number(level.averageCost) + input.quantity * unitCost) / nextQuantity
      : unitCost;

    await tx.inventoryLevel.update({
      where: { storeId_productId: { storeId, productId: product.id } },
      data: { quantity: DECIMAL_QTY(nextQuantity), averageCost: DECIMAL_MONEY(weightedCost) },
    });

    const movement = await tx.stockMovement.create({
      data: {
        storeId,
        productId: product.id,
        type: "PURCHASE_RECEIPT",
        quantity: DECIMAL_QTY(input.quantity),
        balanceAfter: DECIMAL_QTY(nextQuantity),
        unitCost: DECIMAL_MONEY(unitCost),
        referenceType: "PURCHASE_RECEIPT",
        referenceId: input.reference ?? null,
        reason: input.reason ?? "Stock received",
        performedById: userId,
      },
      select: { id: true },
    });

    if (input.batchNumber) {
      await tx.productBatch.upsert({
        where: { productId_batchNumber: { productId: product.id, batchNumber: input.batchNumber } },
        create: {
          productId: product.id,
          batchNumber: input.batchNumber,
          expiryDate: input.expiryDate,
          quantity: DECIMAL_QTY(input.quantity),
          costPrice: DECIMAL_MONEY(unitCost),
        },
        update: { quantity: { increment: DECIMAL_QTY(input.quantity) }, expiryDate: input.expiryDate },
      });
    }

    await tx.auditLog.create({
      data: {
        storeId,
        userId,
        action: "STOCK_ADJUSTMENT",
        entity: "InventoryLevel",
        entityId: product.id,
        summary: `Received ${input.quantity} unit(s) of ${product.name}`,
        changes: { quantity: { from: previousQuantity, to: nextQuantity }, movementId: movement.id, type: "PURCHASE_RECEIPT" },
      },
    });

    return { productId: product.id, productName: product.name, quantity: nextQuantity, movementId: movement.id };
  });
}

/** Adjusts stock and writes the movement plus mandatory audit in one transaction. */
export async function adjustStock(storeId: string, userId: string, input: StockAdjustmentInput) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: input.productId, storeId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!product) throw ApiError.notFound("Product");

    const level = await tx.inventoryLevel.upsert({
      where: { storeId_productId: { storeId, productId: product.id } },
      create: { storeId, productId: product.id, quantity: DECIMAL_QTY(0) },
      update: {},
      select: { quantity: true },
    });

    const previousQuantity = number(level.quantity);
    const nextQuantity = previousQuantity + input.quantity;
    if (nextQuantity < 0) throw ApiError.badRequest("Adjustment cannot reduce stock below zero");

    await tx.inventoryLevel.update({
      where: { storeId_productId: { storeId, productId: product.id } },
      data: { quantity: DECIMAL_QTY(nextQuantity) },
    });

    const movement = await tx.stockMovement.create({
      data: {
        storeId,
        productId: product.id,
        type: input.quantity > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        quantity: DECIMAL_QTY(input.quantity),
        balanceAfter: DECIMAL_QTY(nextQuantity),
        referenceType: "ADJUSTMENT",
        referenceId: input.reference ?? null,
        reason: input.reason,
        performedById: userId,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        storeId,
        userId,
        action: "STOCK_ADJUSTMENT",
        entity: "InventoryLevel",
        entityId: product.id,
        summary: `Adjusted ${product.name} by ${input.quantity}`,
        changes: {
          quantity: { from: previousQuantity, to: nextQuantity },
          reason: input.reason,
          movementId: movement.id,
          type: input.quantity > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        },
      },
    });

    return { productId: product.id, productName: product.name, quantity: nextQuantity, movementId: movement.id };
  });
}

export async function listMovements(storeId: string, options: { productId?: string; type?: string; limit: number }) {
  const movements = await prisma.stockMovement.findMany({
    where: {
      storeId,
      ...(options.productId ? { productId: options.productId } : {}),
      ...(options.type && options.type !== "all" ? { type: options.type as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options.limit,
    select: {
      id: true,
      type: true,
      quantity: true,
      balanceAfter: true,
      unitCost: true,
      reason: true,
      referenceId: true,
      createdAt: true,
      product: { select: { name: true, sku: true } },
      performedBy: { select: { fullName: true } },
    },
  });

  return movements.map((movement) => ({
    id: movement.id,
    type: movement.type,
    quantity: number(movement.quantity),
    balanceAfter: number(movement.balanceAfter),
    unitCost: number(movement.unitCost),
    reason: movement.reason,
    referenceId: movement.referenceId,
    createdAt: movement.createdAt,
    productName: movement.product.name,
    sku: movement.product.sku,
    performedBy: movement.performedBy?.fullName ?? "System",
  }));
}
