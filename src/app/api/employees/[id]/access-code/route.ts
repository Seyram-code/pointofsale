import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { createUniqueStaffAccessCode, encryptStaffAccessCode } from "@/lib/auth/staff-access-code";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { recordAudit, requestContext } from "@/lib/services/audit.service";
import { revokeAllSessions } from "@/lib/auth/session";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.EMPLOYEES_MANAGE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const { id } = await params;
    const user = await prisma.user.findFirst({
      where: { id, storeId: session.user.storeId, deletedAt: null, employeeProfile: { isNot: null } },
      select: { id: true, fullName: true, role: true },
    });
    if (!user) throw ApiError.notFound("Employee");
    if (user.role === "ADMIN" && session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      throw new ApiError("FORBIDDEN", "Only administrators can reset administrator access codes", 403);
    }

    const existingHashes = await prisma.user.findMany({
      where: { staffAccessCodeHash: { not: null } },
      select: { staffAccessCodeHash: true },
    });

    let accessCode = "";
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const generatedCode = createUniqueStaffAccessCode(session.user.storeName ?? "Shop", existingHashes.map((user) => user.staffAccessCodeHash));
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            staffAccessCodeHash: generatedCode.hash,
            staffAccessCodeEncrypted: encryptStaffAccessCode(generatedCode.accessCode),
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });
        accessCode = generatedCode.accessCode;
        break;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 19)) throw error;
      }
    }
    if (!accessCode) throw ApiError.badRequest("Could not generate a unique staff access code. Try again.");
    await revokeAllSessions(user.id);
    await recordAudit({
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      userId: session.user.id,
      storeId: session.user.storeId,
      summary: `Reset staff access code for ${user.fullName}`,
      ...requestContext(request),
    });

    return ok({ accessCode });
  } catch (error) {
    return handleApiError(error);
  }
}
