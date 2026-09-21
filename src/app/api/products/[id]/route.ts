import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { searchProducts } from "@/lib/services/product.service";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const session = await authorize(PERMISSIONS.PRODUCTS_UPDATE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const storeId = session.user.storeId;
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const sku = typeof body.sku === "string" ? body.sku.trim() : "";
    const barcode = typeof body.barcode === "string" ? body.barcode.trim() : "";
    const costPrice = Number(body.costPrice);
    const sellingPrice = Number(body.sellingPrice);
    if (!name || !sku || !Number.isFinite(costPrice) || !Number.isFinite(sellingPrice) || costPrice < 0 || sellingPrice < 0) throw ApiError.badRequest("Name, SKU and valid prices are required");

    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id, storeId, deletedAt: null }, select: { id: true } });
      if (!product) throw ApiError.notFound("Product");
      await tx.product.update({ where: { id }, data: { name, sku, costPrice, sellingPrice } });
      await tx.barcode.deleteMany({ where: { productId: id } });
      if (barcode) await tx.barcode.create({ data: { productId: id, code: barcode, isPrimary: true } });
    });

    const [updated] = await searchProducts(storeId, { q: sku, limit: 1 });
    if (!updated || updated.id !== id) throw ApiError.notFound("Product");
    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const session = await authorize(PERMISSIONS.PRODUCTS_DELETE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const { id } = await params;
    const result = await prisma.product.updateMany({ where: { id, storeId: session.user.storeId, deletedAt: null }, data: { deletedAt: new Date(), isActive: false } });
    if (result.count === 0) throw ApiError.notFound("Product");
    return ok({ id });
  } catch (error) {
    return handleApiError(error);
  }
}