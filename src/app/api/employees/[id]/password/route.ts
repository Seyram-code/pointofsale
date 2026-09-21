import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { checkPasswordStrength, hashPassword } from "@/lib/auth/password";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { recordAudit, requestContext } from "@/lib/services/audit.service";
import { revokeAllSessions } from "@/lib/auth/session";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.EMPLOYEES_MANAGE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const password = typeof body.password === "string" ? body.password : "";
    const passwordCheck = checkPasswordStrength(password);
    if (!passwordCheck.valid) throw ApiError.badRequest(passwordCheck.issues.join(". "));

    const user = await prisma.user.findFirst({
      where: { id, storeId: session.user.storeId, deletedAt: null },
      select: { id: true, fullName: true, role: true },
    });
    if (!user) throw ApiError.notFound("Employee");
    if ((user.role === "ADMIN" || user.role === "SUPER_ADMIN") && session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      throw new ApiError("FORBIDDEN", "Only administrators can reset administrator passwords", 403);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password), mustChangePassword: true, failedLoginAttempts: 0, lockedUntil: null },
    });
    await revokeAllSessions(user.id);
    await recordAudit({
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      userId: session.user.id,
      storeId: session.user.storeId,
      summary: `Reset password for ${user.fullName}`,
      ...requestContext(request),
    });

    return ok({ id: user.id });
  } catch (error) {
    return handleApiError(error);
  }
}