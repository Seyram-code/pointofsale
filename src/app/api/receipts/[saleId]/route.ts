import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getReceipt } from "@/lib/services/receipt.service";
import { recordAudit, requestContext } from "@/lib/services/audit.service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ saleId: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.POS_REPRINT_RECEIPT);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");

    const { saleId } = await params;
    const receipt = await getReceipt(session.user.storeId, saleId);

    await recordAudit({
      action: "EXPORT",
      entity: "Receipt",
      entityId: saleId,
      userId: session.user.id,
      storeId: session.user.storeId,
      summary: `Reprinted receipt ${receipt.receiptNumber}`,
      ...requestContext(request),
    });

    return ok(receipt);
  } catch (error) {
    return handleApiError(error);
  }
}
