import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

const statuses = ["NEW", "PREPARING", "READY", "SERVED"] as const;

export async function GET() {
  try {
    const session = await authorize(PERMISSIONS.KITCHEN_VIEW);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    if (session.user.businessType !== "RESTAURANT") throw ApiError.notFound("Kitchen board");

    const tickets = await prisma.$queryRaw<Array<{
      id: string;
      saleId: string;
      status: string;
      createdAt: Date;
      orderType: string | null;
      tableNumber: string | null;
      receiptNumber: string;
      cashierName: string;
      items: Array<{ name: string; quantity: number; sku: string; optionsJson: string | null }> | string;
    }>>(Prisma.sql`
      SELECT kt.id, kt.saleId, kt.status, kt.createdAt, s.orderType, s.tableNumber,
        s.receiptNumber, u.fullName AS cashierName,
        JSON_ARRAYAGG(JSON_OBJECT('name', si.productName, 'quantity', si.quantity, 'sku', si.sku, 'optionsJson', si.optionsJson)) AS items
      FROM KitchenTicket kt
      INNER JOIN Sale s ON s.id = kt.saleId
      INNER JOIN User u ON u.id = s.cashierId
      INNER JOIN SaleItem si ON si.saleId = s.id
      WHERE kt.storeId = ${session.user.storeId} AND kt.status <> 'SERVED'
      GROUP BY kt.id, kt.saleId, kt.status, kt.createdAt, s.orderType, s.tableNumber, s.receiptNumber, u.fullName
      ORDER BY FIELD(kt.status, 'NEW', 'PREPARING', 'READY', 'SERVED'), kt.createdAt ASC
      LIMIT 100
    `);

    return ok(tickets.map((ticket) => {
      const items = typeof ticket.items === "string" ? JSON.parse(ticket.items) as Array<{ name: string; quantity: number; sku: string; optionsJson: string | null }> : ticket.items;
      return {
        ...ticket,
        items: items.map((item) => ({
          name: item.name,
          quantity: Number(item.quantity),
          sku: item.sku,
          selectedOptions: item.optionsJson ? JSON.parse(item.optionsJson) as Array<{ id: string; name: string; priceDelta: number }> : [],
        })),
      };
    }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.KITCHEN_VIEW);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    if (session.user.businessType !== "RESTAURANT") throw ApiError.notFound("Kitchen board");
    const body = await request.json() as { ticketId?: unknown; status?: unknown };
    if (typeof body.ticketId !== "string" || !statuses.includes(body.status as (typeof statuses)[number])) {
      throw ApiError.badRequest("Choose a valid ticket status");
    }

    const [ticket] = await prisma.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT id, status FROM KitchenTicket WHERE id = ${body.ticketId} AND storeId = ${session.user.storeId} LIMIT 1
    `);
    if (!ticket) throw ApiError.notFound("Kitchen ticket");
    const nextStatus = body.status as (typeof statuses)[number];
    const currentIndex = statuses.indexOf(ticket.status as (typeof statuses)[number]);
    if (statuses[currentIndex + 1] !== nextStatus) throw ApiError.badRequest("Tickets must move to the next kitchen status");

    await prisma.$executeRaw(Prisma.sql`
      UPDATE KitchenTicket SET status = ${nextStatus}, updatedAt = NOW(3),
        completedAt = ${nextStatus === "SERVED" ? new Date() : null}
      WHERE id = ${ticket.id} AND storeId = ${session.user.storeId} AND status = ${ticket.status}
    `);
    return ok({ updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}