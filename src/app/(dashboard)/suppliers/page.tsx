import type { Metadata } from "next";
import { AdminList } from "@/components/admin/AdminList";
import { SupplierManagement } from "@/components/suppliers/SupplierManagement";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { requirePlanFeature } from "@/lib/services/subscription.service";
import { PlanUpgradeNotice } from "@/components/subscription/PlanUpgradeNotice";

export const metadata: Metadata = { title: "Suppliers" };
export const dynamic = "force-dynamic";

function parseQuery(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : Array.isArray(value) ? value[0]?.trim() ?? "" : "";
}

export default async function SuppliersPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const q = parseQuery(params.q);

  const { user } = await requirePermission(PERMISSIONS.SUPPLIERS_VIEW, "/suppliers");
  const featureAccess = user.role === "SUPER_ADMIN" || !user.storeId
    ? { allowed: true as const, planLabel: "Enterprise" }
    : await requirePlanFeature(user.storeId, "suppliers");
  if (!featureAccess.allowed) return <PlanUpgradeNotice message={featureAccess.message} />;
  const canManage = user.permissions.includes(PERMISSIONS.SUPPLIERS_MANAGE);

  const where = user.storeId
    ? {
        storeId: user.storeId,
        deletedAt: null,
        ...(canManage ? {} : { isActive: true }),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { code: { contains: q } },
                { contactPerson: { contains: q } },
                { phone: { contains: q } },
                { email: { contains: q } },
              ],
            }
          : {}),
      }
    : { deletedAt: null };

  const suppliers = user.storeId ? await prisma.supplier.findMany({ where, orderBy: { name: "asc" }, take: 100 }) : [];

  return (
    <>
      <PageHeader title="Suppliers" description="Manage supplier contacts, payment terms and balances." />

      <form method="get" className="mb-4 rounded-xl border border-line bg-card p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-fg-muted">Search</label>
            <input type="search" name="q" defaultValue={q} placeholder="Name, code, contact or phone" className="h-11 w-full rounded-lg border border-line bg-card px-3 text-fg sm:w-80" />
          </div>
          <button type="submit" className="h-11 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
          <a href="/suppliers" className="inline-flex h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-medium text-fg hover:bg-muted">Reset</a>
        </div>
      </form>

      {canManage ? (
        <SupplierManagement
          initialSuppliers={suppliers.map((supplier) => ({
            id: supplier.id,
            code: supplier.code,
            name: supplier.name,
            contactPerson: supplier.contactPerson,
            phone: supplier.phone,
            email: supplier.email,
            addressLine: supplier.addressLine,
            city: supplier.city,
            region: supplier.region,
            tinNumber: supplier.tinNumber,
            paymentTerms: supplier.paymentTerms,
            creditLimit: Number(supplier.creditLimit ?? 0),
            balance: Number(supplier.balance ?? 0),
            notes: supplier.notes,
            isActive: supplier.isActive,
          }))}
        />
      ) : (
        <AdminList
          title="Suppliers"
          description="Manage supplier contacts, payment terms and balances."
          headers={["Supplier", "Contact", "Payment terms", "Balance"]}
          rows={suppliers.map((supplier) => [<div key="name"><p className="font-medium">{supplier.name}</p><p className="text-xs text-fg-muted">{supplier.code}</p></div>, <div key="contact"><p>{supplier.contactPerson ?? "No contact"}</p><p className="text-xs text-fg-muted">{supplier.phone ?? supplier.email ?? "No details"}</p></div>, <span key="terms">{supplier.paymentTerms ?? "-"}</span>, <Money key="balance" value={Number(supplier.balance)} />])}
          emptyTitle="No suppliers yet"
          emptyMessage="Supplier records will appear here after they are created."
        />
      )}
    </>
  );
}
