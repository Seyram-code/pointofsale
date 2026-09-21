import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { authorize } from "@/lib/auth/guard";
import { ApiError, created, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { nextNumber } from "@/lib/services/numbering.service";
import { createReturnSchema } from "@/lib/validations/return.schema";
import { DECIMAL_MONEY, DECIMAL_QTY } from "@/lib/services/cart.service";

export async function GET(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.RETURNS_CREATE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const receiptNumber = request.nextUrl.searchParams.get("receiptNumber")?.trim();
    if (!receiptNumber) throw ApiError.badRequest("A receipt number is required");

    const sale = await prisma.sale.findFirst({
      where: { storeId: session.user.storeId, receiptNumber, status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] } },
      include: {
        customer: { select: { id: true, fullName: true } },
        items: true,
        returns: {
          where: { status: { in: ["PENDING", "APPROVED"] } },
          include: { items: true },
        },
      },
    });
    if (!sale) throw ApiError.notFound("Completed sale");

    return ok({
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      customer: sale.customer,
      items: sale.items
        .map((item) => {
          const reservedQuantity = sale.returns.reduce(
            (total, returnRecord) => total + returnRecord.items
              .filter((returnItem) => returnItem.saleItemId === item.id)
              .reduce((quantity, returnItem) => quantity + Number(returnItem.quantity), 0),
            0,
          );
          return {
            id: item.id,
            productId: item.productId,
            name: item.productName,
            sku: item.sku,
            quantity: Number(item.quantity),
            returnedQuantity: Number(item.refundedQty) + reservedQuantity,
            availableQuantity: Math.max(Number(item.quantity) - Number(item.refundedQty) - reservedQuantity, 0),
            unitPrice: Number(item.unitPrice),
            taxAmount: Number(item.taxAmount),
            lineTotal: Number(item.lineTotal),
          };
        })
        .filter((item) => item.availableQuantity > 0),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.RETURNS_CREATE);
    const storeId = session.user.storeId;
    if (!storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const input = createReturnSchema.parse(await request.json());
    const itemIds = input.items.map((item) => item.saleItemId);
    if (new Set(itemIds).size !== itemIds.length) {
      throw ApiError.badRequest("Each sale item can only appear once in a return");
    }

    const sale = await prisma.sale.findFirst({
      where: { storeId, receiptNumber: input.receiptNumber, status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] } },
      include: {
        items: { where: { id: { in: itemIds } } },
        returns: {
          where: { status: { in: ["PENDING", "APPROVED"] } },
          include: { items: true },
        },
        customer: { select: { id: true } },
      },
    });
    if (!sale) throw ApiError.notFound("Completed sale");
    if (sale.items.length !== itemIds.length) throw ApiError.badRequest("Some return items do not belong to this sale");

    const itemMap = new Map(sale.items.map((item) => [item.id, item]));
    const calculated = input.items.map((inputItem) => {
      const item = itemMap.get(inputItem.saleItemId);
      if (!item) throw ApiError.notFound("Sale item");
      const reservedQuantity = sale.returns.reduce(
        (total, returnRecord) => total + returnRecord.items
          .filter((returnItem) => returnItem.saleItemId === item.id)
          .reduce((quantity, returnItem) => quantity + Number(returnItem.quantity), 0),
        0,
      );
      const available = Number(item.quantity) - Number(item.refundedQty) - reservedQuantity;
      if (inputItem.quantity > available) throw ApiError.badRequest(`Only ${available} unit(s) of ${item.productName} are available to return`);
      const ratio = inputItem.quantity / Number(item.quantity);
      return {
        ...inputItem,
        productId: item.productId,
        unitPrice: Number(item.unitPrice),
        taxAmount: Number(item.taxAmount) * ratio,
        lineTotal: Number(item.lineTotal) * ratio,
      };
    });
    const total = calculated.reduce((sum, item) => sum + item.lineTotal, 0);
    const tax = calculated.reduce((sum, item) => sum + item.taxAmount, 0);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const createdReturn = await prisma.$transaction(async (tx) => {
          const returnNumber = await nextNumber(tx, storeId, "RETURN");
          return tx.saleReturn.create({
            data: {
              storeId,
              saleId: sale.id,
              customerId: sale.customer?.id ?? null,
              returnNumber,
              refundMethod: input.refundMethod,
              subtotal: DECIMAL_MONEY(total - tax),
              taxAmount: DECIMAL_MONEY(tax),
              total: DECIMAL_MONEY(total),
              reason: input.reason,
              restock: input.restock,
              createdById: session.user.id,
              items: { create: calculated.map((item) => ({ saleItemId: item.saleItemId, productId: item.productId, quantity: DECIMAL_QTY(item.quantity), unitPrice: DECIMAL_MONEY(item.unitPrice), taxAmount: DECIMAL_MONEY(item.taxAmount), lineTotal: DECIMAL_MONEY(item.lineTotal), condition: item.condition ?? null, reason: item.reason ?? null })) },
            },
            select: { id: true, returnNumber: true, total: true, status: true },
          });
        });

        return created(createdReturn);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) {
          await nextNumber(prisma, storeId, "RETURN");
          continue;
        }
        throw error;
      }
    }

    throw new Error("Could not allocate a unique return number");
  } catch (error) {
    return handleApiError(error);
  }
}
