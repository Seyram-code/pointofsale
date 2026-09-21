import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getReportData } from "@/lib/services/report.service";
import { reportQuerySchema } from "@/lib/validations/report.schema";

export async function GET(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.REPORTS_DAILY);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const query = reportQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const scopedCashierId = session.user.permissions.includes(PERMISSIONS.SALES_VIEW_ALL) ? undefined : session.user.id;
    return ok(await getReportData(session.user.storeId, query, scopedCashierId));
  } catch (error) {
    return handleApiError(error);
  }
}
