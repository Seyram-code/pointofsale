import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { hashPassword, checkPasswordStrength } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { nextShortNumber } from "@/lib/services/numbering.service";
import { registrationSchema } from "@/lib/validations/registration.schema";

export async function POST(request: NextRequest) {
  try {
    const input = registrationSchema.parse(await request.json());
    const passwordCheck = checkPasswordStrength(input.password);
    if (!passwordCheck.valid) throw ApiError.badRequest(passwordCheck.issues.join(". "));
    const ownerEmail = input.email.toLowerCase();
    const businessEmail = input.businessEmail.toLowerCase();
    const passwordHash = await hashPassword(input.password);
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const owner = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
      if (existing) throw ApiError.conflict("An account with this email already exists");

      const businessId = `BUS-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
      const store = await tx.store.create({
        data: {
          businessId,
          name: input.businessName,
          businessType: input.businessType,
          businessRegistrationNumber: input.businessRegistrationNumber || null,
          branchCode: `SHOP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
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
      const staffCode = await nextShortNumber(tx, store.id, "STAFF_ADMIN", "ADM");
      return tx.user.create({
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
    });

    await createSession(owner.id, { userAgent: request.headers.get("user-agent"), ipAddress: request.headers.get("x-forwarded-for") });
    return ok({ fullName: owner.fullName, email: owner.email, storeId: owner.storeId }, undefined, 201);
  } catch (error) {
    return handleApiError(error);
  }
}