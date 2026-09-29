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

export async function GET() {
  try {
    const session = await authorize(PERMISSIONS.PRODUCTS_CREATE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const storeId = session.user.storeId;

    const taxRates = await prisma.taxRate.findMany({
      where: { storeId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return ok(
      taxRates.map((rate) => ({
        id: rate.id,
        name: rate.name,
        rate: Number(rate.rate),
        description: rate.description,
        isDefault: rate.isDefault,
        isActive: rate.isActive,
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.SETTINGS_MANAGE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const storeId = session.user.storeId;

    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const rateInput = normalizeTaxRate(body.rate);
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const isDefault = body.isDefault === true;
    const isActive = body.isActive !== false;

    if (!name) throw ApiError.badRequest("Tax rate name is required");
    if (rateInput === null || rateInput < 0 || rateInput > 1) throw ApiError.badRequest("Tax rate must be between 0 and 1.00");
    if (name.length > 120 || (description ?? "").length > 240) throw ApiError.badRequest("Tax rate details are too long");
    if (isDefault && !isActive) throw ApiError.badRequest("An inactive tax rate cannot be the default");

    const created = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.taxRate.updateMany({ where: { storeId, isDefault: true }, data: { isDefault: false } });
      }

      return tx.taxRate.create({
        data: {
          storeId,
          name,
          rate: rateInput,
          description: description || null,
          isDefault,
          isActive,
        },
      });
    });

    return ok({
      id: created.id,
      name: created.name,
      rate: Number(created.rate),
      description: created.description,
      isDefault: created.isDefault,
      isActive: created.isActive,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
