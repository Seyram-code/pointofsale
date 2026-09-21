import { z } from "zod";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { getPlatformPlanPricing } from "@/lib/services/plan-pricing.service";

const planSchema = z.object({
  plan: z.enum(["STARTER", "GROWTH", "ENTERPRISE"]),
  monthlyPrice: z.number().finite().positive().nullable(),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new UnauthorizedError();
    if (session.user.role !== "SUPER_ADMIN") throw new ForbiddenError("Only the super admin can manage platform plans");
    return ok(await getPlatformPlanPricing());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) throw new UnauthorizedError();
    if (session.user.role !== "SUPER_ADMIN") throw new ForbiddenError("Only the super admin can manage platform plans");
    const input = planSchema.parse(await request.json());
    if (input.plan !== "ENTERPRISE" && input.monthlyPrice === null) throw ApiError.badRequest("This plan needs a monthly amount");

    await prisma.platformPlan.upsert({
      where: { key: input.plan },
      create: { key: input.plan, monthlyPrice: input.monthlyPrice, updatedById: session.user.id },
      update: { monthlyPrice: input.monthlyPrice, updatedById: session.user.id },
    });
    return ok(await getPlatformPlanPricing());
  } catch (error) {
    return handleApiError(error);
  }
}