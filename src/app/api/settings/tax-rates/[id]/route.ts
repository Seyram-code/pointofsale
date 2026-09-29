import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";

function normalizeTaxRate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.SETTINGS_MANAGE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const storeId = session.user.storeId;

    const { id } = await params;
    const existing = await prisma.taxRate.findFirst({ where: { id, storeId } });
    if (!existing) throw ApiError.notFound("Tax rate not found");

    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const rateInput = normalizeTaxRate(body.rate);
    const description = body.description === null ? null : typeof body.description === "string" ? body.description.trim() || null : existing.description;
    const isDefault = typeof body.isDefault === "boolean" ? body.isDefault : existing.isDefault;
    const isActive = typeof body.isActive === "boolean" ? body.isActive : existing.isActive;

    if (name !== undefined && !name) throw ApiError.badRequest("Tax rate name is required");
    if (name !== undefined && name.length > 120) throw ApiError.badRequest("Tax rate name is too long");
    if (Object.hasOwn(body, "rate") && rateInput === null) throw ApiError.badRequest("Tax rate must be a number between 0 and 1.00");
    if (rateInput !== null && (rateInput < 0 || rateInput > 1)) throw ApiError.badRequest("Tax rate must be between 0 and 1.00");
    if ((description ?? "").length > 240) throw ApiError.badRequest("Tax rate description is too long");
    if (isDefault && !isActive) throw ApiError.badRequest("An inactive tax rate cannot be the default");

    const updated = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.taxRate.updateMany({ where: { storeId, id: { not: id }, isDefault: true }, data: { isDefault: false } });
      }

      return tx.taxRate.update({
        where: { id },
        data: {
          name: name ?? existing.name,
          rate: rateInput ?? existing.rate,
          description,
          isDefault,
          isActive,
        },
      });
    });

    return ok({
      id: updated.id,
      name: updated.name,
      rate: Number(updated.rate),
      description: updated.description,
      isDefault: updated.isDefault,
      isActive: updated.isActive,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.SETTINGS_MANAGE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const storeId = session.user.storeId;

    const { id } = await params;
    const existing = await prisma.taxRate.findFirst({ where: { id, storeId } });
    if (!existing) throw ApiError.notFound("Tax rate not found");

    await prisma.$transaction(async (tx) => {
      if (existing.isDefault) {
        const fallback = await tx.taxRate.findFirst({
          where: { storeId, id: { not: id }, isActive: true },
          orderBy: { name: "asc" },
        });

        if (fallback) {
          await tx.taxRate.update({ where: { id: fallback.id }, data: { isDefault: true } });
        }
      }

      await tx.taxRate.delete({ where: { id } });
    });

    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
