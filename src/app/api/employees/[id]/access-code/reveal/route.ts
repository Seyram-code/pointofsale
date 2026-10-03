import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { decryptStaffAccessCode } from "@/lib/auth/staff-access-code";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { recordAudit, requestContext } from "@/lib/services/audit.service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.EMPLOYEES_MANAGE);
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      throw new ApiError("FORBIDDEN", "Only administrators can view staff access codes", 403);
    }
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const { id } = await params;
    const employee = await prisma.user.findFirst({
      where: { id, storeId: session.user.storeId, deletedAt: null, employeeProfile: { isNot: null } },
      select: { id: true, fullName: true, role: true, staffAccessCodeEncrypted: true },
    });
    if (!employee) throw ApiError.notFound("Employee");
    if (employee.role === "ADMIN" && session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      throw new ApiError("FORBIDDEN", "Only administrators can view administrator access codes", 403);
    }
    if (!employee.staffAccessCodeEncrypted) {
      throw ApiError.notFound("Stored access code. Reset the employee's access code to create a viewable one.");
    }

    const accessCode = decryptStaffAccessCode(employee.staffAccessCodeEncrypted);
    await recordAudit({
      action: "EXPORT",
      entity: "User",
      entityId: employee.id,
      userId: session.user.id,
      storeId: session.user.storeId,
      summary: `Viewed staff access code for ${employee.fullName}`,
      ...requestContext(request),
    });
    return ok({ accessCode });
  } catch (error) {
    return handleApiError(error);
  }
}