import Link from "next/link";
import { ArrowRight, CalendarClock, PackageCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatQuantity } from "@/lib/utils/format";
import type { ExpiringItem } from "@/lib/services/dashboard.service";

export function ExpiringProductsCard({ items }: { items: ExpiringItem[] }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            Expiring soon
            {items.length > 0 && <Badge variant="warning" size="sm">{items.length}</Badge>}
          </CardTitle>
          <CardDescription>Stock expiring within 30 days</CardDescription>
        </div>
        <Link href="/inventory" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
          Inventory <ArrowRight className="size-4" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <EmptyState icon={<PackageCheck className="size-6" />} title="No expiry alerts" message="No stocked batches expire within the next 30 days." />
        ) : (
          <ul className="divide-y divide-[var(--border-base)]">
            {items.map((item) => {
              const urgent = item.daysUntilExpiry <= 7;
              return (
                <li key={item.batchId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${urgent ? "bg-red-50 text-danger dark:bg-red-950/40" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40"}`}>
                    {urgent ? <TriangleAlert className="size-4.5" /> : <CalendarClock className="size-4.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{item.name}</p>
                    <p className="mt-0.5 truncate text-xs text-fg-secondary">{item.sku} · Batch {item.batchNumber} · {formatQuantity(item.quantity)} units</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant={urgent ? "danger" : "warning"} size="sm">{item.daysUntilExpiry === 0 ? "Expires today" : `${item.daysUntilExpiry}d left`}</Badge>
                    <p className="mt-1 text-xs text-fg-muted">{item.expiryDate.toLocaleDateString("en-GH")}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}