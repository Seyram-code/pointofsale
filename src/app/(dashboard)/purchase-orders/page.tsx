import type { Metadata } from "next";
import { AdminList } from "@/components/admin/AdminList";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Purchase Orders" };
export const dynamic = "force-dynamic";

const statuses = ["DRAFT", "SUBMITTED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"] as const;

function parseQuery(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : Array.isArray(value) ? value[0]?.trim() ?? "" : "";
}

function statusVariant(status: string) {
  return status === "RECEIVED" ? "success" as const : status === "CANCELLED" ? "danger" as const : "warning" as const;
}

export default async function PurchaseOrdersPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const q = parseQuery(params.q);
  const requestedStatus = parseQuery(params.status);
  const status = statuses.includes(requestedStatus as (typeof statuses)[number]) ? requestedStatus : "";
  const { user } = await requirePermission(PERMISSIONS.PURCHASE_ORDERS_VIEW, "/purchase-orders");
  const where = user.storeId
    ? {
        storeId: user.storeId,
        ...(status ? { status: status as (typeof statuses)[number] } : {}),
        ...(q ? { OR: [{ orderNumber: { contains: q } }, { supplier: { name: { contains: q } } }] } : {}),
      }
    : { storeId: "" };
  const orders = user.storeId
    ? await prisma.purchaseOrder.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { supplier: { select: { name: true } } } })
    : [];
  const summary = statuses.map((value) => ({ status: value, count: orders.filter((order) => order.status === value).length })).filter((item) => item.count > 0);

  return (
    <>
      <PageHeader title="Purchase Orders" description="Track supplier orders, deliveries and purchasing spend." />
      <form method="get" className="mb-4 rounded-xl border border-line bg-card p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label htmlFor="purchase-order-search" className="mb-1 block text-xs font-medium uppercase tracking-wide text-fg-muted">Search</label>
            <input id="purchase-order-search" type="search" name="q" defaultValue={q} placeholder="Order number or supplier" className="h-11 w-full rounded-lg border border-line bg-card px-3 text-fg sm:w-72" />
          </div>
          <div>
            <label htmlFor="purchase-order-status" className="mb-1 block text-xs font-medium uppercase tracking-wide text-fg-muted">Status</label>
            <select id="purchase-order-status" name="status" defaultValue={status} className="h-11 w-full rounded-lg border border-line bg-card px-3 text-fg sm:w-56">
              <option value="">All statuses</option>
              {statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
            </select>
          </div>
          <button type="submit" className="h-11 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
          <a href="/purchase-orders" className="inline-flex h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-medium text-fg hover:bg-muted">Reset</a>
        </div>
      </form>

      {summary.length > 0 && <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{summary.map((item) => <Card key={item.status}><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{item.status.replaceAll("_", " ")}</p><p className="mt-1 text-2xl font-semibold text-fg">{item.count}</p></CardContent></Card>)}</div>}

      <AdminList title="Purchase Orders" description="Track supplier orders, deliveries and purchasing spend." headers={["Order", "Supplier", "Order date", "Expected", "Total", "Status"]} rows={orders.map((order) => [<div key="number"><p className="font-medium">{order.orderNumber}</p><p className="text-xs text-fg-muted">{order.notes ?? ""}</p></div>, <span key="supplier">{order.supplier.name}</span>, <span key="date">{order.orderDate.toLocaleDateString("en-GH")}</span>, <span key="expected">{order.expectedDate?.toLocaleDateString("en-GH") ?? "-"}</span>, <Money key="total" value={Number(order.total)} />, <Badge key="status" variant={statusVariant(order.status)} size="sm">{order.status.replaceAll("_", " ")}</Badge>])} emptyTitle="No purchase orders found" emptyMessage={q || status ? "Try a different search or status filter." : "Purchase orders will appear here after they are created."} />
    </>
  );
}
