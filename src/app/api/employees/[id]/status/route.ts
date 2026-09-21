import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { recordAudit, requestContext } from "@/lib/services/audit.service";
import { revokeAllSessions } from "@/lib/auth/session";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.EMPLOYEES_MANAGE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const disabled = body.disabled === true;

    const user = await prisma.user.findFirst({
      where: { id, storeId: session.user.storeId, deletedAt: null },
      select: { id: true, fullName: true, role: true, status: true },
    });
    if (!user) throw ApiError.notFound("Employee");
    if (user.id === session.user.id) throw ApiError.badRequest("You cannot disable your own account");
    if (user.role === "SUPER_ADMIN" && session.user.role !== "SUPER_ADMIN") {
      throw new ApiError("FORBIDDEN", "Only a super administrator can change this account", 403);
    }
    if (user.role === "ADMIN" && session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      throw new ApiError("FORBIDDEN", "Only administrators can change administrator accounts", 403);
    }

    const status = disabled ? "DISABLED" : "ACTIVE";
    await prisma.user.update({ where: { id: user.id }, data: { status } });
    if (disabled) await revokeAllSessions(user.id);

    await recordAudit({
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      userId: session.user.id,
      storeId: session.user.storeId,
      summary: `${disabled ? "Disabled" : "Enabled"} employee account for ${user.fullName}`,
      changes: { status: { from: user.status, to: status } },
      ...requestContext(request),
    });

    return ok({ id: user.id, status });
  } catch (error) {
    return handleApiError(error);
  }
}