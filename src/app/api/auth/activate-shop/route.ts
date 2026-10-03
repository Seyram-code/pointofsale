import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";

const activationSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the six-digit activation code"),
});

export async function POST(request: Request) {
  try {
    const { email, code } = activationSchema.parse(await request.json());
    const owner = await prisma.user.findFirst({
      where: { email, role: "ADMIN", deletedAt: null, storeId: { not: null } },
      select: { storeId: true },
    });
    if (!owner?.storeId) throw ApiError.badRequest("The activation code is invalid or expired");

    const updated = await prisma.store.updateMany({
      where: {
        id: owner.storeId,
        isActive: false,
        activationCodeHash: createHash("sha256").update(code).digest("hex"),
        activationCodeExpiresAt: { gt: new Date() },
        activationCodeAttempts: { lt: 5 },
      },
      data: {
        isActive: true,
        emailVerifiedAt: new Date(),
        activationCodeHash: null,
        activationCodeExpiresAt: null,
        activationCodeSentAt: null,
        activationCodeAttempts: 0,
      },
    });

    if (updated.count !== 1) {
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
      throw ApiError.badRequest("The activation code is invalid, expired, or has too many attempts");
    }
    return ok({ activated: true });
  } catch (error) {
    return handleApiError(error);
  }
}