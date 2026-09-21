import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/response";
import { computeCartTotals, type CartTotals, type LineTotals } from "@/lib/services/pricing";
import { DEFAULT_TAX_RATE } from "@/lib/config/constants";
import type { CartItemInput, CartDiscountInput } from "@/lib/validations/sale.schema";

export const DECIMAL_QTY = (value: number) => new Prisma.Decimal(value.toFixed(3));
export const DECIMAL_MONEY = (value: number) => new Prisma.Decimal(value.toFixed(2));

export interface PricedLine {
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  taxRate: number;
  overridden: boolean;
  trackStock: boolean;
  totals: LineTotals;
}

export interface PricedCart {
  lines: PricedLine[];
  totals: CartTotals;
  /** Cost of goods for the whole cart, used for margin reporting. */
  costOfGoods: number;
  unitCount: number;
}

/**
 * Re-prices a cart from the database. The client's prices are never trusted —
 * only quantities and (with permission) explicit price overrides.
 */
export async function priceCart(
  storeId: string,
  items: CartItemInput[],
  discount: CartDiscountInput | undefined,
  allowPriceOverride: boolean,
): Promise<PricedCart> {
  const ids = items.map((item) => item.productId);

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, storeId, deletedAt: null },
    select: {
      id: true,
      sku: true,
      name: true,
      sellingPrice: true,
      costPrice: true,
      isVatInclusive: true,
      trackStock: true,
      taxRate: { select: { rate: true } },
      barcodes: { where: { isPrimary: true }, take: 1, select: { code: true } },
    },
  });

  if (products.length !== new Set(ids).size) {
    throw ApiError.badRequest("Some products in the cart are no longer available");
  }

  const catalogue = new Map(products.map((product) => [product.id, product]));

  const priced = items.map((item) => {
    const product = catalogue.get(item.productId)!;
    const override = allowPriceOverride && item.unitPriceOverride !== undefined ? item.unitPriceOverride : undefined;
    return {
      item,
      product,
      unitPrice: override ?? Number(product.sellingPrice),
      overridden: override !== undefined,
      taxRate: product.taxRate ? Number(product.taxRate.rate) : DEFAULT_TAX_RATE,
    };
  });

  const totals = computeCartTotals(
    priced.map((entry) => ({
      quantity: entry.item.quantity,
      unitPrice: entry.unitPrice,
      taxRate: entry.taxRate,
      isVatInclusive: entry.product.isVatInclusive,
    })),
    discount,
  );

  const lines: PricedLine[] = priced.map((entry, index) => ({
    productId: entry.product.id,
    name: entry.product.name,
    sku: entry.product.sku,
    barcode: entry.product.barcodes[0]?.code ?? null,
    quantity: entry.item.quantity,
    unitPrice: entry.unitPrice,
    unitCost: Number(entry.product.costPrice),
    taxRate: entry.taxRate,
    overridden: entry.overridden,
    trackStock: entry.product.trackStock,
    totals: totals.lines[index],
  }));

  return {
    lines,
    totals,
    costOfGoods: lines.reduce((sum, line) => sum + line.unitCost * line.quantity, 0),
    unitCount: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

export function saleItemCreateData(lines: PricedLine[]): Prisma.SaleItemCreateWithoutSaleInput[] {
  return lines.map((line) => ({
    product: { connect: { id: line.productId } },
    productName: line.name,
    sku: line.sku,
    barcode: line.barcode,
    quantity: DECIMAL_QTY(line.quantity),
    unitPrice: DECIMAL_MONEY(line.unitPrice),
    unitCost: DECIMAL_MONEY(line.unitCost),
    taxRate: new Prisma.Decimal(line.taxRate.toFixed(4)),
    taxAmount: DECIMAL_MONEY(line.totals.taxAmount),
    lineTotal: DECIMAL_MONEY(line.totals.lineTotal),
    priceOverridden: line.overridden,
  }));
}
