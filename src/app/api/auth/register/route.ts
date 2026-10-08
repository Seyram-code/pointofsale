import { after, type NextRequest } from "next/server";
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

    const registration = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
      if (existing) throw ApiError.conflict("An account with this email already exists");

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
        select: { id: true, fullName: true, email: true, storeId: true },
      });
      return { owner, businessId: store.businessId };
    });
    const { owner } = registration;

    after(async () => {
      try {
        await sendStoreActivationEmail({
          email: ownerEmail,
          businessName: input.businessName,
          code: activation.code,
          linkToken: activationLink.token,
          appUrl: new URL(request.url).origin,
        });
      } catch (error) {
        console.error("[activation] failed to send shop activation email", error);
      }
      await notifySuperAdmins({
        subject: "New business registered on VidyPOS",
        text: `${input.businessName} has registered and is awaiting email activation.`,
        details: [
          { label: "Business", value: input.businessName },
          { label: "Business ID", value: registration.businessId ?? registration.owner.storeId ?? "Not assigned" },
          { label: "Owner", value: owner.fullName },
          { label: "Owner email", value: owner.email ?? ownerEmail },
          { label: "Plan", value: input.plan },
          { label: "Registered", value: new Date().toISOString() },
        ],
      });
    });
    return ok({ fullName: owner.fullName, email: owner.email, storeId: owner.storeId, activationRequired: true }, undefined, 201);
  } catch (error) {
    return handleApiError(error);
  }
}