import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError, created, handleApiError, ok } from "@/lib/api/response";
import { notifySuperAdmins } from "@/lib/services/super-admin-alerts.service";

const ticketSchema = z.object({
  subject: z.string().trim().min(3).max(191),
  category: z.string().trim().min(2).max(80),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  description: z.string().trim().min(10).max(10000),
});

const ticketInclude = {
  store: { select: { id: true, name: true, branchCode: true } },
  createdBy: { select: { id: true, fullName: true, email: true, role: true } },
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, fullName: true, role: true } } },
  },
};

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new ApiError("UNAUTHORIZED", "Authentication required", 401);

    const tickets = await prisma.supportTicket.findMany({
      where: session.user.role === "SUPER_ADMIN" ? undefined : { storeId: session.user.storeId ?? "" },
      include: ticketInclude,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return ok(tickets);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError("UNAUTHORIZED", "Authentication required", 401);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");

    const input = ticketSchema.parse(await request.json());
    const ticket = await prisma.supportTicket.create({
      data: {
        storeId: session.user.storeId,
        createdById: session.user.id,
        subject: input.subject,
        category: input.category,
        priority: input.priority,
        messages: { create: { authorId: session.user.id, body: input.description } },
      },
      include: ticketInclude,
    });

    const admins = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    if (admins.length > 0) {
      try {
        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            storeId: session.user.storeId,
            type: input.priority === "URGENT" || input.priority === "HIGH" ? "WARNING" as const : "INFO" as const,
            title: `New support ticket: ${input.subject}`,
            body: `${session.user.fullName} submitted a ${input.priority.toLowerCase()} priority ticket for ${ticket.store.name}.`,
          })),
        });
      } catch (notificationError) {
        console.error("[support] ticket submitted but admin notifications failed", notificationError);
      }
    }

    after(async () => {
      await notifySuperAdmins({
        subject: `New ${input.priority.toLowerCase()} support ticket: ${input.subject}`,
        text: `${session.user.fullName} submitted a support ticket for ${ticket.store.name}.`,
        details: [
          { label: "Business", value: ticket.store.name },
          { label: "Submitted by", value: session.user.fullName },
          { label: "Submitter email", value: session.user.email ?? "Not provided" },
          { label: "Category", value: input.category },
          { label: "Priority", value: input.priority },
          { label: "Subject", value: input.subject },
          { label: "Description", value: input.description },
          { label: "Ticket ID", value: ticket.id },
        ],
      });
    });

    return created(ticket);
  } catch (error) {
    return handleApiError(error);
  }
}
