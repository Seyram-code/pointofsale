import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export interface OfflineDraftSalePayload {
  id: string;
  customerId?: string | null;
  note?: string | null;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  createdAt: string;
}

export async function createOfflineDraftSale(storeId: string, cashierId: string | null, payload: OfflineDraftSalePayload) {
  const payloadValue = payload as unknown as Prisma.InputJsonValue;
  return prisma.offlineSaleDraft.create({
    data: {
      storeId,
      cashierId,
      payload: payloadValue,
    },
  });
}

export async function listOfflineDraftSales(storeId: string) {
  return prisma.offlineSaleDraft.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
  });
}

export async function syncOfflineDraftSales(storeId: string) {
  const drafts = await prisma.offlineSaleDraft.findMany({
    where: { storeId, syncedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return drafts.map((draft) => ({
    id: draft.id,
    payload: draft.payload,
    createdAt: draft.createdAt,
  }));
}
