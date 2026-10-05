import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { SalesWorkspace } from "@/components/sales/SalesWorkspace";
import { DayBoundaryRefresh } from "@/components/layout/DayBoundaryRefresh";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { endOfDay, startOfDay, todayRange } from "@/lib/utils/date";

export const metadata: Metadata = { title: "Sales" };
export const dynamic = "force-dynamic";

function toDateValue(raw?: string | string[]) {
  const value = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  return value?.trim() ?? "";
}

function parseDateRange(fromInput: string, toInput: string) {
  const defaultRange = todayRange();
  const from = fromInput ? new Date(`${fromInput}T00:00:00Z`) : defaultRange.from;
  const to = toInput ? new Date(`${toInput}T23:59:59Z`) : defaultRange.to;
  return { from: startOfDay(from), to: endOfDay(to) };
}

async function loadSales(fromQuery?: string, toQuery?: string) {
  const { user } = await requirePermission(PERMISSIONS.SALES_VIEW, "/sales");
  if (user.isEmployee) redirect("/forbidden");
  const canViewAll = user.permissions.includes(PERMISSIONS.SALES_VIEW_ALL);
  const range = parseDateRange(fromQuery ?? "", toQuery ?? "");
  if (!user.storeId) return { sales: [], staff: [], canViewAll, range };

  const [sales, staff] = await Promise.all([
    prisma.sale.findMany({
        where: {
          storeId: user.storeId,
          status: { not: "DRAFT" },
          createdAt: { gte: range.from, lte: range.to },
          ...(canViewAll ? {} : { cashierId: user.id }),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          cashier: { select: { fullName: true } },
          register: { select: { name: true } },
          payments: { where: { status: "SUCCESSFUL" }, select: { method: true, amount: true, tenderedAmount: true }, take: 10 },
          items: { select: { id: true, productName: true, quantity: true, unitPrice: true, lineTotal: true } },
        },
      }),
    canViewAll
      ? prisma.user.findMany({
          where: { storeId: user.storeId, status: "ACTIVE" },
          orderBy: { fullName: "asc" },
          select: { id: true, fullName: true },
        })
      : Promise.resolve([]),
  ]);

  return { sales, staff, canViewAll, range };
}

export default async function SalesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const fromQuery = toDateValue(params.from);
  const toQuery = toDateValue(params.to);
  const { sales, staff, canViewAll, range } = await loadSales(fromQuery, toQuery);
  const completedSales = sales.filter((sale) => sale.status === "COMPLETED" || sale.status === "PARTIALLY_REFUNDED");
  const totalSales = completedSales.reduce((total, sale) => total + Number(sale.total), 0);
  const totalRefunds = sales.reduce((total, sale) => total + Number(sale.refundedAmount), 0);

  return (
    <>
      <DayBoundaryRefresh />
      <PageHeader title="Sales" description="Review completed transactions, payments and refunds." />

      <form method="get" className="mb-4 rounded-xl border border-line bg-card p-3">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-fg-muted">From</label>
            <input type="date" name="from" defaultValue={fromQuery} className="h-11 w-full rounded-lg border border-line bg-card px-3 text-fg" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-fg-muted">To</label>
            <input type="date" name="to" defaultValue={toQuery} className="h-11 w-full rounded-lg border border-line bg-card px-3 text-fg" />
          </div>
          <button type="submit" className="h-11 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
          <a href="/sales" className="inline-flex h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-medium text-fg hover:bg-muted">Reset</a>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-fg-muted">Sales total</p>
            <Money value={totalSales} className="mt-2 block text-lg font-semibold text-fg" />
            <p className="mt-1 text-xs text-fg-muted">{completedSales.length} completed transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-fg-muted">Transactions</p>
            <p className="mt-2 text-lg font-semibold text-fg tabular">{sales.length.toLocaleString("en-GH")}</p>
            <p className="mt-1 text-xs text-fg-muted">{fromQuery || toQuery ? `${fromQuery || "—"} to ${toQuery || "—"}` : "Showing the latest 100"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-fg-muted">Refunded amount</p>
            <Money value={totalRefunds} className="mt-2 block text-lg font-semibold text-fg" />
            <p className="mt-1 text-xs text-fg-muted">{range.from.toISOString().slice(0, 10)} to {range.to.toISOString().slice(0, 10)}</p>
          </CardContent>
        </Card>
      </div>

      <SalesWorkspace
        canViewAll={canViewAll}
        staff={staff.map((member) => ({ id: member.id, name: member.fullName }))}
        sales={sales.map((sale) => ({
          id: sale.id,
          receiptNumber: sale.receiptNumber,
          createdAt: sale.createdAt.toISOString(),
          cashierId: sale.cashierId,
          cashierName: sale.cashier.fullName,
          paymentMethod: sale.payments[0]?.method ?? "-",
          payments: sale.payments.map((payment) => ({
            method: payment.method,
            amount: Number(payment.amount),
            tenderedAmount: payment.tenderedAmount === null ? null : Number(payment.tenderedAmount),
          })),
          items: sale.items.map((item) => ({
            id: item.id,
            name: item.productName,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            lineTotal: Number(item.lineTotal),
          })),
          subtotal: Number(sale.subtotal),
          tax: Number(sale.taxAmount),
          amountPaid: Number(sale.amountPaid),
          changeDue: Number(sale.changeDue),
          itemCount: sale.itemCount,
          total: Number(sale.total),
          status: sale.status,
        }))}
      />
    </>
  );
}
