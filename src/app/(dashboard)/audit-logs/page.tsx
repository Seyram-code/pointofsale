import type { Metadata } from "next";
import { AdminList } from "@/components/admin/AdminList";
import { Badge } from "@/components/ui/Badge";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Audit Logs" };
export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  const { user } = await requirePermission(PERMISSIONS.AUDIT_LOGS_VIEW, "/audit-logs");
  const logs = user.storeId ? await prisma.auditLog.findMany({ where: { storeId: user.storeId }, orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { fullName: true } } } }) : [];
  return <AdminList title="Audit Logs" description="Review important actions performed across the system." headers={["Action", "Summary", "User", "Date"]} rows={logs.map((log) => [<Badge key="action" variant="neutral" size="sm">{log.action}</Badge>, <span key="summary">{log.summary}</span>, <span key="user">{log.user?.fullName ?? "System"}</span>, <span key="date">{log.createdAt.toLocaleString("en-GH")}</span>])} emptyTitle="No audit events yet" emptyMessage="Recorded system activity will appear here." />;
}
