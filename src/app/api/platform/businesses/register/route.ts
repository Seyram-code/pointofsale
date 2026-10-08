import { after, type NextRequest } from "next/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { hashPassword, checkPasswordStrength } from "@/lib/auth/password";
import { nextShortNumber } from "@/lib/services/numbering.service";
import { generateBusinessId, generateBranchCode } from "@/lib/services/id-registry";
import { registrationSchema } from "@/lib/validations/registration.schema";
import { createStoreActivationCode, createStoreActivationLinkToken, sendStoreActivationEmail } from "@/lib/services/store-activation.service";
import { notifySuperAdmins } from "@/lib/services/super-admin-alerts.service";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new UnauthorizedError();
    if (session.user.role !== "SUPER_ADMIN") throw new ForbiddenError("Only the super admin can register businesses");

    const input = registrationSchema.parse(await request.json());
    const passwordCheck = checkPasswordStrength(input.password);
    if (!passwordCheck.valid) throw ApiError.badRequest(passwordCheck.issues.join(". "));

    const ownerEmail = input.email.toLowerCase();
    const businessEmail = input.businessEmail.toLowerCase();
    const passwordHash = await hashPassword(input.password);
    const activation = createStoreActivationCode();
    const activationLink = createStoreActivationLinkToken();
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const registered = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
      if (existing) throw ApiError.conflict("An account with this owner email already exists");

      const businessId = generateBusinessId();
      const store = await tx.store.create({
        data: {
          businessId,
          name: input.businessName,
          businessType: input.businessType,
          businessRegistrationNumber: input.businessRegistrationNumber || null,
          branchCode: generateBranchCode(),
          phone: input.businessPhone,
          email: businessEmail,
          addressLine: input.address,
          city: input.city,
          region: input.region,
          country: input.country,
          logoUrl: input.logoUrl || null,
          currency: input.currency || "GHS",
          timezone: "Africa/Accra",
          taxSettings: input.taxSettings || null,
          isActive: false,
          emailVerifiedAt: null,
          activationCodeHash: activation.hash,
          activationCodeExpiresAt: activation.expiresAt,
          activationCodeSentAt: now,
          activationCodeAttempts: 0,
          activationLinkTokenHash: activationLink.hash,
          activationLinkExpiresAt: activationLink.expiresAt,
          subscriptions: {
            create: {
              plan: input.plan,
              status: "TRIALING",
              currentPeriodStart: now,
              currentPeriodEnd: trialEndsAt,
              trialEndsAt,
            },
          },
        },
        select: { id: true, businessId: true, name: true },
      });
      await tx.taxRate.createMany({
        data: [
          { storeId: store.id, name: "Ghana Standard (VAT + Levies)", rate: 0.21, description: "VAT 15% + NHIL 2.5% + GETFund 2.5% + COVID-19 Levy 1%", isDefault: true },
          { storeId: store.id, name: "Zero Rated", rate: 0, description: "Exempt / zero-rated goods" },
        ],
      });
      const staffCode = await nextShortNumber(tx, store.id, "STAFF_ADMIN", "ADM");
      const owner = await tx.user.create({
        data: {
          storeId: store.id,
          staffCode,
          fullName: input.ownerName,
          email: ownerEmail,
          phone: input.phone,
          passwordHash,
          role: "ADMIN",
          status: "ACTIVE",
          mustChangePassword: false,
        },
        select: { fullName: true, email: true },
      });

      await tx.auditLog.create({
        data: {
          storeId: store.id,
          userId: session.user.id,
          action: "CREATE",
          entity: "Store",
          entityId: store.id,
          summary: `Registered business ${store.name} for ${owner.fullName}`,
          changes: { plan: input.plan, ownerEmail },
        },
      });

      return { ...store, owner };
    });

    after(async () => {
      try {
        await sendStoreActivationEmail({
          email: ownerEmail,
          businessName: registered.name,
          code: activation.code,
          linkToken: activationLink.token,
          appUrl: new URL(request.url).origin,
        });
      } catch (error) {
        console.error("[activation] failed to send shop activation email", error);
      }
      await notifySuperAdmins({
        subject: "New business registered on VidyPOS",
        text: `${registered.name} has been registered by a Super Admin and is awaiting email activation.`,
        details: [
          { label: "Business", value: registered.name },
          { label: "Business ID", value: registered.businessId ?? registered.id },
          { label: "Owner", value: registered.owner.fullName },
          { label: "Owner email", value: registered.owner.email ?? ownerEmail },
          { label: "Plan", value: input.plan },
          { label: "Registered by", value: session.user.fullName },
          { label: "Registered", value: new Date().toISOString() },
        ],
      });
    });

    return ok(registered, undefined, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
