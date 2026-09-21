import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

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

const closeShiftSchema = z.object({
  closingCount: z.coerce.number().min(0, "Closing cash count must be zero or more"),
  notes: z.string().trim().max(500).optional().transform((value) => value || undefined),
});

export async function POST(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.SHIFTS_CLOSE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");

    const body = closeShiftSchema.parse(await request.json());

    const shift = await prisma.shift.findFirst({
      where: { storeId: session.user.storeId, cashierId: session.user.id, status: "OPEN" },
      include: { register: { select: { name: true, code: true } } },
    });

    if (!shift) throw ApiError.notFound("Open shift");

    const closingCount = body.closingCount;
    const expectedCash = Number(shift.expectedCash ?? shift.openingFloat ?? 0);
    const cashVariance = closingCount - expectedCash;

    const closed = await prisma.shift.update({
      where: { id: shift.id },
      data: {
        status: "CLOSED",
        closingCount: closingCount,
        expectedCash,
        cashVariance: cashVariance,
        closedAt: new Date(),
        notes: body.notes ?? shift.notes ?? null,
      },
      include: { register: { select: { name: true, code: true } } },
    });

    return ok(serializeShift(closed));
  } catch (error) {
    return handleApiError(error);
  }
}
