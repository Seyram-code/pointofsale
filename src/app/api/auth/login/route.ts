import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema, staffAccessCodeLoginSchema } from "@/lib/validations/auth.schema";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { withRequestTimeout } from "@/lib/api/request-timeout";
import { recordAudit, requestContext } from "@/lib/services/audit.service";
import { hashStaffAccessCode } from "@/lib/auth/staff-access-code";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const context = requestContext(request);
    const isStaffLogin = typeof body === "object" && body !== null && "mode" in body && body.mode === "staff";
    let rememberDevice: boolean;
    let identifier = "";
    let password = "";
    let user;

    if (isStaffLogin) {
      const credentials = staffAccessCodeLoginSchema.parse(body);
      rememberDevice = credentials.rememberDevice;
      user = await withRequestTimeout(
        prisma.user.findFirst({
          where: {
            staffAccessCodeHash: hashStaffAccessCode(credentials.accessCode),
            deletedAt: null,
            employeeProfile: { isNot: null },
          },
        }),
        8000,
        "Database is unavailable or taking too long to respond.",
      );
    } else {
      const credentials = loginSchema.parse(body);
      identifier = credentials.identifier;
      password = credentials.password;
      rememberDevice = credentials.rememberDevice;

      const normalized = identifier.toLowerCase();
      const normalizedStaffCode = identifier.replace(/\s+/g, "").toUpperCase();
      if (normalized.includes("@")) {
        user = await withRequestTimeout(
          prisma.user.findFirst({
            where: {
              deletedAt: null,
              OR: [
                { email: normalized },
                { role: "ADMIN", store: { email: normalized } },
              ],
              employeeProfile: { is: null },
            },
          }),
          8000,
          "Database is unavailable or taking too long to respond.",
        );
      } else {
        const matchingUsers = await withRequestTimeout(
          prisma.user.findMany({
            where: {
              staffCode: normalizedStaffCode,
              deletedAt: null,
            },
            take: 2,
          }),
          8000,
          "Database is unavailable or taking too long to respond.",
        );
        user = matchingUsers.length === 1 ? matchingUsers[0] : null;
      }
    }

    // Same generic message whether the account is missing or the password is wrong.
    const invalid = new ApiError("UNAUTHORIZED", "Invalid credentials", 401);

    if (!user) {
      await recordAudit({
        action: "LOGIN_FAILED",
        entity: "User",
        summary: isStaffLogin ? "Failed staff access-code login" : `Failed login for unknown identifier "${identifier}"`,
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

    if (!isStaffLogin && (!user.passwordHash || !(await verifyPassword(password, user.passwordHash)))) {
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

    if (user.role === "ADMIN" && user.storeId) {
      const store = await prisma.store.findUnique({ where: { id: user.storeId }, select: { isActive: true } });
      if (store && !store.isActive) {
        throw new ApiError("FORBIDDEN", "Your shop is not activated yet. Enter the code sent to your email.", 403);
      }
    }

    // NOTE: An expired subscription no longer blocks sign-in. The shop stays gated at the
    // dashboard layout and the API layer (`authorize`) so the owner can still reach
    // `/subscription` and renew. See `hasSubscriptionAccess`.
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
