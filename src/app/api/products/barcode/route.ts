import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { findProductByBarcode } from "@/lib/services/product.service";
import { barcodeLookupSchema } from "@/lib/validations/sale.schema";

export async function GET(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.PRODUCTS_POS_LOOKUP);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");

    const { code } = barcodeLookupSchema.parse({ code: request.nextUrl.searchParams.get("code") ?? "" });
    const product = await findProductByBarcode(session.user.storeId, code);

    if (!product) throw new ApiError("NOT_FOUND", "Product not found.", 404, { code });

    return ok(product);
  } catch (error) {
    return handleApiError(error);
  }
}
