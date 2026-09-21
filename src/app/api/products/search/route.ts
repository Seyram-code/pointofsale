import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { searchProducts } from "@/lib/services/product.service";
import { productSearchSchema } from "@/lib/validations/sale.schema";

export async function GET(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.PRODUCTS_POS_LOOKUP);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");

    const params = productSearchSchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const products = await searchProducts(session.user.storeId, params);

    return ok(products);
  } catch (error) {
    return handleApiError(error);
  }
}
