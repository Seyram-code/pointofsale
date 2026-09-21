import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_TAX_RATE } from "@/lib/config/constants";

export interface PosProduct {
  id: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  costPrice: number;
  taxRate: number;
  isVatInclusive: boolean;
  type: string;
  unitAbbreviation: string | null;
  categoryId: string | null;
  categoryName: string | null;
  stock: number;
  trackStock: boolean;
  barcode: string | null;
}

const productSelect = {
  id: true,
  sku: true,
  name: true,
  imageUrl: true,
  sellingPrice: true,
  costPrice: true,
  isVatInclusive: true,
  trackStock: true,
  type: true,
  categoryId: true,
  category: { select: { name: true } },
  unit: { select: { abbreviation: true } },
  taxRate: { select: { rate: true } },
  barcodes: { where: { isPrimary: true }, take: 1, select: { code: true } },
  inventoryLevels: { take: 1, select: { quantity: true } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

function toPosProduct(row: ProductRow): PosProduct {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    imageUrl: row.imageUrl,
    unitPrice: Number(row.sellingPrice),
    costPrice: Number(row.costPrice),
    taxRate: row.taxRate ? Number(row.taxRate.rate) : DEFAULT_TAX_RATE,
    isVatInclusive: row.isVatInclusive,
    type: row.type,
    unitAbbreviation: row.unit?.abbreviation ?? null,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    stock: row.inventoryLevels[0] ? Number(row.inventoryLevels[0].quantity) : 0,
    trackStock: row.trackStock,
    barcode: row.barcodes[0]?.code ?? null,
  };
}

export async function searchProducts(
  storeId: string,
  options: { q?: string; categoryId?: string; limit: number },
): Promise<PosProduct[]> {
  const term = options.q?.trim();

  const rows = await prisma.product.findMany({
    where: {
      storeId,
      isActive: true,
      deletedAt: null,
      ...(options.categoryId ? { categoryId: options.categoryId } : {}),
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
    select: { ...productSelect, inventoryLevels: { where: { storeId }, take: 1, select: { quantity: true } } },
    orderBy: { name: "asc" },
    take: options.limit,
  });

  return rows.map(toPosProduct);
}

/** Exact-match lookup used by the barcode scanner; falls back to SKU. */
export async function findProductByBarcode(storeId: string, code: string): Promise<PosProduct | null> {
  const trimmed = code.trim();

  const row = await prisma.product.findFirst({
    where: {
      storeId,
      isActive: true,
      deletedAt: null,
      OR: [{ barcodes: { some: { code: trimmed } } }, { sku: trimmed }],
    },
    select: { ...productSelect, inventoryLevels: { where: { storeId }, take: 1, select: { quantity: true } } },
  });

  return row ? toPosProduct(row) : null;
}

export async function listPosCategories(storeId: string) {
  const categories = await prisma.category.findMany({
    where: { isActive: true, products: { some: { storeId, isActive: true, deletedAt: null } } },
    select: { id: true, name: true, _count: { select: { products: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    productCount: category._count.products,
  }));
}
