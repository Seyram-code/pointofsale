import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payments/registry";
import type { PaymentMethod } from "@/lib/payments/types";
import { DECIMAL_MONEY, DECIMAL_QTY } from "@/lib/services/cart.service";
import { applySalesSummary } from "@/lib/services/sales-summary.service";
import { returnActionSchema } from "@/lib/validations/return.schema";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.RETURNS_CREATE);
    const storeId = session.user.storeId;
    if (!storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const { id } = await params;
    const { action } = returnActionSchema.parse(await request.json());

    if (action === "APPROVE" || action === "REJECT") {
      await authorize(PERMISSIONS.RETURNS_APPROVE);
      const updated = await prisma.saleReturn.updateMany({
        where: { id, storeId, status: "PENDING" },
        data: action === "APPROVE" ? { status: "APPROVED", approvedById: session.user.id, approvedAt: new Date() } : { status: "REJECTED", approvedById: session.user.id, approvedAt: new Date() },
      });
      if (updated.count === 0) throw ApiError.conflict("This return is no longer pending");
      return ok({ id, status: action === "APPROVE" ? "APPROVED" : "REJECTED" });
    }

    const returnRecord = await prisma.saleReturn.findFirst({
      where: { id, storeId, status: "APPROVED" },
      include: { items: true, sale: { include: { items: true, payments: { where: { status: "SUCCESSFUL" } } } } },
    });
    if (!returnRecord) throw ApiError.conflict("Only an approved return can be completed");

    if (["CASH", "MOMO", "CARD_TERMINAL", "CARD", "CARD_REVERSAL"].includes(returnRecord.refundMethod)) {
      const paymentMethod = returnRecord.refundMethod === "CARD_REVERSAL" ? undefined : returnRecord.refundMethod as PaymentMethod;
      const payment = returnRecord.sale.payments.find((item) => !paymentMethod || item.method === paymentMethod) ?? returnRecord.sale.payments[0];
      if (!payment) throw ApiError.badRequest("No successful payment is available for this refund");
      const provider = getPaymentProvider(payment.method as PaymentMethod);
      if (!provider.refund) throw ApiError.badRequest("This payment method does not support refunds");
      const refund = await provider.refund({ externalRef: payment.externalRef ?? "cash", amount: Number(returnRecord.total), reason: returnRecord.reason, method: payment.method as PaymentMethod });
      if (refund.state !== "REVERSED" && refund.state !== "SUCCESSFUL") throw ApiError.badRequest(refund.failureReason ?? "The payment provider rejected the refund");
    }

    const completed = await prisma.$transaction(async (tx) => {
      for (const item of returnRecord.items) {
        await tx.saleItem.update({ where: { id: item.saleItemId }, data: { refundedQty: { increment: item.quantity } } });
        if (!returnRecord.restock) continue;
        const level = await tx.inventoryLevel.upsert({ where: { storeId_productId: { storeId, productId: item.productId } }, create: { storeId, productId: item.productId, quantity: DECIMAL_QTY(0) }, update: {}, select: { quantity: true } });
        const nextQuantity = Number(level.quantity) + Number(item.quantity);
        await tx.inventoryLevel.update({ where: { storeId_productId: { storeId, productId: item.productId } }, data: { quantity: DECIMAL_QTY(nextQuantity) } });
        await tx.stockMovement.create({ data: { storeId, productId: item.productId, type: "SALE_RETURN", quantity: item.quantity, balanceAfter: DECIMAL_QTY(nextQuantity), unitCost: DECIMAL_MONEY(Number(item.unitPrice)), referenceType: "SALE_RETURN", referenceId: returnRecord.id, reason: returnRecord.reason, performedById: session.user.id } });
      }

      const refundedAmount = Number(returnRecord.sale.refundedAmount) + Number(returnRecord.total);
      const saleTotal = Number(returnRecord.sale.total);
      const refundTotal = Number(returnRecord.total);
      const refundedTax = returnRecord.items.reduce((sum, item) => sum + Number(item.taxAmount), 0);
      const refundedCost = returnRecord.items.reduce((sum, item) => {
        const saleItem = returnRecord.sale.items.find((saleItem) => saleItem.id === item.saleItemId);
        return returnRecord.restock ? sum + (Number(saleItem?.unitCost ?? 0) * Number(item.quantity)) : sum;
      }, 0);
      const paymentMethod = returnRecord.refundMethod === "CARD_REVERSAL"
        ? returnRecord.sale.payments.find((payment) => payment.method === "CARD_TERMINAL" || payment.method === "CARD")?.method
        : returnRecord.refundMethod;

      if (returnRecord.sale.shiftId) {
        await tx.shift.update({
          where: { id: returnRecord.sale.shiftId },
          data: {
            totalSales: { decrement: DECIMAL_MONEY(refundTotal) },
            totalRefunds: { increment: DECIMAL_MONEY(refundTotal) },
            ...(paymentMethod === "CASH" ? { totalCash: { decrement: DECIMAL_MONEY(refundTotal) } } : {}),
            ...(paymentMethod === "MOMO" ? { totalMomo: { decrement: DECIMAL_MONEY(refundTotal) } } : {}),
            ...(paymentMethod === "CARD" || paymentMethod === "CARD_TERMINAL" ? { totalCard: { decrement: DECIMAL_MONEY(refundTotal) } } : {}),
          },
        });
      }

      await applySalesSummary(tx, storeId, new Date(), {
        grossSales: 0,
        discountTotal: 0,
        taxTotal: -refundedTax,
        refundTotal,
        costOfGoods: -refundedCost,
        cashTotal: paymentMethod === "CASH" ? -refundTotal : 0,
        momoTotal: paymentMethod === "MOMO" ? -refundTotal : 0,
        cardTerminalTotal: paymentMethod === "CARD_TERMINAL" ? -refundTotal : 0,
        cardTotal: paymentMethod === "CARD" ? -refundTotal : 0,
        otherTotal: paymentMethod === "STORE_CREDIT" ? -refundTotal : 0,
        transactionCount: 0,
        itemCount: -returnRecord.items.reduce((sum, item) => sum + Number(item.quantity), 0),
      });

      await tx.sale.update({ where: { id: returnRecord.saleId }, data: { refundedAmount: DECIMAL_MONEY(refundedAmount), status: refundedAmount + 0.001 >= saleTotal ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
      return tx.saleReturn.update({ where: { id: returnRecord.id }, data: { status: "COMPLETED" }, select: { id: true, returnNumber: true, status: true } });
    });

    return ok(completed);
  } catch (error) {
    return handleApiError(error);
  }
}
