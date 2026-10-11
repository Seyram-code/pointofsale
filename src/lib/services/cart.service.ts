import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/response";
import { computeCartTotals, type CartTotals, type LineTotals } from "@/lib/services/pricing";
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
  optionIds: string[];
  selectedOptions: Array<{ id: string; name: string; priceDelta: number }>;
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

  const [products, defaultTaxRate] = await Promise.all([
    prisma.product.findMany({
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
    }),
    prisma.taxRate.findFirst({ where: { storeId, isDefault: true, isActive: true }, select: { rate: true } }),
  ]);

  if (products.length !== new Set(ids).size) {
    throw ApiError.badRequest("Some products in the cart are no longer available");
  }

  const selectedOptionIds = [...new Set(items.flatMap((item) => item.optionIds ?? []))];
  const options = selectedOptionIds.length
    ? await prisma.$queryRaw<Array<{ id: string; productId: string; name: string; priceDelta: Prisma.Decimal }>>(Prisma.sql`
        SELECT mo.id, mo.productId, mo.name, mo.priceDelta
        FROM MenuOption mo
        INNER JOIN Product p ON p.id = mo.productId
        WHERE p.storeId = ${storeId} AND p.deletedAt IS NULL AND mo.isActive = 1
          AND mo.id IN (${Prisma.join(selectedOptionIds)})
      `)
    : [];
  const optionMap = new Map(options.map((option) => [option.id, option]));
  for (const item of items) {
    for (const optionId of item.optionIds ?? []) {
      if (optionMap.get(optionId)?.productId !== item.productId) {
        throw ApiError.badRequest("A selected menu option is no longer available for this item");
      }
    }
  }

  const catalogue = new Map(products.map((product) => [product.id, product]));

  const priced = items.map((item) => {
    const product = catalogue.get(item.productId)!;
    const selectedOptions = (item.optionIds ?? []).map((optionId) => optionMap.get(optionId)!);
    const override = allowPriceOverride && item.unitPriceOverride !== undefined ? item.unitPriceOverride : undefined;
    return {
      item,
      product,
      selectedOptions,
      unitPrice: (override ?? Number(product.sellingPrice)) + selectedOptions.reduce((sum, option) => sum + Number(option.priceDelta), 0),
      overridden: override !== undefined,
      taxRate: product.taxRate ? Number(product.taxRate.rate) : (defaultTaxRate ? Number(defaultTaxRate.rate) : 0),
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
    optionIds: entry.item.optionIds ?? [],
    selectedOptions: entry.selectedOptions.map((option) => ({ id: option.id, name: option.name, priceDelta: Number(option.priceDelta) })),
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
    productName: line.selectedOptions.length
      ? `${line.name} (${line.selectedOptions.map((option) => option.name).join(", ")})`
      : line.name,
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

export async function persistSaleItemOptions(
  tx: Prisma.TransactionClient,
  saleId: string,
  lines: PricedLine[],
) {
  for (const line of lines) {
    if (line.selectedOptions.length === 0) continue;
    const optionsJson = JSON.stringify(line.selectedOptions);
    const productName = `${line.name} (${line.selectedOptions.map((option) => option.name).join(", ")})`;
    await tx.$executeRaw(Prisma.sql`
      UPDATE SaleItem SET optionsJson = ${optionsJson}
      WHERE saleId = ${saleId} AND productId = ${line.productId}
        AND productName = ${productName}
        AND unitPrice = ${DECIMAL_MONEY(line.unitPrice)}
        AND quantity = ${DECIMAL_QTY(line.quantity)} AND optionsJson IS NULL
      LIMIT 1
    `);
  }
}
