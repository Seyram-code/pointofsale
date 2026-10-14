import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ExpensesWorkspace } from "@/components/expenses/ExpensesWorkspace";

export const metadata: Metadata = { title: "Expenses" };
export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const { user } = await requirePermission(PERMISSIONS.EXPENSES_VIEW, "/expenses");
  return <ExpensesWorkspace canManage={user.permissions.includes(PERMISSIONS.EXPENSES_MANAGE)} />;
}
