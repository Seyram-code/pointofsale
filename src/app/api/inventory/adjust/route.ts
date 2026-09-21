import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { ApiError, created, handleApiError } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { adjustStock } from "@/lib/services/inventory.service";
import { stockAdjustmentSchema } from "@/lib/validations/inventory.schema";
import { recordAudit, requestContext } from "@/lib/services/audit.service";

export async function POST(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.INVENTORY_ADJUST);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const input = stockAdjustmentSchema.parse(await request.json());
    const result = await adjustStock(session.user.storeId, session.user.id, input);
    await recordAudit({
      action: "STOCK_ADJUSTMENT",
      entity: "InventoryLevel",
      entityId: result.productId,
      userId: session.user.id,
      storeId: session.user.storeId,
      summary: `Adjusted stock for ${result.productName}`,
      ...requestContext(request),
    });
    return created(result);
  } catch (error) {
    return handleApiError(error);
  }
}
