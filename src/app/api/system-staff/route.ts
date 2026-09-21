import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, checkPasswordStrength } from "@/lib/auth/password";
import { ApiError, created, handleApiError, ok } from "@/lib/api/response";
import { nextShortNumber } from "@/lib/services/numbering.service";

const createStaffSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string(),
});

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) throw new ApiError("UNAUTHORIZED", "Authentication required", 401);
  if (session.user.role !== "SUPER_ADMIN") throw new ApiError("FORBIDDEN", "Super-admin access required", 403);
  return session;
}

export async function GET() {
  try {
    await requireSuperAdmin();
    const staff = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN", deletedAt: null },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true, staffCode: true, status: true, lastLoginAt: true, createdAt: true },
    });
    return ok(staff);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSuperAdmin();
    const input = createStaffSchema.parse(await request.json());
    const passwordCheck = checkPasswordStrength(input.password);
    if (!passwordCheck.valid) throw ApiError.badRequest(passwordCheck.issues.join(". "));

    const passwordHash = await hashPassword(input.password);
    const staff = await prisma.$transaction(async (tx) => {
      const staffCode = await nextShortNumber(tx, "SYSTEM", "SYSTEM_STAFF", "SADM");
      const createdStaff = await tx.user.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          staffCode,
          passwordHash,
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          mustChangePassword: false,
        },
        select: { id: true, fullName: true, email: true, staffCode: true, role: true, status: true },
      });

      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "User",
          entityId: createdStaff.id,
          userId: session.user.id,
          summary: `Created system staff account for ${createdStaff.fullName}`,
        },
      });

      return createdStaff;
    });

    return created(staff);
  } catch (error) {
    return handleApiError(error);
  }
}
