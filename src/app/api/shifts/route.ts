import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { ApiError, created, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { nextNumber } from "@/lib/services/numbering.service";

type ShiftInput = {
  id: string;
  shiftNumber: string;
  status: string;
  register: { name: string; code: string };
  openingFloat?: unknown;
  expectedCash?: unknown;
  closingCount?: unknown;
  cashVariance?: unknown;
  closedAt?: Date | string | null;
};

function serializeShift(shift: ShiftInput | null | undefined) {
  if (!shift) return null;

  const input = shift as ShiftInput;

  return {
    id: input.id,
    shiftNumber: input.shiftNumber,
    status: input.status,
    register: { name: input.register.name, code: input.register.code },
    openingFloat: Number(input.openingFloat ?? 0),
    expectedCash: Number(input.expectedCash ?? input.openingFloat ?? 0),
    closingCount: input.closingCount === null || input.closingCount === undefined ? null : Number(input.closingCount),
    cashVariance: input.cashVariance === null || input.cashVariance === undefined ? null : Number(input.cashVariance),
    closedAt: input.closedAt ? new Date(input.closedAt).toISOString() : null,
  };
}

const openShiftSchema = z.object({
  registerId: z.string().min(1, "Choose a register"),
  openingFloat: z.coerce.number().min(0, "Opening float must be zero or more").max(200000, "Opening float is too high"),
  notes: z.string().trim().max(500).optional().transform((value) => value || undefined),
});

export async function GET() {
  try {
    const session = await authorize(PERMISSIONS.SHIFTS_OPEN);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");

    const [registers, currentShift] = await Promise.all([
      prisma.register.findMany({
        where: { storeId: session.user.storeId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      }),
      prisma.shift.findFirst({
        where: { storeId: session.user.storeId, cashierId: session.user.id, status: "OPEN" },
        include: { register: { select: { name: true, code: true } } },
      }),
    ]);

    return ok({ registers, currentShift: serializeShift(currentShift) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.SHIFTS_OPEN);
    const storeId = session.user.storeId;
    if (!storeId) throw ApiError.badRequest("Your account is not linked to a store");

    const body = openShiftSchema.parse(await request.json());

    const existing = await prisma.shift.findFirst({
      where: { storeId, cashierId: session.user.id, status: "OPEN" },
      select: { id: true },
    });

    if (existing) {
      throw ApiError.conflict("You already have an open shift.");
    }

    const register = await prisma.register.findFirst({
      where: { id: body.registerId, storeId, isActive: true },
      select: { id: true },
    });

    if (!register) {
      throw ApiError.notFound("Register");
    }

    let opened;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        opened = await prisma.$transaction(async (tx) => {
          const shiftNumber = await nextNumber(tx, storeId, "SHIFT");
          return tx.shift.create({
            data: {
              storeId,
              registerId: body.registerId,
              cashierId: session.user.id,
              shiftNumber,
              status: "OPEN",
              openingFloat: body.openingFloat,
              expectedCash: body.openingFloat,
              notes: body.notes ?? null,
            },
            include: { register: { select: { name: true, code: true } } },
          });
        });
        break;
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "P2002" && attempt < 4) {
          await nextNumber(prisma, storeId, "SHIFT");
          continue;
        }
        throw error;
      }
    }

    if (!opened) {
      throw new Error("Could not allocate a unique shift number");
    }

    return created(serializeShift(opened));
  } catch (error) {
    return handleApiError(error);
  }
}
