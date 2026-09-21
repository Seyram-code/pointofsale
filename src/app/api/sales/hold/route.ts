import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { ApiError, created, handleApiError } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { holdSale } from "@/lib/services/sale.service";
import { holdSaleSchema } from "@/lib/validations/sale.schema";
import { recordAudit, requestContext } from "@/lib/services/audit.service";

/** Parks a cart. Completing a sale goes through /api/payments/checkout. */
export async function POST(request: NextRequest) {
  try {
    const session = await authorize([PERMISSIONS.POS_SELL, PERMISSIONS.POS_HOLD_SALE]);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");

    const input = holdSaleSchema.parse(await request.json());

    if (input.discount && !session.user.permissions.includes(PERMISSIONS.POS_DISCOUNT_APPLY)) {
      throw new ApiError("FORBIDDEN", "You are not allowed to apply discounts", 403);
    }

    const sale = await holdSale(input, {
      storeId: session.user.storeId,
      cashierId: session.user.id,
      allowPriceOverride: session.user.permissions.includes(PERMISSIONS.POS_PRICE_OVERRIDE),
    });

    await recordAudit({
      action: "CREATE",
      entity: "Sale",
      entityId: sale.id,
      userId: session.user.id,
      storeId: session.user.storeId,
      summary: `Held sale ${sale.receiptNumber} with ${sale.itemCount} line(s)`,
      ...requestContext(request),
    });

    return created(sale);
  } catch (error) {
    return handleApiError(error);
  }
}
