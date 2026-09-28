import "server-only";
import { Prisma, type PaymentMethod as PrismaPaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/response";
import { getPaymentProvider } from "@/lib/payments/registry";
import { PaymentError } from "@/lib/payments/errors";
import { nextNumber } from "@/lib/services/numbering.service";
import { DECIMAL_MONEY, DECIMAL_QTY, priceCart, saleItemCreateData, type PricedCart } from "@/lib/services/cart.service";
import { generateReceipt, type ReceiptPayload } from "@/lib/services/receipt.service";
import { applySalesSummary } from "@/lib/services/sales-summary.service";
import { addMoney, subtractMoney } from "@/lib/utils/money";
import type { SaleContext } from "@/lib/services/sale.service";
import type { CheckoutInput, PaymentInput } from "@/lib/validations/sale.schema";
import type { PaymentRequest, PaymentResult } from "@/lib/payments/types";

export interface CheckoutResult {
  saleId: string;
  receiptNumber: string;
  status: "COMPLETED" | "AWAITING_PAYMENT" | "FAILED";
  total: number;
  amountPaid: number;
  changeDue: number;
  itemCount: number;
  payments: Array<{
    id: string;
    method: string;
    state: string;
    amount: number;
    message?: string;
    failureReason?: string;
  }>;
  receipt: ReceiptPayload | null;
}

function toPaymentRequest(
  payment: PaymentInput,
  context: SaleContext,
  reference: string,
  saleId: string,
): PaymentRequest {
  return {
    method: payment.method,
    amount: payment.amount,
    currency: "GHS",
    reference,
    description: `Sale ${reference}`,
    storeId: context.storeId,
    cashierId: context.cashierId,
    saleId,
    cash: payment.method === "CASH" ? { tenderedAmount: payment.tenderedAmount ?? payment.amount } : undefined,
    momo:
      payment.method === "MOMO" && payment.momoPhone
        ? { network: payment.momoNetwork ?? "MTN", phone: payment.momoPhone }
        : undefined,
    terminal: payment.method === "CARD_TERMINAL" ? { terminalId: payment.terminalId } : undefined,
    card: payment.method === "CARD" ? { scheme: payment.cardScheme, last4: payment.cardLast4 } : undefined,
  };
}

/**
 * Checkout runs in three phases so that no database transaction is ever held
 * open across a payment-gateway network call:
 *   1. persist the sale and PENDING payments
 *   2. call the provider(s)
 *   3. finalise (or fail) in a second transaction
 */
export async function checkout(input: CheckoutInput, context: SaleContext): Promise<CheckoutResult> {
  const cart = await priceCart(context.storeId, input.items, input.discount, context.allowPriceOverride);

  const requestedTotal = addMoney(...input.payments.map((payment) => payment.amount));
  if (requestedTotal + 0.001 < cart.totals.total) {
    throw ApiError.badRequest("Payments do not cover the total due");
  }

  const { saleId, receiptNumber, paymentRows } = await createPendingSale(input, context, cart);

  const results: Array<{ id: string; input: PaymentInput; result: PaymentResult }> = [];

  for (const row of paymentRows) {
    const provider = getPaymentProvider(row.input.method);
    try {
      const result = await provider.initiate(toPaymentRequest(row.input, context, receiptNumber, saleId));
      results.push({ id: row.id, input: row.input, result });
      if (result.state === "FAILED" || result.state === "CANCELLED") break;
    } catch (error) {
      const failure: PaymentResult = {
        state: "FAILED",
        externalRef: null,
        amount: row.input.amount,
        failureReason:
          error instanceof PaymentError ? error.message : "The payment provider could not be reached",
      };
      results.push({ id: row.id, input: row.input, result: failure });
      break;
    }
  }

  await persistPaymentResults(results);

  const failed = results.find((entry) => entry.result.state === "FAILED" || entry.result.state === "CANCELLED");
  if (failed || results.length !== paymentRows.length) {
    return {
      saleId,
      receiptNumber,
      status: "FAILED",
      total: cart.totals.total,
      amountPaid: 0,
      changeDue: 0,
      itemCount: cart.lines.length,
      payments: results.map((entry) => ({
        id: entry.id,
        method: entry.input.method,
        state: entry.result.state,
        amount: entry.result.amount,
        failureReason: entry.result.failureReason,
      })),
      receipt: null,
    };
  }

  // MoMo and hosted-card flows settle asynchronously; the till polls for these.
  if (results.some((entry) => entry.result.state === "PROCESSING" || entry.result.state === "PENDING")) {
    return {
      saleId,
      receiptNumber,
      status: "AWAITING_PAYMENT",
      total: cart.totals.total,
      amountPaid: 0,
      changeDue: 0,
      itemCount: cart.lines.length,
      payments: results.map((entry) => ({
        id: entry.id,
        method: entry.input.method,
        state: entry.result.state,
        amount: entry.result.amount,
        message: entry.result.message,
      })),
      receipt: null,
    };
  }

  const finalised = await finalizeSale(saleId, context);

  return {
    saleId,
    receiptNumber,
    status: "COMPLETED",
    total: finalised.total,
    amountPaid: finalised.amountPaid,
    changeDue: finalised.changeDue,
    itemCount: finalised.itemCount,
    payments: results.map((entry) => ({
      id: entry.id,
      method: entry.input.method,
      state: entry.result.state,
      amount: entry.result.amount,
      message: entry.result.message,
    })),
    receipt: finalised.receipt,
  };
}

async function createPendingSale(input: CheckoutInput, context: SaleContext, cart: PricedCart) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        if (input.customerId) {
          const customer = await tx.customer.findFirst({
            where: {
              id: input.customerId,
              storeId: context.storeId,
              isActive: true,
              deletedAt: null,
            },
            select: { id: true },
          });
          if (!customer) throw ApiError.notFound("Customer");
        }

    let receiptNumber: string | null = null;

    if (input.resumeSaleId) {
      const draft = await tx.sale.findFirst({
        where: { id: input.resumeSaleId, storeId: context.storeId, status: "DRAFT" },
        select: { id: true, receiptNumber: true },
      });
      if (!draft) throw ApiError.notFound("Held sale");
      receiptNumber = draft.receiptNumber;
      await tx.sale.delete({ where: { id: draft.id } });
    }

    receiptNumber ??= await nextNumber(tx, context.storeId, "RECEIPT");

    const openShift = await tx.shift.findFirst({
      where: { storeId: context.storeId, cashierId: context.cashierId, status: "OPEN" },
      select: { id: true, registerId: true },
    });

    const sale = await tx.sale.create({
      data: {
        storeId: context.storeId,
        registerId: openShift?.registerId ?? null,
        shiftId: openShift?.id ?? null,
        cashierId: context.cashierId,
        customerId: input.customerId ?? null,
        receiptNumber,
        status: "DRAFT",
        subtotal: DECIMAL_MONEY(cart.totals.subtotal),
        discountType: input.discount?.type ?? null,
        discountValue: DECIMAL_MONEY(input.discount?.value ?? 0),
        discountAmount: DECIMAL_MONEY(cart.totals.discountAmount),
        taxAmount: DECIMAL_MONEY(cart.totals.taxAmount),
        total: DECIMAL_MONEY(cart.totals.total),
        itemCount: cart.lines.length,
        note: input.note ?? null,
        items: { create: saleItemCreateData(cart.lines) },
      },
      select: { id: true, receiptNumber: true },
    });

    const paymentRows: Array<{ id: string; input: PaymentInput }> = [];

    for (const payment of input.payments) {
      const row = await tx.payment.create({
        data: {
          saleId: sale.id,
          method: payment.method as PrismaPaymentMethod,
          status: "PENDING",
          amount: DECIMAL_MONEY(payment.amount),
          tenderedAmount: payment.tenderedAmount !== undefined ? DECIMAL_MONEY(payment.tenderedAmount) : null,
          momoNetwork: payment.momoNetwork ?? null,
          momoPhone: payment.momoPhone ?? null,
          terminalId: payment.terminalId ?? null,
        },
        select: { id: true },
      });
      paymentRows.push({ id: row.id, input: payment });
    }

        return { saleId: sale.id, receiptNumber: sale.receiptNumber, paymentRows };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) {
        // The failed transaction rolls back its sequence increment too. Advance
        // the sequence outside that transaction before retrying the sale.
        await nextNumber(prisma, context.storeId, "RECEIPT");
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not allocate a unique receipt number");
}

async function persistPaymentResults(results: Array<{ id: string; result: PaymentResult }>) {
  for (const { id, result } of results) {
    await prisma.payment.update({
      where: { id },
      data: {
        status: result.state,
        externalRef: result.externalRef,
        momoReference: result.externalRef,
        authCode: result.authCode ?? null,
        rrn: result.rrn ?? null,
        cardScheme: result.cardScheme ?? null,
        cardLast4: result.cardLast4 ?? null,
        changeAmount: result.changeAmount !== undefined ? DECIMAL_MONEY(result.changeAmount) : null,
        failureReason: result.failureReason ?? null,
        paidAt: result.state === "SUCCESSFUL" ? new Date() : null,
      },
    });
  }
}

/**
 * Runs everything that must happen once money is confirmed: complete the sale,
 * reduce inventory, write the ledger, update the customer, shift, daily report
 * rollup, and issue the receipt — atomically.
 */
export async function finalizeSale(saleId: string, context: SaleContext) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, storeId: context.storeId },
      include: { items: true, payments: true },
    });

    if (!sale) throw ApiError.notFound("Sale");
    if (sale.status === "COMPLETED") throw ApiError.conflict("This sale is already completed");

    const successful = sale.payments.filter((payment) => payment.status === "SUCCESSFUL");
    const amountPaid = addMoney(...successful.map((payment) => Number(payment.amount)));
    const total = Number(sale.total);

    if (amountPaid + 0.001 < total) {
      throw ApiError.badRequest("Payments do not cover the total due");
    }

    const tendered = addMoney(
      ...successful.map((payment) => Number(payment.tenderedAmount ?? payment.amount)),
    );
    const changeDue = Math.max(subtractMoney(tendered, total), 0);
    const completedAt = new Date();

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        status: "COMPLETED",
        amountPaid: DECIMAL_MONEY(amountPaid),
        changeDue: DECIMAL_MONEY(changeDue),
        completedAt,
      },
    });

    let costOfGoods = 0;
    let unitCount = 0;

    for (const item of sale.items) {
      const quantity = Number(item.quantity);
      unitCount += quantity;
      costOfGoods += Number(item.unitCost) * quantity;

      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { trackStock: true },
      });
      if (!product?.trackStock) continue;

      const level = await tx.inventoryLevel.upsert({
        where: { storeId_productId: { storeId: context.storeId, productId: item.productId } },
        create: { storeId: context.storeId, productId: item.productId, quantity: DECIMAL_QTY(0) },
        update: {},
        select: { quantity: true },
      });

      const balanceAfter = Number(level.quantity) - quantity;

      await tx.inventoryLevel.update({
        where: { storeId_productId: { storeId: context.storeId, productId: item.productId } },
        data: { quantity: DECIMAL_QTY(balanceAfter) },
      });

      await tx.stockMovement.create({
        data: {
          storeId: context.storeId,
          productId: item.productId,
          type: "SALE",
          quantity: DECIMAL_QTY(-quantity),
          balanceAfter: DECIMAL_QTY(balanceAfter),
          unitCost: item.unitCost,
          referenceType: "SALE",
          referenceId: sale.id,
          performedById: context.cashierId,
        },
      });
    }

    if (sale.customerId) {
      const customerUpdate = await tx.customer.updateMany({
        where: { id: sale.customerId, storeId: context.storeId },
        data: {
          totalSpent: { increment: DECIMAL_MONEY(total) },
          visitCount: { increment: 1 },
          lastVisitAt: completedAt,
        },
      });
      if (customerUpdate.count !== 1) throw ApiError.notFound("Customer");
    }

    const byMethod = (method: string) =>
      addMoney(...successful.filter((p) => p.method === method).map((p) => Number(p.amount)));

    if (sale.shiftId) {
      await tx.shift.update({
        where: { id: sale.shiftId },
        data: {
          totalSales: { increment: DECIMAL_MONEY(total) },
          totalCash: { increment: DECIMAL_MONEY(byMethod("CASH")) },
          totalMomo: { increment: DECIMAL_MONEY(byMethod("MOMO")) },
          totalCard: { increment: DECIMAL_MONEY(addMoney(byMethod("CARD_TERMINAL"), byMethod("CARD"))) },
          transactionCount: { increment: 1 },
        },
      });
    }

    await applySalesSummary(tx, context.storeId, completedAt, {
      grossSales: total,
      discountTotal: Number(sale.discountAmount),
      taxTotal: Number(sale.taxAmount),
      refundTotal: 0,
      costOfGoods,
      cashTotal: byMethod("CASH"),
      momoTotal: byMethod("MOMO"),
      cardTerminalTotal: byMethod("CARD_TERMINAL"),
      cardTotal: byMethod("CARD"),
      otherTotal: addMoney(byMethod("BANK_TRANSFER"), byMethod("STORE_CREDIT"), byMethod("VOUCHER")),
      transactionCount: 1,
      itemCount: unitCount,
    });

    const receipt = await generateReceipt(tx, sale.id);

    return {
      total,
      amountPaid,
      changeDue,
      itemCount: sale.itemCount,
      receipt,
    };
  });
}

/** Poll an in-flight payment; finalises the sale as soon as the provider confirms. */
export async function refreshPaymentStatus(saleId: string, context: SaleContext): Promise<CheckoutResult> {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, storeId: context.storeId },
    include: { payments: true },
  });

  if (!sale) throw ApiError.notFound("Sale");

  for (const payment of sale.payments) {
    if (payment.status !== "PROCESSING" && payment.status !== "PENDING") continue;
    if (!payment.externalRef) continue;

    const provider = getPaymentProvider(payment.method as "CASH" | "MOMO" | "CARD_TERMINAL" | "CARD");
    if (!provider.getStatus) continue;

    const result = await provider.getStatus(payment.externalRef);
    await persistPaymentResults([{ id: payment.id, result }]);
  }

  const refreshed = await prisma.payment.findMany({ where: { saleId }, select: { id: true, method: true, status: true, amount: true } });
  const allSettled = refreshed.every((payment) => payment.status === "SUCCESSFUL");

  const base: CheckoutResult = {
    saleId,
    receiptNumber: sale.receiptNumber,
    status: allSettled ? "COMPLETED" : refreshed.some((p) => p.status === "FAILED") ? "FAILED" : "AWAITING_PAYMENT",
    total: Number(sale.total),
    amountPaid: 0,
    changeDue: 0,
    itemCount: sale.itemCount,
    payments: refreshed.map((payment) => ({
      id: payment.id,
      method: payment.method,
      state: payment.status,
      amount: Number(payment.amount),
    })),
    receipt: null,
  };

  if (!allSettled || sale.status === "COMPLETED") return base;

  const finalised = await finalizeSale(saleId, context);
  return {
    ...base,
    status: "COMPLETED",
    amountPaid: finalised.amountPaid,
    changeDue: finalised.changeDue,
    receipt: finalised.receipt,
  };
}

export type { Prisma };
