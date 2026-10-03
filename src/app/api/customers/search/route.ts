import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

const querySchema = z.object({
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export async function GET(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.CUSTOMERS_POS_LOOKUP, { planFeature: "customers" });
    if (!session.user.storeId) return ok([]);

    const { q, limit } = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));

    const customers = await prisma.customer.findMany({
      where: {
        storeId: session.user.storeId,
        isActive: true,
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q } },
                { phone: { contains: q } },
                { code: { contains: q } },
                { loyaltyCardNo: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { fullName: "asc" },
      take: limit,
      select: { id: true, code: true, fullName: true, phone: true, loyaltyPoints: true, storeCredit: true },
    });

    return ok(
      customers.map((customer) => ({
        id: customer.id,
        code: customer.code,
        fullName: customer.fullName,
        phone: customer.phone,
        loyaltyPoints: customer.loyaltyPoints,
        storeCredit: Number(customer.storeCredit),
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
