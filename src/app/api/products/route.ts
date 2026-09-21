import { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { fail, handleApiError, ok } from "@/lib/api/response";
import { DECIMAL_MONEY, DECIMAL_QTY } from "@/lib/services/cart.service";

export async function POST(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.PRODUCTS_CREATE);
    if (!session.user.storeId) return fail("BAD_REQUEST", "Assign this user to a store before creating products.", 400);
    const storeId = session.user.storeId;

    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const sku = typeof body.sku === "string" ? body.sku.trim() : "";
    const barcode = typeof body.barcode === "string" ? body.barcode.trim() : "";
    const costPrice = Number(body.costPrice);
    const sellingPrice = Number(body.sellingPrice);
    const quantity = Number(body.quantity ?? 0);
    const expiryDate = typeof body.expiryDate === "string" && body.expiryDate ? new Date(body.expiryDate) : null;

    if (
      !name ||
      !sku ||
      !Number.isFinite(costPrice) ||
      !Number.isFinite(sellingPrice) ||
      !Number.isFinite(quantity) ||
      costPrice < 0 ||
      sellingPrice < 0 ||
      quantity < 0 ||
      (expiryDate && Number.isNaN(expiryDate.getTime()))
    ) {
      return fail("VALIDATION_ERROR", "Name, SKU, prices and a valid quantity are required.", 422);
    }

    const product = await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          storeId,
          name,
          sku,
          costPrice,
          sellingPrice,
          type: "UNIT",
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
    return handleApiError(error);
  }
}
