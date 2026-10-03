import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReturnsWorkspace } from "@/components/returns/ReturnsWorkspace";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { requirePlanFeature } from "@/lib/services/subscription.service";
import { PlanUpgradeNotice } from "@/components/subscription/PlanUpgradeNotice";

export const metadata: Metadata = { title: "Returns" };
export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  const { user } = await requirePermission(PERMISSIONS.RETURNS_VIEW, "/returns");
  const featureAccess = user.role === "SUPER_ADMIN" || !user.storeId
    ? { allowed: true as const, planLabel: "Enterprise" }
    : await requirePlanFeature(user.storeId, "returns");
  if (!featureAccess.allowed) return <PlanUpgradeNotice message={featureAccess.message} />;
  const returns = user.storeId
    ? await prisma.saleReturn.findMany({
        where: { storeId: user.storeId },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { sale: { select: { receiptNumber: true } }, customer: { select: { fullName: true } } },
      })
    : [];

  return (
    <>
      <PageHeader title="Returns" description="Review returned items, refunds and approval status." />
      <ReturnsWorkspace
        canCreate={user.permissions.includes(PERMISSIONS.RETURNS_CREATE)}
        canApprove={user.permissions.includes(PERMISSIONS.RETURNS_APPROVE)}
        returns={returns.map((item) => ({
          id: item.id,
          returnNumber: item.returnNumber,
          saleReceipt: item.sale.receiptNumber,
          customerName: item.customer?.fullName ?? "Walk-in customer",
          reason: item.reason,
          refundMethod: item.refundMethod,
          total: Number(item.total),
          status: item.status,
          createdAt: item.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
