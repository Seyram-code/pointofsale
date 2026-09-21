import { authorize } from "@/lib/auth/guard";
import { handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listHeldSales } from "@/lib/services/sale.service";

export async function GET() {
  try {
    const session = await authorize(PERMISSIONS.POS_ACCESS);
    if (!session.user.storeId) return ok([]);

    // Supervisors can resume any till's held sale; cashiers only see their own.
    const seesAll = session.user.permissions.includes(PERMISSIONS.SALES_VIEW_ALL);
    return ok(await listHeldSales(session.user.storeId, seesAll ? undefined : session.user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
