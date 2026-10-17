import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { ApiError, created, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { nextNumber } from "@/lib/services/numbering.service";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Register name is required").max(80, "Register name is too long"),
  terminalId: z.string().trim().max(80, "Terminal ID is too long").nullable().optional().transform((value) => value || null),
});

export async function GET() {
  try {
    const session = await authorize(PERMISSIONS.SETTINGS_VIEW);
    const registers = await prisma.register.findMany({
      where: { storeId: session.user.storeId! },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, terminalId: true, isActive: true },
    });
    return ok(registers);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.SETTINGS_MANAGE);
    const storeId = session.user.storeId;
    if (!storeId) throw ApiError.badRequest("Your account is not linked to a store");

    const body = registerSchema.parse(await request.json());
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const register = await prisma.$transaction(async (tx) => {
          const code = await nextNumber(tx, storeId, "REGISTER");
          return tx.register.create({
            data: { storeId, ...body, code },
            select: { id: true, name: true, code: true, terminalId: true, isActive: true },
          });
        });
        return created(register);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) {
          await nextNumber(prisma, storeId, "REGISTER");
          continue;
        }
        throw error;
      }
    }

    throw new Error("Could not allocate a unique register code");
  } catch (error) {
    return handleApiError(error);
  }
}
