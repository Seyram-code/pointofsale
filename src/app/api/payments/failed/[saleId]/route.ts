import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { checkOrReleaseFailedPaymentSale } from "@/lib/services/checkout.service";
import { recordAudit, requestContext } from "@/lib/services/audit.service";

const actionSchema = z.object({ forceRelease: z.boolean().default(false) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ saleId: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.POS_SELL);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const { saleId } = await params;
    const input = actionSchema.parse(await request.json());

    const result = await checkOrReleaseFailedPaymentSale(saleId, {
      storeId: session.user.storeId,
      cashierId: session.user.id,
      allowPriceOverride: session.user.permissions.includes(PERMISSIONS.POS_PRICE_OVERRIDE),
    }, input.forceRelease);

    if (result.manuallyReleased) {
      await recordAudit({
        action: "UPDATE",
        entity: "Sale",
        entityId: saleId,
        userId: session.user.id,
        storeId: session.user.storeId,
        summary: "Manually released stock for an unresolved payment",
        ...requestContext(request),
      });
    }

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
