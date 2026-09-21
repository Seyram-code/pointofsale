import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listInventory } from "@/lib/services/inventory.service";
import { inventoryQuerySchema } from "@/lib/validations/inventory.schema";

export async function GET(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.INVENTORY_VIEW);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const query = inventoryQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    return ok(await listInventory(session.user.storeId, query));
  } catch (error) {
    return handleApiError(error);
  }
}
