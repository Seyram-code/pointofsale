import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getReportData } from "@/lib/services/report.service";
import { reportQuerySchema } from "@/lib/validations/report.schema";
import { ReportsWorkspace } from "@/components/reports/ReportsWorkspace";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const { user } = await requirePermission(PERMISSIONS.REPORTS_DAILY, "/reports");
  const canViewAll = user.permissions.includes(PERMISSIONS.SALES_VIEW_ALL);
  const data = user.storeId ? await getReportData(user.storeId, reportQuerySchema.parse({ period: "daily" }), canViewAll ? undefined : user.id) : null;
  return <ReportsWorkspace initialData={data} canViewAll={canViewAll} currentUserId={user.id} />;
}
