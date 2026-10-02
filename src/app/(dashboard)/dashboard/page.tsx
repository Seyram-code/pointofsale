import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { EMPTY_DASHBOARD, getDashboardData } from "@/lib/services/dashboard.service";
import { getSubscriptionStatus } from "@/lib/services/subscription.service";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { DayBoundaryRefresh } from "@/components/layout/DayBoundaryRefresh";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user } = await requireSession("/dashboard");

  if (user.role === "SUPER_ADMIN") {
    redirect("/platform");
  }

  const data = user.storeId ? await getDashboardData(user.storeId, user.permissions.includes(PERMISSIONS.SALES_VIEW_ALL) ? undefined : user.id) : EMPTY_DASHBOARD;
  const subscription = user.storeId ? await getSubscriptionStatus(user.storeId) : null;

  return (
    <>
      <DayBoundaryRefresh />
      <DashboardView user={user} data={data} subscription={subscription} />
    </>
  );
}
