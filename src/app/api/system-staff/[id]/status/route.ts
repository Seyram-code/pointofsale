import { getSession, revokeAllSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) throw new ApiError("UNAUTHORIZED", "Authentication required", 401);
  if (session.user.role !== "SUPER_ADMIN") throw new ApiError("FORBIDDEN", "Super-admin access required", 403);
  return session;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSuperAdmin();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const disabled = body.disabled === true;
    if (id === session.user.id) throw ApiError.badRequest("You cannot suspend your own account");

    const user = await prisma.user.findFirst({ where: { id, role: "SUPER_ADMIN", deletedAt: null }, select: { id: true, fullName: true, status: true } });
    if (!user) throw ApiError.notFound("System staff");
    const status = disabled ? "DISABLED" : "ACTIVE";
    await prisma.user.update({ where: { id: user.id }, data: { status } });
    if (disabled) await revokeAllSessions(user.id);
    await prisma.auditLog.create({ data: { action: "UPDATE", entity: "User", entityId: user.id, userId: session.user.id, summary: `${disabled ? "Suspended" : "Enabled"} system staff account for ${user.fullName}`, changes: { status: { from: user.status, to: status } } } });

    return ok({ id: user.id, status });
  } catch (error) {
    return handleApiError(error);
  }
}
