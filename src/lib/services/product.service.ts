import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

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
  menuOptions?: Array<{ id: string; name: string; priceDelta: number }>;
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

function toPosProduct(row: ProductRow, defaultTaxRate: number): PosProduct {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    imageUrl: row.imageUrl,
    unitPrice: Number(row.sellingPrice),
    costPrice: Number(row.costPrice),
    taxRate: row.taxRate ? Number(row.taxRate.rate) : defaultTaxRate,
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

  const [rows, defaultTaxRate] = await Promise.all([prisma.product.findMany({
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
  }), prisma.taxRate.findFirst({ where: { storeId, isDefault: true, isActive: true }, select: { rate: true } })]);

  const optionRows = rows.length > 0
    ? await prisma.$queryRaw<Array<{ id: string; productId: string; name: string; priceDelta: Prisma.Decimal }>>(Prisma.sql`
        SELECT mo.id, mo.productId, mo.name, mo.priceDelta
        FROM MenuOption mo INNER JOIN Product p ON p.id = mo.productId
        WHERE p.storeId = ${storeId} AND mo.isActive = 1 AND mo.productId IN (${Prisma.join(rows.map((row) => row.id))})
        ORDER BY mo.sortOrder ASC, mo.name ASC
      `)
    : [];
  const optionsByProduct = new Map<string, NonNullable<PosProduct["menuOptions"]>>();
  for (const option of optionRows) {
    const options = optionsByProduct.get(option.productId) ?? [];
    options.push({ id: option.id, name: option.name, priceDelta: Number(option.priceDelta) });
    optionsByProduct.set(option.productId, options);
  }

  return rows.map((row) => ({
    ...toPosProduct(row, defaultTaxRate ? Number(defaultTaxRate.rate) : 0),
    menuOptions: optionsByProduct.get(row.id) ?? [],
  }));
}

export async function searchCatalogueProducts(
  storeId: string,
  options: { q?: string; categoryId?: string; page: number; pageSize: number },
) {
  const term = options.q?.trim();
  const where: Prisma.ProductWhereInput = {
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
  };
  const [total, defaultTaxRate] = await Promise.all([
    prisma.product.count({ where }),
    prisma.taxRate.findFirst({ where: { storeId, isDefault: true, isActive: true }, select: { rate: true } }),
  ]);
  const page = Math.min(options.page, Math.max(1, Math.ceil(total / options.pageSize)));
  const rows = await prisma.product.findMany({
    where,
    select: { ...productSelect, inventoryLevels: { where: { storeId }, take: 1, select: { quantity: true } } },
    orderBy: { name: "asc" },
    skip: (page - 1) * options.pageSize,
    take: options.pageSize,
  });

  return {
    products: rows.map((row) => toPosProduct(row, defaultTaxRate ? Number(defaultTaxRate.rate) : 0)),
    total,
    page,
  };
}

/** Exact-match lookup used by the barcode scanner; falls back to SKU. */
export async function findProductByBarcode(storeId: string, code: string): Promise<PosProduct | null> {
  const trimmed = code.trim();

  const [row, defaultTaxRate] = await Promise.all([prisma.product.findFirst({
    where: {
      storeId,
      isActive: true,
      deletedAt: null,
      OR: [{ barcodes: { some: { code: trimmed } } }, { sku: trimmed }],
    },
    select: { ...productSelect, inventoryLevels: { where: { storeId }, take: 1, select: { quantity: true } } },
  }), prisma.taxRate.findFirst({ where: { storeId, isDefault: true, isActive: true }, select: { rate: true } })]);

  return row ? toPosProduct(row, defaultTaxRate ? Number(defaultTaxRate.rate) : 0) : null;
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
