import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/response";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments/types";

type TxClient = Prisma.TransactionClient | typeof prisma;

export interface ReceiptPayload {
  receiptNumber: string;
  issuedAt: string;
  store: {
    name: string;
    branchCode: string;
    addressLine: string | null;
    city: string | null;
    phone: string | null;
    tinNumber: string | null;
    vatNumber: string | null;
    footer: string | null;
  };
  cashier: string;
  customer: { name: string; phone: string | null } | null;
  currency: string;
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    taxAmount: number;
  }>;
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    amountPaid: number;
    changeDue: number;
  };
  payments: Array<{
    method: string;
    label: string;
    amount: number;
    tenderedAmount: number | null;
    reference: string | null;
    cardLast4: string | null;
    momoPhone: string | null;
  }>;
}

/**
 * Snapshots the sale into an immutable receipt document. Stored as JSON so a
 * reprint years later shows the prices and store details of the original sale.
 */
export async function generateReceipt(client: TxClient, saleId: string): Promise<ReceiptPayload> {
  const sale = await client.sale.findUnique({
    where: { id: saleId },
    include: {
      store: true,
      cashier: { select: { fullName: true } },
      customer: { select: { fullName: true, phone: true } },
      items: true,
      payments: true,
    },
  });

  if (!sale) throw ApiError.notFound("Sale");

  const payload: ReceiptPayload = {
    receiptNumber: sale.receiptNumber,
    issuedAt: (sale.completedAt ?? sale.createdAt).toISOString(),
    store: {
      name: sale.store.name,
      branchCode: sale.store.branchCode,
      addressLine: sale.store.addressLine,
      city: sale.store.city,
      phone: sale.store.phone,
      tinNumber: sale.store.tinNumber,
      vatNumber: sale.store.vatNumber,
      footer: sale.store.receiptFooter,
    },
    cashier: sale.cashier.fullName,
    customer: sale.customer ? { name: sale.customer.fullName, phone: sale.customer.phone } : null,
    currency: sale.store.currency,
    items: sale.items.map((item) => ({
      name: item.productName,
      sku: item.sku,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
      taxAmount: Number(item.taxAmount),
    })),
    totals: {
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discountAmount),
      tax: Number(sale.taxAmount),
      total: Number(sale.total),
      amountPaid: Number(sale.amountPaid),
      changeDue: Number(sale.changeDue),
    },
    payments: sale.payments.map((payment) => ({
      method: payment.method,
      label: PAYMENT_METHOD_LABELS[payment.method as keyof typeof PAYMENT_METHOD_LABELS] ?? payment.method,
      amount: Number(payment.amount),
      tenderedAmount: payment.tenderedAmount === null ? null : Number(payment.tenderedAmount),
      reference: payment.externalRef ?? payment.momoReference ?? null,
      cardLast4: payment.cardLast4,
      momoPhone: payment.momoPhone,
    })),
  };

  await client.receipt.create({
    data: {
      saleId: sale.id,
      receiptNumber: sale.receiptNumber,
      format: "THERMAL_80MM",
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });

  return payload;
}

export async function getReceipt(storeId: string, saleId: string) {
  const receipt = await prisma.receipt.findFirst({
    where: { saleId, sale: { storeId } },
    orderBy: { createdAt: "desc" },
  });

  if (!receipt) throw ApiError.notFound("Receipt");

  await prisma.receipt.update({
    where: { id: receipt.id },
    data: { printedCount: { increment: 1 } },
  });

  return receipt.payload as unknown as ReceiptPayload;
}
