import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { handleApiError, ok, created } from "@/lib/api/response";
import { createOfflineDraftSale, processOfflineDraftSale } from "@/lib/services/offline-pos.service";

const draftSchema = z.object({
  payload: z.object({
    id: z.string().min(1),
    customerId: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
      }),
    ),
    createdAt: z.string(),
  }),
});

export async function GET() {
  try {
    const session = await authorize(PERMISSIONS.POS_SELL, { planFeature: "offlinePos" });
    if (!session.user.storeId) throw new Error("Store is required");

    const drafts = await prisma.offlineSaleDraft.findMany({
      where: { storeId: session.user.storeId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return ok(drafts);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.POS_SELL, { planFeature: "offlinePos" });
    if (!session.user.storeId) throw new Error("Store is required");

    const input = draftSchema.parse(await request.json());
    const draft = await createOfflineDraftSale(session.user.storeId, session.user.id, input.payload);

    try {
      await processOfflineDraftSale(session.user.storeId, session.user.id, { ...input.payload, id: draft.id });
    } catch {
      // Keep the draft record for retry; failures here do not erase the saved offline entry.
    }

    return created(draft);
  } catch (error) {
    return handleApiError(error);
  }
}
