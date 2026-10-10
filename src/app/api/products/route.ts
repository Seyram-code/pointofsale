import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { fail, handleApiError, ok } from "@/lib/api/response";
import { DECIMAL_MONEY, DECIMAL_QTY } from "@/lib/services/cart.service";

function generatedSku(name: string) {
  const prefix = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase() || "ITEM";
  return `${prefix}-${randomInt(0, 10_000_000).toString().padStart(7, "0")}`;
}

function isSkuUniqueConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes("sku") : typeof target === "string" && target.toLowerCase().includes("sku");
}

function isProductNameUniqueConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target)
    ? target.includes("storeId") && target.includes("name")
    : typeof target === "string" && target.toLowerCase().includes("name");
}

async function findDuplicateBarcodeInStore(storeId: string, barcode: string, ignoreProductId?: string) {
  if (!barcode) return null;

  const match = await prisma.barcode.findFirst({
    where: {
      code: barcode,
      product: { storeId },
      ...(ignoreProductId ? { productId: { not: ignoreProductId } } : {}),
    },
    select: {
      code: true,
      product: { select: { id: true, name: true } },
    },
  });

  return match;
}

export async function POST(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.PRODUCTS_CREATE);
    if (!session.user.storeId) return fail("BAD_REQUEST", "Assign this user to a store before creating products.", 400);
    const storeId = session.user.storeId;

    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const enteredSku = typeof body.sku === "string" ? body.sku.trim() : "";
    const barcode = typeof body.barcode === "string" ? body.barcode.trim() : "";
    const nonStock = body.nonStock === true;
    const costPrice = nonStock ? 0 : Number(body.costPrice);
    const sellingPrice = Number(body.sellingPrice);
    const quantity = nonStock ? 0 : Number(body.quantity ?? 0);
    const expiryDate = !nonStock && typeof body.expiryDate === "string" && body.expiryDate ? new Date(body.expiryDate) : null;

    if (
      !name ||
      !Number.isFinite(costPrice) ||
      !Number.isFinite(sellingPrice) ||
      !Number.isFinite(quantity) ||
      costPrice < 0 ||
      sellingPrice < 0 ||
      quantity < 0 ||
      (expiryDate && Number.isNaN(expiryDate.getTime()))
    ) {
      return fail("VALIDATION_ERROR", "Name, prices and a valid quantity are required.", 422);
    }

    const existingProduct = await prisma.product.findFirst({
      where: { storeId, name: { equals: name } },
      select: { id: true },
    });
    if (existingProduct) {
      return fail("CONFLICT", `A product named \"${name}\" has already been added.`, 409);
    }

    const duplicateBarcode = await findDuplicateBarcodeInStore(storeId, barcode);
    if (duplicateBarcode) {
      return fail("CONFLICT", `Barcode \"${duplicateBarcode.code}\" is already assigned to product \"${duplicateBarcode.product.name}\".`, 409);
    }

    for (let attempt = 0; attempt < (enteredSku ? 1 : 5); attempt += 1) {
      const sku = enteredSku || generatedSku(name);
      try {
        const product = await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          storeId,
          name,
          sku,
          costPrice,
          sellingPrice,
          type: nonStock ? "SERVICE" : "UNIT",
          trackStock: !nonStock,
          isVatInclusive: true,
          ...(barcode ? { barcodes: { create: { code: barcode, isPrimary: true } } } : {}),
        },
        select: { id: true, name: true, sku: true },
      });

      if (quantity > 0 || expiryDate) {
        await tx.inventoryLevel.create({
          data: {
            storeId,
            productId: createdProduct.id,
            quantity: DECIMAL_QTY(quantity),
            averageCost: DECIMAL_MONEY(costPrice),
          },
        });
      }

      if (quantity > 0) {
        await tx.stockMovement.create({
          data: {
            storeId,
            productId: createdProduct.id,
            type: "PURCHASE_RECEIPT",
            quantity: DECIMAL_QTY(quantity),
            balanceAfter: DECIMAL_QTY(quantity),
            unitCost: DECIMAL_MONEY(costPrice),
            referenceType: "PRODUCT_CREATE",
            reason: "Opening stock",
            performedById: session.user.id,
          },
        });
      }

      if (expiryDate) {
        await tx.productBatch.create({
          data: {
            productId: createdProduct.id,
            batchNumber: `OPENING-${createdProduct.sku}`,
            expiryDate,
            quantity: DECIMAL_QTY(quantity),
            costPrice: DECIMAL_MONEY(costPrice),
          },
        });
      }

          return createdProduct;
        });

        return ok(product, undefined, 201);
      } catch (error) {
        if (isProductNameUniqueConflict(error)) {
          return fail("CONFLICT", `A product named \"${name}\" has already been added.`, 409);
        }
        if (!enteredSku && isSkuUniqueConflict(error) && attempt < 4) continue;
        throw error;
      }
    }

    throw new Error("Could not generate a unique SKU for this product");
  } catch (error) {
    return handleApiError(error);
  }
}
