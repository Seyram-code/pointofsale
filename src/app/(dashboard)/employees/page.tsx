import type { Metadata } from "next";
import { EmployeeManagement } from "@/components/employees/EmployeeManagement";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Employees" };
export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const { user } = await requirePermission(PERMISSIONS.EMPLOYEES_VIEW, "/employees");
  const employees = user.storeId ? await prisma.employee.findMany({ where: { user: { storeId: user.storeId } }, orderBy: { user: { fullName: "asc" } }, include: { user: { select: { id: true, fullName: true, email: true, staffCode: true, role: true, status: true } } }, take: 100 }) : [];
  return <EmployeeManagement initialEmployees={employees} canManageAdmins={user.role === "ADMIN" || user.role === "SUPER_ADMIN"} />;
}
