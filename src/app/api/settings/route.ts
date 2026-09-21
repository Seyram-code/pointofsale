import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";

export async function PATCH(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.SETTINGS_MANAGE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");

    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const addressLine = typeof body.addressLine === "string" ? body.addressLine.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const region = typeof body.region === "string" ? body.region.trim() : "";
    const ghanaPostGps = typeof body.ghanaPostGps === "string" ? body.ghanaPostGps.trim() : "";
    const tinNumber = typeof body.tinNumber === "string" ? body.tinNumber.trim() : "";
    const vatNumber = typeof body.vatNumber === "string" ? body.vatNumber.trim() : "";
    const receiptFooter = typeof body.receiptFooter === "string" ? body.receiptFooter.trim() : "";
    const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
    const timezone = typeof body.timezone === "string" ? body.timezone.trim() : "";
    if (!name) throw ApiError.badRequest("Company name is required");
    if (!currency || !timezone) throw ApiError.badRequest("Currency and timezone are required");
    if (name.length > 160 || addressLine.length > 240 || phone.length > 40 || city.length > 100 || region.length > 100 || ghanaPostGps.length > 40 || tinNumber.length > 60 || vatNumber.length > 60 || receiptFooter.length > 200 || currency.length > 10 || timezone.length > 80) throw ApiError.badRequest("Company details are too long");

    const store = await prisma.store.update({
      where: { id: session.user.storeId },
      data: { name, addressLine: addressLine || null, phone: phone || null, city: city || null, region: region || null, ghanaPostGps: ghanaPostGps || null, tinNumber: tinNumber || null, vatNumber: vatNumber || null, receiptFooter: receiptFooter || null, currency, timezone },
      select: { name: true, addressLine: true, phone: true, city: true, region: true, ghanaPostGps: true, tinNumber: true, vatNumber: true, receiptFooter: true, currency: true, timezone: true },
    });
    return ok(store);
  } catch (error) {
    return handleApiError(error);
  }
}