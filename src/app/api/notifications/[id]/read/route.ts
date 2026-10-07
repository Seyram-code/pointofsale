import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { canAccessNotification } from "@/lib/auth/notification-access";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";

const paramsSchema = z.object({ id: z.string().min(1) });

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize();
    const { id } = paramsSchema.parse(await context.params);
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) throw ApiError.notFound("Notification");

    if (!canAccessNotification(session, notification)) {
      throw new ApiError("FORBIDDEN", "You cannot update this notification", 403);
    }

    const updated = await prisma.notification.updateMany({
      where: {
        id,
        ...(notification.userId
          ? { userId: session.user.id, ...(notification.storeId ? { storeId: session.user.storeId } : {}) }
          : { storeId: session.user.storeId! }),
      },
      data: { readAt: new Date() },
    });
    if (updated.count !== 1) throw ApiError.notFound("Notification");

    return ok({ id, readAt: new Date() });
  } catch (error) {
    return handleApiError(error);
  }
}
