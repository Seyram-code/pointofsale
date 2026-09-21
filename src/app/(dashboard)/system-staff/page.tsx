import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { SystemStaffManagement } from "@/components/platform/SystemStaffManagement";

export const metadata: Metadata = { title: "System Staff" };
export const dynamic = "force-dynamic";

export default async function SystemStaffPage() {
  const session = await requireSession("/system-staff");
  if (session.user.role !== "SUPER_ADMIN") {
    return (
      <div className="rounded-xl border border-line bg-card p-8">
        <h1 className="text-xl font-semibold text-fg">Platform access required</h1>
        <p className="mt-2 text-sm text-fg-muted">Only system super admins can manage system staff.</p>
      </div>
    );
  }

  const staff = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN", deletedAt: null },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, email: true, staffCode: true, status: true, lastLoginAt: true, createdAt: true },
  });

  return <SystemStaffManagement initialStaff={staff} />;
}
