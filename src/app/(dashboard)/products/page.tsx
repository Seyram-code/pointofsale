import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listPosCategories, searchProducts } from "@/lib/services/product.service";
import { ProductCatalogue } from "@/components/products/ProductCatalogue";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { user } = await requirePermission(PERMISSIONS.PRODUCTS_VIEW, "/products");
  const [products, categories] = user.storeId
    ? await Promise.all([
        searchProducts(user.storeId, { limit: 100 }),
        listPosCategories(user.storeId),
      ])
    : [[], []];

  return <ProductCatalogue initialProducts={products} categories={categories} canEdit={user.permissions.includes(PERMISSIONS.PRODUCTS_UPDATE)} canDelete={user.permissions.includes(PERMISSIONS.PRODUCTS_DELETE)} canImport={user.permissions.includes(PERMISSIONS.PRODUCTS_CREATE)} />;
}
