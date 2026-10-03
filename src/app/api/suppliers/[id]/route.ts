import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  contactPerson: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
  addressLine: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  region: z.string().trim().max(80).optional().nullable(),
  tinNumber: z.string().trim().max(80).optional().nullable(),
  paymentTerms: z.string().trim().max(80).optional().nullable(),
  creditLimit: z.coerce.number().min(0).max(100000000).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.SUPPLIERS_MANAGE, { planFeature: "suppliers" });
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const { id } = await params;
    const input = updateSchema.parse(await request.json());
    const existing = await prisma.supplier.findFirst({ where: { id, storeId: session.user.storeId, deletedAt: null }, select: { id: true } });
    if (!existing) throw ApiError.notFound("Supplier");

    const supplier = await prisma.supplier.update({
      where: { id },
      data: input,
      select: { id: true, code: true, name: true, isActive: true },
    });

    return ok(supplier);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.SUPPLIERS_MANAGE, { planFeature: "suppliers" });
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const { id } = await params;
    const existing = await prisma.supplier.findFirst({ where: { id, storeId: session.user.storeId, deletedAt: null }, select: { id: true } });
    if (!existing) throw ApiError.notFound("Supplier");

    await prisma.supplier.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });

    return ok({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
