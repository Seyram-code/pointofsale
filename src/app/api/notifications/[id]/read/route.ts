import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";

const paramsSchema = z.object({ id: z.string().min(1) });

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize();
    const { id } = paramsSchema.parse(await context.params);
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) throw ApiError.notFound("Notification");
    if (notification.userId && notification.userId !== session.user.id) {
      throw new ApiError("FORBIDDEN", "You cannot update this notification", 403);
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
