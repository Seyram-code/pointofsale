import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type PaymentMethod as PrismaPaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/response";
import { getPaymentProvider } from "@/lib/payments/registry";
import { PaymentError } from "@/lib/payments/errors";
import { isLivePaystackMethod } from "@/lib/payments/config";
import { calculatePaystackFee } from "@/lib/payments/paystack-fee";
import { expireUnresolvedPaystackPayment } from "@/lib/payments/paystack-status";
import { nextNumber } from "@/lib/services/numbering.service";
import { DECIMAL_MONEY, DECIMAL_QTY, persistSaleItemOptions, priceCart, saleItemCreateData, type PricedCart } from "@/lib/services/cart.service";
import { generateReceipt, type ReceiptPayload } from "@/lib/services/receipt.service";
import { applySalesSummary } from "@/lib/services/sales-summary.service";
import { addMoney, fromPesewas, subtractMoney, toPesewas } from "@/lib/utils/money";
import type { SaleContext } from "@/lib/services/sale.service";
import type { CheckoutInput, PaymentInput } from "@/lib/validations/sale.schema";
import type { PaymentRequest, PaymentResult } from "@/lib/payments/types";

export interface CheckoutResult {
  saleId: string;
  receiptNumber: string;
  status: "COMPLETED" | "AWAITING_PAYMENT" | "FAILED";
  total: number;
  paymentFee: number;
  amountDue: number;
  amountPaid: number;
  changeDue: number;
  itemCount: number;
  orderItems?: Array<{ productId: string; sku: string; quantity: number }>;
  payments: Array<{
    id: string;
    method: string;
    state: string;
    amount: number;
    message?: string;
    authorizationUrl?: string;
    failureReason?: string;
  }>;
  receipt: ReceiptPayload | null;
}

function toPaymentRequest(
  payment: PaymentInput,
  context: SaleContext,
  receiptNumber: string,
  saleId: string,
  paymentId: string,
): PaymentRequest {
  const paymentReference = `POS-${saleId}-${paymentId}`;
  return {
    method: payment.method,
    amount: payment.amount,
    currency: "GHS",
    reference: paymentReference,
    description: `Sale ${receiptNumber}`,
    storeId: context.storeId,
    cashierId: context.cashierId,
    saleId,
    metadata: { receipt_number: receiptNumber },
    cash: payment.method === "CASH" ? { tenderedAmount: payment.tenderedAmount ?? payment.amount } : undefined,
    momo:
      payment.method === "MOMO" && payment.momoPhone
        ? { network: payment.momoNetwork ?? "MTN", phone: payment.momoPhone, email: payment.momoEmail }
        : undefined,
    terminal: payment.method === "CARD_TERMINAL" ? { terminalId: payment.terminalId } : undefined,
    card: payment.method === "CARD"
      ? { scheme: payment.cardScheme, last4: payment.cardLast4, email: payment.cardEmail }
      : undefined,
  };
}

/**
 * Checkout runs in three phases so that no database transaction is ever held
 * open across a payment-gateway network call:
 *   1. persist the sale and PENDING payments
 *   2. call the provider(s)
 *   3. finalise (or fail) in a second transaction
 */
export async function checkout(input: CheckoutInput, context: SaleContext & { appUrl?: string; settlementSubaccountCode?: string }): Promise<CheckoutResult> {
  if (context.businessType === "RESTAURANT") {
    if (!input.orderType) throw ApiError.badRequest("Choose an order type");
  }
  const cart = await priceCart(context.storeId, input.items, input.discount, context.allowPriceOverride);

  const hasPaystackPayment = input.payments.some((payment) =>
    (payment.method === "CARD" || payment.method === "MOMO") && isLivePaystackMethod(payment.method),
  );
  const nonPaystackAmount = addMoney(...input.payments
    .filter((payment) => !((payment.method === "CARD" || payment.method === "MOMO") && isLivePaystackMethod(payment.method)))
    .map((payment) => payment.amount));
  const paystackBaseAmount = Math.max(subtractMoney(cart.totals.total, nonPaystackAmount), 0);
  const paymentFee = hasPaystackPayment ? calculatePaystackFee(paystackBaseAmount) : 0;
  const amountDue = addMoney(cart.totals.total, paymentFee);
  const requestedTotal = addMoney(...input.payments.map((payment) => payment.amount));
  if (requestedTotal + 0.001 < amountDue) {
    throw ApiError.badRequest("Payments do not cover the total due");
  }

  const { saleId, receiptNumber, paymentRows } = await createPendingSale(input, context, cart, paymentFee);

  const results: Array<{ id: string; input: PaymentInput; result: PaymentResult }> = [];

  for (const row of paymentRows) {
    const provider = getPaymentProvider(row.input.method);
    try {
      const paymentRequest = toPaymentRequest(row.input, context, receiptNumber, saleId, row.id);
      paymentRequest.settlementSubaccountCode = context.settlementSubaccountCode;
      if (context.appUrl) {
        paymentRequest.callbackUrl = `${context.appUrl}/pos?payment_sale=${encodeURIComponent(saleId)}`;
      }
      const result = await provider.initiate(paymentRequest);
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
    await releaseSaleStock(saleId, context);
    return {
      saleId,
      receiptNumber,
      status: "FAILED",
      total: cart.totals.total,
      paymentFee,
      amountDue,
      amountPaid: 0,
      changeDue: 0,
      itemCount: cart.lines.length,
      orderItems: cart.lines.map((line) => ({ productId: line.productId, sku: line.sku, quantity: line.quantity, optionIds: line.optionIds, selectedOptions: line.selectedOptions })),
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
      paymentFee,
      amountDue,
      amountPaid: 0,
      changeDue: 0,
      itemCount: cart.lines.length,
      payments: results.map((entry) => ({
        id: entry.id,
        method: entry.input.method,
        state: entry.result.state,
        amount: entry.result.amount,
        message: entry.result.message,
        authorizationUrl: entry.result.authorizationUrl,
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
    paymentFee: finalised.paymentFee,
    amountDue: finalised.amountDue,
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

async function createPendingSale(input: CheckoutInput, context: SaleContext, cart: PricedCart, paymentFee: number) {
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
        where: { id: input.resumeSaleId, storeId: context.storeId, status: "DRAFT", payments: { none: {} } },
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
        paymentFee: DECIMAL_MONEY(paymentFee),
        itemCount: cart.lines.length,
        note: input.note ?? null,
        items: { create: saleItemCreateData(cart.lines) },
      },
      select: { id: true, receiptNumber: true },
    });

    if (context.businessType === "RESTAURANT") {
      await tx.$executeRaw(Prisma.sql`
        UPDATE Sale
        SET orderType = ${input.orderType},
            tableNumber = ${input.orderType === "DINE_IN" ? input.tableNumber?.trim() ?? null : null}
        WHERE id = ${sale.id}
      `);
    }
    await persistSaleItemOptions(tx, sale.id, cart.lines);

    for (const line of cart.lines) {
      if (!line.trackStock) continue;

      await tx.inventoryLevel.upsert({
        where: { storeId_productId: { storeId: context.storeId, productId: line.productId } },
        create: { storeId: context.storeId, productId: line.productId, quantity: DECIMAL_QTY(0) },
        update: {},
        select: { id: true },
      });

      const stockUpdate = await tx.inventoryLevel.updateMany({
        where: {
          storeId: context.storeId,
          productId: line.productId,
          quantity: { gte: DECIMAL_QTY(line.quantity) },
        },
        data: { quantity: { decrement: DECIMAL_QTY(line.quantity) } },
      });
      if (stockUpdate.count !== 1) {
        throw ApiError.badRequest(`${line.name} has insufficient stock to complete this sale`);
      }

      const level = await tx.inventoryLevel.findUniqueOrThrow({
        where: { storeId_productId: { storeId: context.storeId, productId: line.productId } },
        select: { quantity: true },
      });

      await tx.stockMovement.create({
        data: {
          storeId: context.storeId,
          productId: line.productId,
          type: "SALE",
          quantity: DECIMAL_QTY(-line.quantity),
          balanceAfter: level.quantity,
          unitCost: DECIMAL_MONEY(line.unitCost),
          referenceType: "SALE_RESERVATION",
          referenceId: sale.id,
          performedById: context.cashierId,
        },
      });
    }

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

export async function releaseSaleStock(saleId: string, context: Pick<SaleContext, "storeId" | "cashierId">) {
  await prisma.$transaction((tx) =>
    releaseSaleStockInTransaction(tx, saleId, context, "Failed or cancelled checkout"),
  );
}

async function releaseSaleStockInTransaction(
  tx: Prisma.TransactionClient,
  saleId: string,
  context: Pick<SaleContext, "storeId" | "cashierId">,
  reason: string,
) {
  const voided = await tx.sale.updateMany({
    where: { id: saleId, storeId: context.storeId, status: "DRAFT" },
    data: { status: "VOIDED" },
  });
  if (voided.count !== 1) return false;

  const claims = await tx.stockMovement.findMany({
    where: { referenceType: "SALE_RESERVATION", referenceId: saleId },
    select: { productId: true, quantity: true, unitCost: true },
  });
  const releases = new Map<string, { quantity: number; unitCost: Prisma.Decimal | null }>();
  for (const claim of claims) {
    const previous = releases.get(claim.productId);
    releases.set(claim.productId, {
      quantity: (previous?.quantity ?? 0) + Math.abs(Number(claim.quantity)),
      unitCost: previous?.unitCost ?? claim.unitCost,
    });
  }

  for (const [productId, release] of releases) {
    await tx.inventoryLevel.update({
      where: { storeId_productId: { storeId: context.storeId, productId } },
      data: { quantity: { increment: DECIMAL_QTY(release.quantity) } },
    });
    const level = await tx.inventoryLevel.findUniqueOrThrow({
      where: { storeId_productId: { storeId: context.storeId, productId } },
      select: { quantity: true },
    });
    await tx.stockMovement.create({
      data: {
        storeId: context.storeId,
        productId,
        type: "ADJUSTMENT_IN",
        quantity: DECIMAL_QTY(release.quantity),
        balanceAfter: level.quantity,
        unitCost: release.unitCost,
        referenceType: "SALE_RESERVATION_RELEASE",
        referenceId: saleId,
        reason,
        performedById: context.cashierId,
      },
    });
  }
  return true;
}

/**
 * Runs everything that must happen once money is confirmed: complete the sale,
 * write the ledger, update the customer, shift, daily report
 * rollup, and issue the receipt — atomically.
 */
export async function finalizeSale(saleId: string, context: SaleContext) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, storeId: context.storeId },
      include: { items: true, payments: true },
    });

    if (!sale) throw ApiError.notFound("Sale");
    if (sale.status !== "DRAFT") throw ApiError.conflict("This sale is no longer pending");

    const successful = sale.payments.filter((payment) => payment.status === "SUCCESSFUL");
    const amountPaid = addMoney(...successful.map((payment) => Number(payment.amount)));
    const total = Number(sale.total);
    const paymentFee = Number(sale.paymentFee);
    const amountDue = addMoney(total, paymentFee);

    if (amountPaid + 0.001 < amountDue) {
      throw ApiError.badRequest("Payments do not cover the total due");
    }

    const tendered = addMoney(
      ...successful.map((payment) => Number(payment.tenderedAmount ?? payment.amount)),
    );
    const changeDue = Math.max(subtractMoney(tendered, amountDue), 0);
    const completedAt = new Date();

    const completedSale = await tx.sale.updateMany({
      where: { id: sale.id, storeId: context.storeId, status: "DRAFT" },
      data: {
        status: "COMPLETED",
        amountPaid: DECIMAL_MONEY(amountPaid),
        changeDue: DECIMAL_MONEY(changeDue),
        completedAt,
      },
    });
    if (completedSale.count !== 1) throw ApiError.conflict("This sale is no longer pending");

    const [orderDetails] = await tx.$queryRaw<Array<{ orderType: string | null }>>(Prisma.sql`
      SELECT orderType FROM Sale WHERE id = ${sale.id} AND storeId = ${sale.storeId}
    `);
    if (orderDetails?.orderType) {
      await tx.$executeRaw(Prisma.sql`
        INSERT IGNORE INTO KitchenTicket (id, storeId, saleId, status, createdAt, updatedAt)
        VALUES (${randomUUID()}, ${sale.storeId}, ${sale.id}, 'NEW', ${completedAt}, ${completedAt})
      `);
    }

    let costOfGoods = 0;
    let unitCount = 0;

    for (const item of sale.items) {
      const quantity = Number(item.quantity);
      unitCount += quantity;
      costOfGoods += Number(item.unitCost) * quantity;

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

    const paystackMethods = (["MOMO", "CARD"] as const).filter(isLivePaystackMethod);
    const paystackAmounts = paystackMethods
      .map((method) => [method, addMoney(...successful.filter((payment) => payment.method === method).map((payment) => Number(payment.amount)))] as const)
      .filter(([, amount]) => amount > 0);
    const paystackAmount = addMoney(...paystackAmounts.map(([, amount]) => amount));
    const feeAllocations = new Map<string, number>();
    let allocatedFeePesewas = 0;
    for (const [index, [method, amount]] of paystackAmounts.entries()) {
      const feeSharePesewas = index === paystackAmounts.length - 1
        ? toPesewas(paymentFee) - allocatedFeePesewas
        : Math.round(toPesewas(paymentFee) * toPesewas(amount) / toPesewas(paystackAmount));
      feeAllocations.set(method, fromPesewas(feeSharePesewas));
      allocatedFeePesewas += feeSharePesewas;
    }
    const byMethod = (method: string) => subtractMoney(
      addMoney(...successful.filter((payment) => payment.method === method).map((payment) => Number(payment.amount))),
      feeAllocations.get(method) ?? 0,
    );

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
      paymentFee,
      amountDue,
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
    include: { payments: true, items: true },
  });

  if (!sale) throw ApiError.notFound("Sale");

  for (const payment of sale.payments) {
    if (payment.status !== "PROCESSING" && payment.status !== "PENDING") continue;
    if (!payment.externalRef) continue;

    const provider = getPaymentProvider(payment.method as "CASH" | "MOMO" | "CARD_TERMINAL" | "CARD");
    if (!provider.getStatus) continue;

    let result = await provider.getStatus(payment.externalRef);
    if (result.state === "SUCCESSFUL" && Math.abs(result.amount - Number(payment.amount)) >= 0.01) {
      result.state = "PROCESSING";
      result.failureReason = "Provider amount did not match the sale amount";
    }
    result = expireUnresolvedPaystackPayment(result, payment.createdAt);
    await persistPaymentResults([{ id: payment.id, result }]);
  }

  const refreshed = await prisma.payment.findMany({ where: { saleId }, select: { id: true, method: true, status: true, amount: true, failureReason: true } });
  const hasFailedPayment = refreshed.some((payment) => payment.status === "FAILED" || payment.status === "CANCELLED");
  if (hasFailedPayment) {
    await releaseSaleStock(saleId, context);
  }
  const allSettled = refreshed.every((payment) => payment.status === "SUCCESSFUL");
  const failedOrderItems = hasFailedPayment
    ? await getSaleOrderItems(sale.id, sale.items.map((item) => ({ id: item.id, productId: item.productId, sku: item.sku, quantity: Number(item.quantity) })))
    : undefined;

  const base: CheckoutResult = {
    saleId,
    receiptNumber: sale.receiptNumber,
    status: allSettled ? "COMPLETED" : hasFailedPayment ? "FAILED" : "AWAITING_PAYMENT",
    total: Number(sale.total),
    paymentFee: Number(sale.paymentFee),
    amountDue: addMoney(Number(sale.total), Number(sale.paymentFee)),
    amountPaid: 0,
    changeDue: 0,
    itemCount: sale.itemCount,
    ...(failedOrderItems ? { orderItems: failedOrderItems } : {}),
    payments: refreshed.map((payment) => ({
      id: payment.id,
      method: payment.method,
      state: payment.status,
      amount: Number(payment.amount),
      failureReason: payment.failureReason ?? undefined,
    })),
    receipt: null,
  };

  if (!allSettled) return base;
  if (sale.status === "COMPLETED") {
    const storedReceipt = await prisma.receipt.findFirst({
      where: { saleId },
      orderBy: { createdAt: "desc" },
      select: { payload: true },
    });
    return {
      ...base,
      amountPaid: Number(sale.amountPaid),
      changeDue: Number(sale.changeDue),
      receipt: storedReceipt ? storedReceipt.payload as unknown as ReceiptPayload : null,
    };
  }

  const finalised = await finalizeSale(saleId, context);
  return {
    ...base,
    status: "COMPLETED",
    paymentFee: finalised.paymentFee,
    amountDue: finalised.amountDue,
    amountPaid: finalised.amountPaid,
    changeDue: finalised.changeDue,
    receipt: finalised.receipt,
  };
}

async function getSaleOrderItems(
  saleId: string,
  items: Array<{ id: string; productId: string; sku: string; quantity: number }>,
) {
  const optionRows = await prisma.$queryRaw<Array<{ id: string; optionsJson: string | null }>>(Prisma.sql`
    SELECT id, optionsJson FROM SaleItem WHERE saleId = ${saleId}
  `);
  const optionMap = new Map(optionRows.map((row) => [row.id, row.optionsJson ? JSON.parse(row.optionsJson) as Array<{ id: string; name: string; priceDelta: number }> : []]));
  return items.map((item) => {
    const selectedOptions = optionMap.get(item.id) ?? [];
    return { productId: item.productId, sku: item.sku, quantity: item.quantity, optionIds: selectedOptions.map((option) => option.id), selectedOptions };
  });
}

export async function listFailedPaymentSales(storeId: string, cashierId?: string) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sales = await prisma.sale.findMany({
    where: {
      storeId,
      createdAt: { gte: since },
      ...(cashierId ? { cashierId } : {}),
      OR: [
        { status: "DRAFT", payments: { some: { method: { in: ["MOMO", "CARD"] }, status: { in: ["PENDING", "PROCESSING"] } } } },
        { status: "VOIDED", payments: { some: { method: { in: ["MOMO", "CARD"] }, status: { in: ["FAILED", "CANCELLED"] } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      receiptNumber: true,
      status: true,
      total: true,
      createdAt: true,
      items: { select: { productName: true, quantity: true } },
      payments: {
        where: { method: { in: ["MOMO", "CARD"] } },
        select: { method: true, status: true, failureReason: true },
      },
    },
  });

  return sales.map((sale) => ({
    id: sale.id,
    receiptNumber: sale.receiptNumber,
    status: sale.status,
    total: Number(sale.total),
    createdAt: sale.createdAt,
    items: sale.items.map((item) => ({ name: item.productName, quantity: Number(item.quantity) })),
    payments: sale.payments.map((payment) => ({
      method: payment.method,
      status: payment.status,
      failureReason: payment.failureReason,
    })),
  }));
}

export async function checkOrReleaseFailedPaymentSale(
  saleId: string,
  context: SaleContext,
  forceRelease: boolean,
) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, storeId: context.storeId },
    include: { payments: true, items: true },
  });
  if (!sale) throw ApiError.notFound("Failed sale");

  if (sale.status === "COMPLETED") {
    return { status: "COMPLETED" as const, released: false, requiresConfirmation: false };
  }
  if (sale.status === "VOIDED") {
    const alreadyFailed = sale.payments.some(
      (payment) => (payment.method === "MOMO" || payment.method === "CARD") &&
        (payment.status === "FAILED" || payment.status === "CANCELLED"),
    );
    if (!alreadyFailed) throw ApiError.conflict("This sale was not voided because of a failed hosted payment.");
    return { status: "FAILED" as const, released: true, requiresConfirmation: false };
  }

  const pendingPayments = sale.payments.filter(
    (payment) => payment.status === "PENDING" || payment.status === "PROCESSING",
  );
  if (pendingPayments.length === 0 || pendingPayments.some((payment) => !payment.externalRef)) {
    throw ApiError.conflict("This sale has no unresolved hosted payment to release.");
  }

  const statusResults: Array<{ payment: (typeof pendingPayments)[number]; result: PaymentResult }> = [];
  for (const payment of pendingPayments) {
    const provider = getPaymentProvider(payment.method as "MOMO" | "CARD");
    if (!provider.getStatus) throw ApiError.conflict("This payment provider cannot verify payment status.");
    let result = await provider.getStatus(payment.externalRef!);
    if (result.state === "SUCCESSFUL" && Math.abs(result.amount - Number(payment.amount)) >= 0.01) {
      result.state = "PROCESSING";
      result.failureReason = "Provider amount did not match the sale amount";
    }
    result = expireUnresolvedPaystackPayment(result, payment.createdAt);
    statusResults.push({ payment, result });
  }

  const resultsByPaymentId = new Map(statusResults.map(({ payment, result }) => [payment.id, result]));
  const allPaymentsSuccessful = sale.payments.every(
    (payment) => payment.status === "SUCCESSFUL" || resultsByPaymentId.get(payment.id)?.state === "SUCCESSFUL",
  );
  if (allPaymentsSuccessful) {
    await persistPaymentResults(statusResults.map(({ payment, result }) => ({ id: payment.id, result })));
    const finalized = await finalizeSale(saleId, context);
    return {
      status: "COMPLETED" as const,
      released: false,
      requiresConfirmation: false,
      receiptNumber: sale.receiptNumber,
      receipt: finalized.receipt,
    };
  }

  const failed = statusResults.find(({ result }) => result.state === "FAILED" || result.state === "CANCELLED");
  if (failed) {
    await persistPaymentResults(statusResults.map(({ payment, result }) => ({ id: payment.id, result })));
    await releaseSaleStock(saleId, context);
    return { status: "FAILED" as const, released: true, requiresConfirmation: false };
  }

  if (sale.payments.some((payment) => payment.status === "SUCCESSFUL")) {
    throw ApiError.conflict("A payment on this sale has already succeeded. Contact a manager before releasing stock.");
  }

  const verifiedUnresolved = statusResults.every(
    ({ result }) => result.verified === true && (result.state === "PENDING" || result.state === "PROCESSING"),
  );
  if (!verifiedUnresolved) {
    throw ApiError.conflict("Paystack could not verify the payment. Keep the order reserved and try again.");
  }

  if (!forceRelease) {
    return { status: "AWAITING_PAYMENT" as const, released: false, requiresConfirmation: true };
  }

  await prisma.$transaction(async (tx) => {
    const cancelled = await tx.payment.updateMany({
      where: {
        saleId,
        status: { in: ["PENDING", "PROCESSING"] },
        id: { in: pendingPayments.map((payment) => payment.id) },
      },
      data: {
        status: "CANCELLED",
        failureReason: "Stock manually released while payment remained unresolved. Check for a late debit.",
        paidAt: null,
      },
    });
    if (cancelled.count !== pendingPayments.length) {
      throw ApiError.conflict("Payment status changed during release. Check its status and try again.");
    }
    const released = await releaseSaleStockInTransaction(
      tx,
      saleId,
      context,
      "Manually released while payment remained unresolved",
    );
    if (!released) throw ApiError.conflict("Sale status changed during release. Refresh and try again.");
  });

  return { status: "FAILED" as const, released: true, requiresConfirmation: false, manuallyReleased: true };
}

/** Reconcile older in-flight hosted payments when the till is no longer polling. */
export async function reconcileStalePayments(options: { olderThan: Date; limit?: number }) {
  const limit = options.limit ?? 50;
  const payments = await prisma.payment.findMany({
    where: {
      status: { in: ["PENDING", "PROCESSING"] },
      externalRef: { not: null },
      method: { in: ["MOMO", "CARD"] },
      sale: { status: "DRAFT", createdAt: { lte: options.olderThan } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      saleId: true,
      method: true,
      amount: true,
      externalRef: true,
      createdAt: true,
      sale: { select: { storeId: true, cashierId: true } },
    },
  });

  let checked = 0;
  let completed = 0;
  let failed = 0;

  for (const payment of payments) {
    if (!payment.externalRef) continue;
    checked += 1;
    try {
      let result = await getPaymentProvider(payment.method as "MOMO" | "CARD").getStatus?.(payment.externalRef);
      if (!result) continue;

      if (result.state === "SUCCESSFUL" && Math.abs(result.amount - Number(payment.amount)) >= 0.01) {
        result.state = "PROCESSING";
        result.failureReason = "Provider amount did not match the sale amount";
      }

      result = expireUnresolvedPaystackPayment(result, payment.createdAt);
      if (result.state !== "SUCCESSFUL" && result.state !== "FAILED" && result.state !== "CANCELLED") continue;

      await persistPaymentResults([{ id: payment.id, result }]);

      if (result.state === "SUCCESSFUL") {
        await finalizeSale(payment.saleId, {
          storeId: payment.sale.storeId,
          cashierId: payment.sale.cashierId,
          allowPriceOverride: false,
        });
        completed += 1;
      } else if (result.state === "FAILED" || result.state === "CANCELLED") {
        await releaseSaleStock(payment.saleId, {
          storeId: payment.sale.storeId,
          cashierId: payment.sale.cashierId,
        });
        failed += 1;
      }
    } catch {
      // Keep transient gateway or database failures pending for the next run.
    }
  }

  return { checked, completed, failed };
}

export type { Prisma };
