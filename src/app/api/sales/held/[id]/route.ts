import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { discardHeldSale, getHeldSale } from "@/lib/services/sale.service";
import { recordAudit, requestContext } from "@/lib/services/audit.service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.POS_ACCESS);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");

    const { id } = await params;
    return ok(await getHeldSale(session.user.storeId, id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.POS_ACCESS);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");

    const { id } = await params;
    await discardHeldSale(session.user.storeId, id);

    await recordAudit({
      action: "DELETE",
      entity: "Sale",
      entityId: id,
      userId: session.user.id,
      storeId: session.user.storeId,
      summary: "Discarded a held sale",
      ...requestContext(request),
    });

    return ok({ discarded: true });
  } catch (error) {
    return handleApiError(error);
  }
}
