import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validations/auth.schema";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { recordAudit, requestContext } from "@/lib/services/audit.service";
import { hasSubscriptionAccess } from "@/lib/services/subscription.service";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, password, rememberDevice } = loginSchema.parse(body);
    const context = requestContext(request);

    const normalized = identifier.toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { email: normalized },
          { staffCode: identifier.toUpperCase() },
          { role: "ADMIN", store: { email: normalized } },
        ],
      },
    });

    // Same generic message whether the account is missing or the password is wrong.
    const invalid = new ApiError("UNAUTHORIZED", "Invalid credentials", 401);

    if (!user) {
      await recordAudit({
        action: "LOGIN_FAILED",
        entity: "User",
        summary: `Failed login for unknown identifier "${identifier}"`,
        ...context,
      });
      throw invalid;
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ApiError("FORBIDDEN", "Account temporarily locked. Try again later.", 423);
    }

    if (user.status !== "ACTIVE") {
      throw new ApiError("FORBIDDEN", "This account is not active. Contact your manager.", 403);
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      const attempts = user.failedLoginAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
        },
      });
      await recordAudit({
        action: "LOGIN_FAILED",
        entity: "User",
        entityId: user.id,
        userId: user.id,
        storeId: user.storeId,
        summary: `Failed login attempt ${attempts} of ${MAX_ATTEMPTS}`,
        ...context,
      });
      throw invalid;
    }

    if (user.role !== "SUPER_ADMIN" && user.storeId && !(await hasSubscriptionAccess(user.storeId))) {
      throw new ApiError("FORBIDDEN", "Your subscription has expired. Renew it to continue using the shop.", 403);
    }

    await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
      }),
      createSession(user.id, { ...context, rememberDevice }),
      recordAudit({
        action: "LOGIN",
        entity: "User",
        entityId: user.id,
        userId: user.id,
        storeId: user.storeId,
        summary: `${user.fullName} signed in`,
        ...context,
      }),
    ]);

    return ok({
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
