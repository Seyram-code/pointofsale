import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listInventoryCategories } from "@/lib/services/inventory.service";

export async function GET() {
  try {
    const session = await authorize(PERMISSIONS.INVENTORY_VIEW);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    return ok(await listInventoryCategories(session.user.storeId));
  } catch (error) {
    return handleApiError(error);
  }
}
