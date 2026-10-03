import { prisma } from "@/lib/db/prisma";
import { handleApiError, ok } from "@/lib/api/response";
import { createStoreActivationCode, sendStoreActivationEmail } from "@/lib/services/store-activation.service";
import { z } from "zod";

const resendSchema = z.object({ email: z.string().trim().email().transform((email) => email.toLowerCase()) });
const RESEND_COOLDOWN_MS = 60_000;

export async function POST(request: Request) {
  try {
    const { email } = resendSchema.parse(await request.json());
    const owner = await prisma.user.findFirst({
      where: { email, role: "ADMIN", deletedAt: null, store: { isActive: false } },
      select: { store: { select: { id: true, name: true, activationCodeSentAt: true } } },
    });

    if (owner?.store) {
      const sentAt = owner.store.activationCodeSentAt?.getTime() ?? 0;
      if (Date.now() - sentAt >= RESEND_COOLDOWN_MS) {
        const activation = createStoreActivationCode();
        await prisma.store.update({
          where: { id: owner.store.id },
          data: {
            activationCodeHash: activation.hash,
            activationCodeExpiresAt: activation.expiresAt,
            activationCodeSentAt: new Date(),
            activationCodeAttempts: 0,
          },
        });
        try {
          await sendStoreActivationEmail({ email, businessName: owner.store.name, code: activation.code });
        } catch (error) {
          console.error("[activation] failed to resend shop activation email", error);
        }
      }
    }

    return ok({ sent: true }, { message: "If the shop needs activation, a new code will be sent shortly." });
  } catch (error) {
    return handleApiError(error);
  }
}