import type { NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, checkPasswordStrength } from "@/lib/auth/password";
import { ApiError, created, handleApiError, ok } from "@/lib/api/response";
import { recordAudit, requestContext } from "@/lib/services/audit.service";
import { nextShortNumber, peekShortNumber, STAFF_ROLE_PREFIXES } from "@/lib/services/numbering.service";
import { getSubscriptionPlan } from "@/lib/config/subscription-plans";
import { createNotification } from "@/lib/services/notifications.service";
import { Prisma } from "@prisma/client";

const STAFF_ROLES: UserRole[] = ["ADMIN", "MANAGER", "SUPERVISOR", "CASHIER", "STOCK_KEEPER", "ACCOUNTANT"];

function canManageRole(sessionRole: string, role: string) {
  return role !== "ADMIN" || sessionRole === "ADMIN" || sessionRole === "SUPER_ADMIN";
}

export async function GET(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.EMPLOYEES_MANAGE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const role = request.nextUrl.searchParams.get("role");
    if (!role || !STAFF_ROLES.includes(role as UserRole) || !canManageRole(session.user.role, role)) {
      throw new ApiError("FORBIDDEN", "You cannot preview this role", 403);
    }

    const staffCode = await peekShortNumber(session.user.storeId, `STAFF_${role}`, STAFF_ROLE_PREFIXES[role]);
    const employeeNumber = await peekShortNumber(session.user.storeId, "EMPLOYEE", "EMP");
    return ok({ staffCode, employeeNumber });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.EMPLOYEES_MANAGE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const storeId = session.user.storeId;
    const subscription = await prisma.storeSubscription.findFirst({ where: { storeId }, orderBy: { createdAt: "desc" }, select: { plan: true } });
    const plan = getSubscriptionPlan(subscription?.plan ?? "STARTER");
    if (plan.maxStaff !== null) {
      const staffCount = await prisma.user.count({ where: { storeId, deletedAt: null } });
      if (staffCount >= plan.maxStaff) throw ApiError.badRequest(`${plan.name} supports up to ${plan.maxStaff} staff accounts. Upgrade your plan to add more.`);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = typeof body.role === "string" ? body.role : "";
    const position = typeof body.position === "string" ? body.position.trim() : "";
    const department = typeof body.department === "string" ? body.department.trim() : "";

    if (!fullName || !email || !password || !STAFF_ROLES.includes(role as UserRole)) {
      throw ApiError.badRequest("Name, email, role and password are required");
    }
    if (!canManageRole(session.user.role, role)) {
      throw new ApiError("FORBIDDEN", "Only administrators can create administrator accounts", 403);
    }
    const passwordCheck = checkPasswordStrength(password);
    if (!passwordCheck.valid) throw ApiError.badRequest(passwordCheck.issues.join(". "));

    const passwordHash = await hashPassword(password);

    let createdUser;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        createdUser = await prisma.$transaction(async (tx) => {
          const staffCode = await nextShortNumber(tx, storeId, `STAFF_${role}`, STAFF_ROLE_PREFIXES[role]);
          const employeeNumber = await nextShortNumber(tx, storeId, "EMPLOYEE", "EMP");
          const user = await tx.user.create({
            data: {
              storeId,
              fullName,
              email,
              staffCode,
              passwordHash,
              role: role as UserRole,
              status: "ACTIVE",
              mustChangePassword: false,
              employeeProfile: {
                create: { employeeNumber, position: position || null, department: department || null },
              },
            },
            select: { id: true, fullName: true, email: true, staffCode: true, role: true, employeeProfile: { select: { employeeNumber: true } } },
          });
          return user;
        });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) {
          await nextShortNumber(prisma, storeId, `STAFF_${role}`, STAFF_ROLE_PREFIXES[role]);
          await nextShortNumber(prisma, storeId, "EMPLOYEE", "EMP");
          continue;
        }
        throw error;
      }
    }

    if (!createdUser) throw new Error("Could not allocate unique employee identifiers");

    await recordAudit({
      action: "CREATE",
      entity: "User",
      entityId: createdUser.id,
      userId: session.user.id,
      storeId: session.user.storeId,
      summary: `Created ${createdUser.role.toLowerCase().replaceAll("_", " ")} account for ${createdUser.fullName}`,
      ...requestContext(request),
    });

    await createNotification({
      storeId: session.user.storeId,
      type: "SUCCESS",
      title: "Staff account created",
      body: `${createdUser.fullName} was added as a ${createdUser.role.toLowerCase().replaceAll("_", " ")}.`,
    });

    return created(createdUser);
  } catch (error) {
    return handleApiError(error);
  }
}