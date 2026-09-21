import { z } from "zod";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { getSession, revokeAllSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { checkPasswordStrength, hashPassword } from "@/lib/auth/password";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ storeId: string }> },
) {
  try {
    const session = await getSession();
    if (!session) throw new UnauthorizedError();
    if (session.user.role !== "SUPER_ADMIN") throw new ForbiddenError("Only the super admin can change business passwords");

    const { storeId } = await params;
    const { password } = z.object({ password: z.string().min(1).max(200) }).parse(await request.json());
    const passwordCheck = checkPasswordStrength(password);
    if (!passwordCheck.valid) throw ApiError.badRequest(passwordCheck.issues.join(". "));

    const owner = await prisma.user.findFirst({
      where: { storeId, role: "ADMIN", deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true },
    });
    if (!owner) throw ApiError.notFound("Business owner account");

    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: owner.id },
        data: { passwordHash, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null },
      });
      await tx.auditLog.create({
        data: {
          storeId,
          userId: session.user.id,
          action: "UPDATE",
          entity: "User",
          entityId: owner.id,
          summary: `Changed business owner password for ${owner.email}`,
          changes: { password: { from: "stored password", to: "new password" } },
        },
      });
    });

    await revokeAllSessions(owner.id);
    return ok({ email: owner.email });
  } catch (error) {
    return handleApiError(error);
  }
}
