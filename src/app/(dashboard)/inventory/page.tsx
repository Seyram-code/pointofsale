import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { InventoryWorkspace } from "@/components/inventory/InventoryWorkspace";

export const metadata: Metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  await requirePermission(PERMISSIONS.INVENTORY_VIEW, "/inventory");
  return <InventoryWorkspace />;
}
