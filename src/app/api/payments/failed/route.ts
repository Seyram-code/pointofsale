import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listFailedPaymentSales } from "@/lib/services/checkout.service";

export async function GET() {
  try {
    const session = await authorize(PERMISSIONS.POS_ACCESS);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const seesAll = session.user.permissions.includes(PERMISSIONS.SALES_VIEW_ALL);
    return ok(await listFailedPaymentSales(session.user.storeId, seesAll ? undefined : session.user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
