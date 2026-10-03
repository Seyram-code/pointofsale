import type { Metadata } from "next";
import { AdminList } from "@/components/admin/AdminList";
import { CustomerManagement } from "@/components/customers/CustomerManagement";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { requirePlanFeature } from "@/lib/services/subscription.service";
import { PlanUpgradeNotice } from "@/components/subscription/PlanUpgradeNotice";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

function parseQuery(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : Array.isArray(value) ? value[0]?.trim() ?? "" : "";
}

export default async function CustomersPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const q = parseQuery(params.q);

  const { user } = await requirePermission(PERMISSIONS.CUSTOMERS_VIEW, "/customers");
  const featureAccess = user.role === "SUPER_ADMIN" || !user.storeId
    ? { allowed: true as const, planLabel: "Enterprise" }
    : await requirePlanFeature(user.storeId, "customers");
  if (!featureAccess.allowed) return <PlanUpgradeNotice message={featureAccess.message} />;
  const canManage = user.permissions.includes(PERMISSIONS.CUSTOMERS_MANAGE);
  const where = user.storeId
    ? {
        storeId: user.storeId,
        deletedAt: null,
        ...(canManage ? {} : { isActive: true }),
        ...(q
          ? {
              OR: [
                { fullName: { contains: q } },
                { code: { contains: q } },
                { phone: { contains: q } },
                { email: { contains: q } },
              ],
            }
          : {}),
      }
    : { deletedAt: null };

  const customers = user.storeId
    ? await prisma.customer.findMany({ where, orderBy: { fullName: "asc" }, take: 100 })
    : [];

  return (
    <>
      <PageHeader title="Customers" description="Manage customer profiles, loyalty points and store credit." />

      <form method="get" className="mb-4 rounded-xl border border-line bg-card p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-fg-muted">Search</label>
            <input type="search" name="q" defaultValue={q} placeholder="Name, code, phone or email" className="h-11 w-full rounded-lg border border-line bg-card px-3 text-fg sm:w-80" />
          </div>
          <button type="submit" className="h-11 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
          <a href="/customers" className="inline-flex h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-medium text-fg hover:bg-muted">Reset</a>
        </div>
      </form>

      {canManage ? (
        <CustomerManagement
          initialCustomers={customers.map((customer) => ({
            id: customer.id,
            code: customer.code,
            fullName: customer.fullName,
            phone: customer.phone,
            email: customer.email,
            addressLine: customer.addressLine,
            city: customer.city,
            loyaltyCardNo: customer.loyaltyCardNo,
            creditLimit: Number(customer.creditLimit),
            notes: customer.notes,
            isActive: customer.isActive,
          }))}
        />
      ) : (
        <AdminList
          title="Customers"
          description="Manage customer profiles, loyalty points and store credit."
          headers={["Customer", "Contact", "Visits", "Total spent"]}
          rows={customers.map((customer) => [<div key="name"><p className="font-medium">{customer.fullName}</p><p className="text-xs text-fg-muted">{customer.code}</p></div>, <div key="contact"><p>{customer.phone ?? "No phone"}</p><p className="text-xs text-fg-muted">{customer.email ?? "No email"}</p></div>, <span key="visits" className="tabular">{customer.visitCount}</span>, <Money key="spent" value={Number(customer.totalSpent)} />])}
          emptyTitle="No customers yet"
          emptyMessage="Customer records will appear here after they are created."
        />
      )}
    </>
  );
}
