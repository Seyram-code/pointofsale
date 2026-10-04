import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { handleApiError, ApiError, ok } from "@/lib/api/response";
import { checkPasswordStrength, hashPassword } from "@/lib/auth/password";
import { z } from "zod";

const resetSchema = z.object({
  token: z.string().trim().min(40).max(100),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    const { token, password } = resetSchema.parse(await request.json());
    const strength = checkPasswordStrength(password);
    if (!strength.valid) throw ApiError.badRequest(strength.issues.join(". "));

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const user = await prisma.user.findFirst({
      where: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { gt: new Date() }, deletedAt: null, status: "ACTIVE" },
      select: { id: true },
    });
    if (!user) throw ApiError.badRequest("This password reset link is invalid or expired. Request a new one.");

    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.user.updateMany({
        where: { id: user.id, passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { gt: new Date() } },
        data: {
          passwordHash,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          passwordResetSentAt: null,
        },
      });
      if (consumed.count !== 1) throw ApiError.badRequest("This password reset link is invalid or expired. Request a new one.");
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return ok({ reset: true });
  } catch (error) {
    return handleApiError(error);
  }
}