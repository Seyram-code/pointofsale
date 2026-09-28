import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError("UNAUTHORIZED", "Authentication required", 401);

    const { id } = await params;
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, storeId: true },
    });
    if (!ticket) throw ApiError.notFound("Support ticket");
    if (session.user.role !== "SUPER_ADMIN" && ticket.storeId !== session.user.storeId) {
      throw new ApiError("FORBIDDEN", "You cannot access this ticket", 403);
    }

    const result = await prisma.supportTicketMessage.updateMany({
      where: {
        ticketId: id,
        readAt: null,
        author: {
          is: session.user.role === "SUPER_ADMIN"
            ? { role: { not: "SUPER_ADMIN" } }
            : { role: "SUPER_ADMIN" },
        },
      },
      data: { readAt: new Date() },
    });

    return ok({ updated: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}