import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { KitchenBoard } from "@/components/kitchen/KitchenBoard";

export const metadata: Metadata = { title: "Kitchen" };
export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  await requirePermission(PERMISSIONS.KITCHEN_VIEW, "/kitchen");
  return <KitchenBoard />;
}