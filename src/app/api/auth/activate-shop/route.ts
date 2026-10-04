import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";
import { ApiError, handleApiError, ok } from "@/lib/api/response";

const activationSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the six-digit activation code").optional(),
  token: z.string().trim().min(40).max(100).optional(),
}).refine((value) => Boolean(value.code || value.token), {
  message: "An activation code or secure link token is required",
});

export async function POST(request: Request) {
  try {
    const { email, code, token } = activationSchema.parse(await request.json());
    const owner = await prisma.user.findFirst({
      where: { email, role: "ADMIN", deletedAt: null, storeId: { not: null } },
      select: { id: true, storeId: true },
    });
    if (!owner?.storeId) throw ApiError.badRequest("The activation code is invalid or expired");

    const credentialHash = createHash("sha256").update(token ?? code!).digest("hex");
    const updated = await prisma.store.updateMany({
      where: {
        id: owner.storeId,
        isActive: false,
        ...(token
          ? { activationLinkTokenHash: credentialHash, activationLinkExpiresAt: { gt: new Date() } }
          : { activationCodeHash: credentialHash, activationCodeExpiresAt: { gt: new Date() }, activationCodeAttempts: { lt: 5 } }),
      },
      data: {
        isActive: true,
        emailVerifiedAt: new Date(),
        activationCodeHash: null,
        activationCodeExpiresAt: null,
        activationCodeSentAt: null,
        activationCodeAttempts: 0,
        activationLinkTokenHash: null,
        activationLinkExpiresAt: null,
      },
    });

    if (updated.count !== 1) {
      if (code) {
        await prisma.store.updateMany({
          where: {
            id: owner.storeId,
            isActive: false,
            activationCodeHash: { not: null },
            activationCodeExpiresAt: { gt: new Date() },
            activationCodeAttempts: { lt: 5 },
          },
          data: { activationCodeAttempts: { increment: 1 } },
        });
      }
      throw ApiError.badRequest("The activation code is invalid, expired, or has too many attempts");
    }
    await createSession(owner.id, {
      userAgent: request.headers.get("user-agent"),
      ipAddress: request.headers.get("x-forwarded-for"),
    });
    return ok({ activated: true });
  } catch (error) {
    return handleApiError(error);
  }
}