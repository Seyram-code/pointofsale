import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { ApiError, created, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { nextNumber } from "@/lib/services/numbering.service";

const customerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional().transform((value) => value || null),
  email: z.string().trim().email().max(160).optional().or(z.literal("")).transform((value) => value || null),
  addressLine: z.string().trim().max(200).optional().transform((value) => value || null),
  city: z.string().trim().max(80).optional().transform((value) => value || null),
  loyaltyCardNo: z.string().trim().max(80).optional().transform((value) => value || null),
  creditLimit: z.coerce.number().min(0).max(100000000).default(0),
  notes: z.string().trim().max(500).optional().transform((value) => value || null),
});

export async function POST(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.CUSTOMERS_MANAGE);
    const storeId = session.user.storeId;
    if (!storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const input = customerSchema.parse(await request.json());

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const customer = await prisma.$transaction(async (tx) => {
          const code = await nextNumber(tx, storeId, "CUSTOMER");
          return tx.customer.create({
            data: { ...input, code, storeId },
            select: { id: true, code: true, fullName: true },
          });
        });
        return created(customer);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) {
          await nextNumber(prisma, storeId, "CUSTOMER");
          continue;
        }
        throw error;
      }
    }

    throw new Error("Could not allocate a unique customer code");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    const session = await authorize(PERMISSIONS.CUSTOMERS_VIEW);
    if (!session.user.storeId) return ok([]);
    const customers = await prisma.customer.findMany({
      where: { storeId: session.user.storeId, deletedAt: null },
      orderBy: { fullName: "asc" },
      take: 100,
    });
    return ok(customers);
  } catch (error) {
    return handleApiError(error);
  }
}
