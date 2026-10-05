import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/response";
import { nextNumber } from "@/lib/services/numbering.service";
import { DECIMAL_MONEY, priceCart, saleItemCreateData } from "@/lib/services/cart.service";
import type { HoldSaleInput } from "@/lib/validations/sale.schema";

export interface SaleContext {
  storeId: string;
  cashierId: string;
  allowPriceOverride: boolean;
}

export interface HeldSaleResult {
  id: string;
  receiptNumber: string;
  total: number;
  itemCount: number;
}

/** Parks a cart as a DRAFT sale. No stock or money moves until checkout. */
export async function holdSale(input: HoldSaleInput, context: SaleContext): Promise<HeldSaleResult> {
  const cart = await priceCart(context.storeId, input.items, input.discount, context.allowPriceOverride);

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

        const sale = await tx.sale.create({
          data: {
            storeId: context.storeId,
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
          select: { id: true, receiptNumber: true, total: true, itemCount: true },
        });

        return {
          id: sale.id,
          receiptNumber: sale.receiptNumber,
          total: Number(sale.total),
          itemCount: sale.itemCount,
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) {
        await nextNumber(prisma, context.storeId, "RECEIPT");
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not allocate a unique receipt number for held sale");
}

export async function listHeldSales(storeId: string, cashierId?: string) {
  const drafts = await prisma.sale.findMany({
    where: { storeId, status: "DRAFT", ...(cashierId ? { cashierId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      receiptNumber: true,
      total: true,
      itemCount: true,
      note: true,
      createdAt: true,
      cashier: { select: { fullName: true } },
      customer: { select: { id: true, fullName: true } },
    },
  });

  return drafts.map((draft) => ({
    id: draft.id,
    receiptNumber: draft.receiptNumber,
    total: Number(draft.total),
    itemCount: draft.itemCount,
    note: draft.note,
    createdAt: draft.createdAt,
    cashierName: draft.cashier.fullName,
    customerId: draft.customer?.id ?? null,
    customerName: draft.customer?.fullName ?? null,
  }));
}

export async function getHeldSale(storeId: string, saleId: string) {
  const draft = await prisma.sale.findFirst({
    where: { id: saleId, storeId, status: "DRAFT" },
    select: {
      id: true,
      receiptNumber: true,
      note: true,
      discountType: true,
      discountValue: true,
      customerId: true,
      customer: { select: { id: true, fullName: true, phone: true } },
      items: {
        select: {
          productId: true,
          productName: true,
          sku: true,
          barcode: true,
          quantity: true,
          unitPrice: true,
          taxRate: true,
          priceOverridden: true,
          product: { select: { isVatInclusive: true, trackStock: true, unit: { select: { abbreviation: true } } } },
        },
      },
    },
  });

  if (!draft) throw ApiError.notFound("Held sale");

  return {
    id: draft.id,
    receiptNumber: draft.receiptNumber,
    note: draft.note,
    discount:
      draft.discountType && Number(draft.discountValue) > 0
        ? { type: draft.discountType, value: Number(draft.discountValue) }
        : null,
    customer: draft.customer
      ? { id: draft.customer.id, fullName: draft.customer.fullName, phone: draft.customer.phone }
      : null,
    items: draft.items.map((item) => ({
      productId: item.productId,
      name: item.productName,
      sku: item.sku,
      barcode: item.barcode,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate),
      isVatInclusive: item.product.isVatInclusive,
      unitAbbreviation: item.product.unit?.abbreviation ?? null,
      priceOverridden: item.priceOverridden,
    })),
  };
}

export async function discardHeldSale(storeId: string, saleId: string) {
  await prisma.$transaction(async (tx) => {
    const draft = await tx.sale.findFirst({
      where: { id: saleId, storeId, status: "DRAFT" },
      select: { id: true, payments: { select: { id: true }, take: 1 } },
    });
    if (!draft) throw ApiError.notFound("Held sale");

    const hasReservation = await tx.stockMovement.findFirst({
      where: { referenceId: saleId, referenceType: "SALE_RESERVATION" },
      select: { id: true },
    });
    if (draft.payments.length > 0 || hasReservation) {
      throw ApiError.conflict("This sale has a payment attempt and cannot be discarded. Reconcile its payment status first.");
    }

    const result = await tx.sale.deleteMany({
      where: { id: saleId, storeId, status: "DRAFT", payments: { none: {} } },
    });
    if (result.count !== 1) throw ApiError.conflict("This sale changed and can no longer be discarded.");
  });
}
