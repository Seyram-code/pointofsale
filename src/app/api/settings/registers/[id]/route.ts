import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Register name is required").max(80, "Register name is too long"),
  terminalId: z.string().trim().max(80, "Terminal ID is too long").nullable().optional().transform((value) => value || null),
  isActive: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.SETTINGS_MANAGE);
    const storeId = session.user.storeId;
    if (!storeId) throw ApiError.badRequest("Your account is not linked to a store");

    const { id } = await params;
    const existing = await prisma.register.findFirst({ where: { id, storeId }, select: { id: true } });
    if (!existing) throw ApiError.notFound("Register");

    const body = registerSchema.parse(await request.json());
    if (!body.isActive) {
      const openShift = await prisma.shift.findFirst({
        where: { registerId: id, storeId, status: "OPEN" },
        select: { id: true },
      });
      if (openShift) throw ApiError.conflict("Close the active shift on this register before deactivating it.");
    }

    const register = await prisma.register.update({
      where: { id },
      data: body,
      select: { id: true, name: true, code: true, terminalId: true, isActive: true },
    });
    return ok(register);
  } catch (error) {
    return handleApiError(error);
  }
}
