import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ApiError, created, handleApiError, ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { nextNumber } from "@/lib/services/numbering.service";

const supplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contactPerson: z.string().trim().max(120).optional().transform((value) => value || null),
  phone: z.string().trim().max(30).optional().transform((value) => value || null),
  email: z.string().trim().email().max(160).optional().or(z.literal("")).transform((value) => value || null),
  addressLine: z.string().trim().max(200).optional().transform((value) => value || null),
  city: z.string().trim().max(80).optional().transform((value) => value || null),
  region: z.string().trim().max(80).optional().transform((value) => value || null),
  tinNumber: z.string().trim().max(80).optional().transform((value) => value || null),
  paymentTerms: z.string().trim().max(80).optional().transform((value) => value || null),
  creditLimit: z.coerce.number().min(0).max(100000000).default(0),
  notes: z.string().trim().max(500).optional().transform((value) => value || null),
});

export async function POST(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.SUPPLIERS_MANAGE);
    const storeId = session.user.storeId;
    if (!storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const input = supplierSchema.parse(await request.json());

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const supplier = await prisma.$transaction(async (tx) => {
          const code = await nextNumber(tx, storeId, "SUPPLIER");
          return tx.supplier.create({
            data: { ...input, code, storeId },
            select: { id: true, code: true, name: true },
          });
        });
        return created(supplier);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) {
          await nextNumber(prisma, storeId, "SUPPLIER");
          continue;
        }
        throw error;
      }
    }

    throw new Error("Could not allocate a unique supplier code");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    const session = await authorize(PERMISSIONS.SUPPLIERS_VIEW);
    if (!session.user.storeId) return ok([]);
    const suppliers = await prisma.supplier.findMany({
      where: { storeId: session.user.storeId, deletedAt: null },
      orderBy: { name: "asc" },
      take: 100,
    });
    return ok(suppliers);
  } catch (error) {
    return handleApiError(error);
  }
}
