import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

const updateSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
  addressLine: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  loyaltyCardNo: z.string().trim().max(80).optional().nullable(),
  creditLimit: z.coerce.number().min(0).max(100000000).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.CUSTOMERS_MANAGE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const { id } = await params;
    const input = updateSchema.parse(await request.json());
    const existing = await prisma.customer.findFirst({ where: { id, storeId: session.user.storeId, deletedAt: null }, select: { id: true } });
    if (!existing) throw ApiError.notFound("Customer");
    const customer = await prisma.customer.update({ where: { id }, data: input, select: { id: true, code: true, fullName: true, isActive: true } });
    return ok(customer);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.CUSTOMERS_MANAGE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const { id } = await params;
    const existing = await prisma.customer.findFirst({ where: { id, storeId: session.user.storeId, deletedAt: null }, select: { id: true } });
    if (!existing) throw ApiError.notFound("Customer");
    await prisma.customer.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
    return ok({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
