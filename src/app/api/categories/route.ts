import { authorize } from "@/lib/auth/guard";
import { handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listPosCategories } from "@/lib/services/product.service";

export async function GET() {
  try {
    const session = await authorize(PERMISSIONS.PRODUCTS_POS_LOOKUP);
    if (!session.user.storeId) return ok([]);

    return ok(await listPosCategories(session.user.storeId));
  } catch (error) {
    return handleApiError(error);
  }
}
