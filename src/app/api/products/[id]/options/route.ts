import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const optionsSchema = z.object({
  options: z.array(z.object({
    id: z.string().min(1).optional(),
    name: z.string().trim().min(1).max(80),
    priceDelta: z.coerce.number().min(0).max(100000),
  })).max(30),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.POS_ACCESS);
    if (!session.user.storeId || session.user.businessType !== "RESTAURANT") throw ApiError.notFound("Menu options");
    const { id } = await params;
    const product = await prisma.product.findFirst({ where: { id, storeId: session.user.storeId, deletedAt: null }, select: { id: true } });
    if (!product) throw ApiError.notFound("Menu item");
    const options = await prisma.$queryRaw<Array<{ id: string; name: string; priceDelta: Prisma.Decimal }>>(Prisma.sql`
      SELECT id, name, priceDelta FROM MenuOption
      WHERE productId = ${id} AND isActive = 1
      ORDER BY sortOrder ASC, name ASC
    `);
    return ok(options.map((option) => ({ id: option.id, name: option.name, priceDelta: Number(option.priceDelta) })));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.PRODUCTS_UPDATE);
    if (!session.user.storeId || session.user.businessType !== "RESTAURANT") throw ApiError.notFound("Menu options");
    const { id } = await params;
    const input = optionsSchema.parse(await request.json());
    const product = await prisma.product.findFirst({ where: { id, storeId: session.user.storeId, deletedAt: null }, select: { id: true } });
    if (!product) throw ApiError.notFound("Menu item");
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`UPDATE MenuOption SET isActive = 0, updatedAt = NOW(3) WHERE productId = ${id}`);
      for (const [index, option] of input.options.entries()) {
        if (option.id) {
          const updated = await tx.$executeRaw(Prisma.sql`
            UPDATE MenuOption SET name = ${option.name}, priceDelta = ${option.priceDelta.toFixed(2)},
              isActive = 1, sortOrder = ${index}, updatedAt = NOW(3)
            WHERE id = ${option.id} AND productId = ${id}
          `);
          if (updated !== 1) throw ApiError.badRequest("A menu option no longer belongs to this item");
        } else {
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO MenuOption (id, productId, name, priceDelta, isActive, sortOrder, createdAt, updatedAt)
            VALUES (${randomUUID()}, ${id}, ${option.name}, ${option.priceDelta.toFixed(2)}, 1, ${index}, NOW(3), NOW(3))
          `);
        }
      }
    });
    return ok({ saved: input.options.length });
  } catch (error) {
    return handleApiError(error);
  }
}