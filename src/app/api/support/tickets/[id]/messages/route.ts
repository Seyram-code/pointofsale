import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError, created, handleApiError } from "@/lib/api/response";

const messageSchema = z.object({ body: z.string().trim().min(1).max(10000) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError("UNAUTHORIZED", "Authentication required", 401);
    const { id } = await params;
    const input = messageSchema.parse(await request.json());
    const ticket = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true, storeId: true, subject: true, createdById: true } });
    if (!ticket) throw ApiError.notFound("Support ticket");
    if (session.user.role !== "SUPER_ADMIN" && ticket.storeId !== session.user.storeId) {
      throw new ApiError("FORBIDDEN", "You cannot access this ticket", 403);
    }

    const message = await prisma.supportTicketMessage.create({
      data: { ticketId: id, authorId: session.user.id, body: input.body },
      include: { author: { select: { id: true, fullName: true, role: true } } },
    });

    const recipientId = session.user.role === "SUPER_ADMIN" ? ticket.createdById : undefined;
    if (recipientId || session.user.role !== "SUPER_ADMIN") {
      const admins = recipientId ? [] : await prisma.user.findMany({ where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null }, select: { id: true } });
      const recipients = recipientId ? [{ id: recipientId }] : admins;
      if (recipients.length > 0) {
        await prisma.notification.createMany({
          data: recipients.map((recipient) => ({
            userId: recipient.id,
            storeId: ticket.storeId,
            type: "INFO" as const,
            title: `New reply: ${ticket.subject}`,
            body: `${session.user.fullName} added a reply to the support ticket.`,
          })),
        });
      }
    }

    return created(message);
  } catch (error) {
    return handleApiError(error);
  }
}
