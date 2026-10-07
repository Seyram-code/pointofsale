import type { NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { createUniqueStaffAccessCode, encryptStaffAccessCode, getStoreAccessCodePrefix, hashStaffAccessCode } from "@/lib/auth/staff-access-code";
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
    const includeAccessCode = request.nextUrl.searchParams.get("includeAccessCode") === "1";
    let accessCode: string | undefined;
    if (includeAccessCode) {
      const existingHashes = await prisma.user.findMany({
        where: { staffAccessCodeHash: { not: null } },
        select: { staffAccessCodeHash: true },
      });
      const candidate = createUniqueStaffAccessCode(session.user.storeName ?? "Shop", existingHashes.map((user) => user.staffAccessCodeHash));
      accessCode = candidate.accessCode;
    }
    return ok({ staffCode, employeeNumber, ...(accessCode ? { accessCode } : {}) });
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
    const role = typeof body.role === "string" ? body.role : "";
    const requestedAccessCode = typeof body.staffAccessCode === "string" ? body.staffAccessCode.trim().toUpperCase() : "";

    if (!fullName || !STAFF_ROLES.includes(role as UserRole) || !requestedAccessCode) {
      throw ApiError.badRequest("Name, role and generated staff access code are required");
    }
    if (!canManageRole(session.user.role, role)) {
      throw new ApiError("FORBIDDEN", "Only administrators can create administrator accounts", 403);
    }
    const codePattern = new RegExp(`^${getStoreAccessCodePrefix(session.user.storeName ?? "Shop")}\\d{3}$`);
    if (!codePattern.test(requestedAccessCode)) throw ApiError.badRequest("Generate a valid staff access code for this store");
    const requestedAccessCodeHash = hashStaffAccessCode(requestedAccessCode);
    const existingAccessCode = await prisma.user.findUnique({
      where: { staffAccessCodeHash: requestedAccessCodeHash },
      select: { id: true },
    });
    if (existingAccessCode) {
      throw ApiError.conflict("This staff access code is already in use by another account.");
    }

    const existingHashes = await prisma.user.findMany({
      where: { staffAccessCodeHash: { not: null } },
      select: { staffAccessCodeHash: true },
    });
    let createdUser;
    let staffAccessCode = "";
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const createdEmployee = await prisma.$transaction(async (tx) => {
          const staffCode = await nextShortNumber(tx, storeId, `STAFF_${role}`, STAFF_ROLE_PREFIXES[role]);
          const employeeNumber = await nextShortNumber(tx, storeId, "EMPLOYEE", "EMP");
          const generatedCode = attempt === 0
            ? { accessCode: requestedAccessCode, hash: requestedAccessCodeHash }
            : createUniqueStaffAccessCode(session.user.storeName ?? "Shop", existingHashes.map((user) => user.staffAccessCodeHash));
          const user = await tx.user.create({
            data: {
              storeId,
              fullName,
              email: null,
              staffCode,
              passwordHash: null,
              staffAccessCodeHash: generatedCode.hash,
              staffAccessCodeEncrypted: encryptStaffAccessCode(generatedCode.accessCode),
              role: role as UserRole,
              status: "ACTIVE",
              mustChangePassword: false,
              employeeProfile: {
                create: { employeeNumber },
              },
            },
            select: { id: true, fullName: true, email: true, staffCode: true, role: true, employeeProfile: { select: { employeeNumber: true } } },
          });
          return { user, accessCode: generatedCode.accessCode };
        });
        createdUser = createdEmployee.user;
        staffAccessCode = createdEmployee.accessCode;
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 19) {
          if (attempt === 0) {
            const priorAccessCode = await prisma.user.findUnique({
              where: { staffAccessCodeHash: requestedAccessCodeHash },
              select: { id: true, storeId: true, employeeProfile: { select: { id: true } } },
            });
            if (priorAccessCode?.storeId === storeId && priorAccessCode.employeeProfile) {
              throw ApiError.conflict("This employee account was already created. Refresh the employee list before trying again.");
            }
          }
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

    return created({ ...createdUser, staffAccessCode });
  } catch (error) {
    return handleApiError(error);
  }
}