import { checkPasswordStrength, hashPassword } from "@/lib/auth/password";
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
    const password = typeof body.password === "string" ? body.password : "";
    const passwordCheck = checkPasswordStrength(password);
    if (!passwordCheck.valid) throw ApiError.badRequest(passwordCheck.issues.join(". "));

    const user = await prisma.user.findFirst({ where: { id, role: "SUPER_ADMIN", deletedAt: null }, select: { id: true, fullName: true } });
    if (!user) throw ApiError.notFound("System staff");

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password), mustChangePassword: true, failedLoginAttempts: 0, lockedUntil: null },
    });
    await revokeAllSessions(user.id);
    await prisma.auditLog.create({ data: { action: "UPDATE", entity: "User", entityId: user.id, userId: session.user.id, summary: `Reset password for system staff ${user.fullName}` } });

    return ok({ id: user.id });
  } catch (error) {
    return handleApiError(error);
  }
}
