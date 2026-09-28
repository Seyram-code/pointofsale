import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductForm } from "@/components/products/ProductForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Add Product" };

export default async function NewProductPage() {
  const { user } = await requirePermission(PERMISSIONS.PRODUCTS_CREATE, "/products/new");
  const isRestaurant = user.businessType === "RESTAURANT";
  const itemLabel = isRestaurant ? "menu item" : "product";
  return (
    <>
      <PageHeader title={`Add ${itemLabel}`} description={`Create a ${itemLabel} with pricing and stock details.`} breadcrumbs={[{ label: isRestaurant ? "Menu items" : "Products", href: "/products" }, { label: `Add ${itemLabel}` }]} actions={<Link href="/products" className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-fg-secondary hover:bg-muted"><ArrowLeft className="size-4" />Back to {isRestaurant ? "menu items" : "products"}</Link>} />
      <ProductForm mode={isRestaurant ? "restaurant" : "retail"} />
    </>
  );
}
