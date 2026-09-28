import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError, handleApiError, ok } from "@/lib/api/response";

async function getAccessibleTicket(id: string) {
  const session = await getSession();
  if (!session) throw new ApiError("UNAUTHORIZED", "Authentication required", 401);
  const ticket = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true, storeId: true } });
  if (!ticket) throw ApiError.notFound("Support ticket");
  if (session.user.role !== "SUPER_ADMIN" && ticket.storeId !== session.user.storeId) {
    throw new ApiError("FORBIDDEN", "You cannot access this ticket", 403);
  }
  return { session, ticket };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { session } = await getAccessibleTicket(id);
    const now = new Date();
    await prisma.supportTicketPresence.deleteMany({ where: { ticketId: id, expiresAt: { lte: now } } });
    const typing = await prisma.supportTicketPresence.findMany({
      where: { ticketId: id, expiresAt: { gt: now }, userId: { not: session.user.id } },
      include: { user: { select: { id: true, fullName: true } } },
    });
    return ok(typing.map((presence) => presence.user));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { session } = await getAccessibleTicket(id);
    await prisma.supportTicketPresence.upsert({
      where: { ticketId_userId: { ticketId: id, userId: session.user.id } },
      create: { ticketId: id, userId: session.user.id, expiresAt: new Date(Date.now() + 4_000) },
      update: { expiresAt: new Date(Date.now() + 4_000) },
    });
    return ok({ typing: true });
  } catch (error) {
    return handleApiError(error);
  }
}
