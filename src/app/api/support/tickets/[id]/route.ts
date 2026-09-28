import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";

const updateSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"]),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError("UNAUTHORIZED", "Authentication required", 401);
    if (session.user.role !== "SUPER_ADMIN") throw new ApiError("FORBIDDEN", "Only super admins can update ticket status", 403);

    const { id } = await params;
    const input = updateSchema.parse(await request.json());
    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw ApiError.notFound("Support ticket");

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: {
        status: input.status,
        resolvedAt: input.status === "RESOLVED" || input.status === "CLOSED" ? new Date() : null,
      },
    });

    await prisma.notification.create({
      data: {
        userId: ticket.createdById,
        storeId: ticket.storeId,
        type: input.status === "RESOLVED" || input.status === "CLOSED" ? "SUCCESS" : "INFO",
        title: `Support ticket updated: ${ticket.subject}`,
        body: `Your ticket status is now ${input.status.replaceAll("_", " ").toLowerCase()}.`,
      },
    });

    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
