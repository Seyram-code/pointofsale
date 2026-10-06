import { createPasswordResetToken, sendPasswordResetEmail } from "@/lib/services/password-reset.service";
import { prisma } from "@/lib/db/prisma";
import { handleApiError, ok } from "@/lib/api/response";
import { z } from "zod";

const requestSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
});
const RESET_REQUEST_COOLDOWN_MS = 60_000;
const GENERIC_RESPONSE = { sent: true };

export async function POST(request: Request) {
  try {
    const { email } = requestSchema.parse(await request.json());
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null, status: "ACTIVE", passwordHash: { not: null } },
      select: { id: true, email: true, fullName: true, passwordResetSentAt: true },
    });

    if (user?.email && Date.now() - (user.passwordResetSentAt?.getTime() ?? 0) >= RESET_REQUEST_COOLDOWN_MS) {
      const reset = createPasswordResetToken();
      const updated = await prisma.user.updateMany({
        where: {
          id: user.id,
          OR: [
            { passwordResetSentAt: null },
            { passwordResetSentAt: { lt: new Date(Date.now() - RESET_REQUEST_COOLDOWN_MS) } },
          ],
        },
        data: {
          passwordResetTokenHash: reset.hash,
          passwordResetExpiresAt: reset.expiresAt,
          passwordResetSentAt: new Date(),
        },
      });

      if (updated.count === 1) {
        try {
          await sendPasswordResetEmail({ email: user.email, fullName: user.fullName, token: reset.token, appUrl: new URL(request.url).origin });
        } catch (error) {
          console.error("[password-reset] failed to send reset email", error);
          await prisma.user.updateMany({
            where: { id: user.id, passwordResetTokenHash: reset.hash },
            data: { passwordResetTokenHash: null, passwordResetExpiresAt: null, passwordResetSentAt: null },
          });
        }
      }
    }

    return ok(GENERIC_RESPONSE, { message: "If an active account uses that email, a password reset link will be sent shortly." });
  } catch (error) {
    return handleApiError(error);
  }
}