import { getSession, revokeAllSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError("UNAUTHORIZED", "Authentication required", 401);
    if (session.user.role !== "SUPER_ADMIN") throw new ApiError("FORBIDDEN", "Super-admin access required", 403);
    const { id } = await params;
    if (id === session.user.id) throw ApiError.badRequest("You cannot delete your own account");

    const user = await prisma.user.findFirst({ where: { id, role: "SUPER_ADMIN", deletedAt: null }, select: { id: true, fullName: true } });
    if (!user) throw ApiError.notFound("System staff");
    await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), status: "DISABLED" } });
    await revokeAllSessions(user.id);
    await prisma.auditLog.create({ data: { action: "DELETE", entity: "User", entityId: user.id, userId: session.user.id, summary: `Deleted system staff account for ${user.fullName}` } });

    return ok({ id: user.id });
  } catch (error) {
    return handleApiError(error);
  }
}
