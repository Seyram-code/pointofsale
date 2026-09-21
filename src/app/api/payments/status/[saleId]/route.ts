import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { refreshPaymentStatus } from "@/lib/services/checkout.service";

/** Polled by the till while a MoMo prompt or card payment is outstanding. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ saleId: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.POS_SELL);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");

    const { saleId } = await params;

    return ok(
      await refreshPaymentStatus(saleId, {
        storeId: session.user.storeId,
        cashierId: session.user.id,
        allowPriceOverride: session.user.permissions.includes(PERMISSIONS.POS_PRICE_OVERRIDE),
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
