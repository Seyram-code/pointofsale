import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { ApiError, created, handleApiError, ok } from "@/lib/api/response";

const notificationSchema = z.object({
  userId: z.string().optional(),
  storeId: z.string().optional(),
  type: z.enum(["INFO", "SUCCESS", "WARNING", "ERROR"]).optional(),
  title: z.string().min(1),
  body: z.string().min(1),
});

export async function GET() {
  try {
    const session = await authorize();
    const notifications = await prisma.notification.findMany({
      where: session.user.storeId
        ? { OR: [{ userId: session.user.id }, { storeId: session.user.storeId }] }
        : { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return ok(notifications);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authorize();
    const input = notificationSchema.parse(await request.json());
    const storeId = input.storeId ?? session.user.storeId;
    const userId = input.userId ?? session.user.id;

    if (!storeId && !userId) {
      throw ApiError.badRequest("A notification must target a user or store");
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        storeId,
        type: input.type ?? "INFO",
        title: input.title,
        body: input.body,
      },
    });

    return created(notification);
  } catch (error) {
    return handleApiError(error);
  }
}
