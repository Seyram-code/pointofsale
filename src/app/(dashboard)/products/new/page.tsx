import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductForm } from "@/components/products/ProductForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Add Menu Item" };

export default async function NewProductPage() {
  await requirePermission(PERMISSIONS.PRODUCTS_CREATE, "/products/new");
  return (
    <>
      <PageHeader title="Add menu item" description="Create a menu item with pricing and stock details." breadcrumbs={[{ label: "Menu items", href: "/products" }, { label: "Add menu item" }]} actions={<Link href="/products" className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-fg-secondary hover:bg-muted"><ArrowLeft className="size-4" />Back to menu items</Link>} />
      <ProductForm mode="restaurant" />
    </>
  );
}
