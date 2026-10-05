import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { searchCatalogueProducts } from "@/lib/services/product.service";
import { z } from "zod";

const CATALOGUE_PAGE_SIZE = 15;

const catalogueQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  categoryId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export async function GET(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.PRODUCTS_VIEW);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");

    const query = catalogueQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const result = await searchCatalogueProducts(session.user.storeId, { ...query, pageSize: CATALOGUE_PAGE_SIZE });
    const totalPages = Math.max(1, Math.ceil(result.total / CATALOGUE_PAGE_SIZE));

    return ok({
      products: result.products,
      pagination: {
        page: result.page,
        pageSize: CATALOGUE_PAGE_SIZE,
        total: result.total,
        totalPages,
        hasPrev: result.page > 1,
        hasNext: result.page < totalPages,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}