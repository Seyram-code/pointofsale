import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { ShiftPortal } from "@/components/shifts/ShiftPortal";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Shifts" };
export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function statusVariant(status: string) {
  if (status === "OPEN") return "success" as const;
  if (status === "RECONCILED") return "info" as const;
  return "neutral" as const;
}

export default async function ShiftsPage() {
  const { user } = await requirePermission(PERMISSIONS.SHIFTS_OPEN, "/shifts");

  const shifts = user.storeId
    ? await prisma.shift.findMany({
        where: { storeId: user.storeId },
        orderBy: { openedAt: "desc" },
        take: 25,
        include: {
          register: { select: { name: true, code: true } },
          cashier: { select: { fullName: true } },
        },
      })
    : [];

  const openShift = shifts.find((shift) => shift.status === "OPEN" && shift.cashierId === user.id);
  const totalSales = shifts.reduce((total, shift) => total + Number(shift.totalSales), 0);
  const totalTransactions = shifts.reduce((total, shift) => total + shift.transactionCount, 0);

  return (
    <>
      <PageHeader
        title="Shifts"
        description="Open, monitor and reconcile till shifts across your store."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-fg-muted">Your current shift</p>
            <p className="mt-2 text-lg font-semibold text-fg">{openShift ? openShift.shiftNumber : "No open shift"}</p>
            <p className="mt-1 text-xs text-fg-muted">{openShift ? openShift.register.name : "Open a shift to start selling"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-fg-muted">Recent shift sales</p>
            <Money value={totalSales} className="mt-2 block text-lg font-semibold text-fg" />
            <p className="mt-1 text-xs text-fg-muted">Across the last {shifts.length} shifts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-fg-muted">Transactions</p>
            <p className="mt-2 text-lg font-semibold text-fg tabular">{totalTransactions.toLocaleString("en-GH")}</p>
            <p className="mt-1 text-xs text-fg-muted">Across recent shifts</p>
          </CardContent>
        </Card>
      </div>

      <ShiftPortal
        initialOpenShift={
          openShift
            ? {
                id: openShift.id,
                shiftNumber: openShift.shiftNumber,
                status: openShift.status,
                register: {
                  name: openShift.register.name,
                  code: openShift.register.code,
                },
                openingFloat: Number(openShift.openingFloat ?? 0),
                expectedCash: Number(openShift.expectedCash ?? openShift.openingFloat ?? 0),
                closedAt: openShift.closedAt?.toISOString() ?? null,
              }
            : null
        }
      />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Shift history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {shifts.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="font-medium text-fg">No shifts recorded yet</p>
              <p className="mt-1 text-sm text-fg-muted">Your shift activity will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {shifts.map((shift) => (
                <div key={shift.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-fg">{shift.shiftNumber}</p>
                      <Badge variant={statusVariant(shift.status)} size="sm">{shift.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-fg-secondary">{shift.register.name} · {shift.cashier.fullName}</p>
                    <p className="mt-1 text-xs text-fg-muted">Opened {formatDate(shift.openedAt)}{shift.closedAt ? ` · Closed ${formatDate(shift.closedAt)}` : ""}</p>
                  </div>
                  <div className="flex items-center justify-between gap-6 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <Money value={Number(shift.totalSales)} className="font-semibold text-fg" />
                      <p className="mt-1 text-xs text-fg-muted">{shift.transactionCount.toLocaleString("en-GH")} transactions</p>
                    </div>
                    {shift.cashVariance !== null && (
                      <div className="text-right">
                        <Money value={Number(shift.cashVariance)} className="font-medium text-fg" />
                        <p className="mt-1 text-xs text-fg-muted">Cash variance</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
