import Link from "next/link";
import { ArrowRight, PackageCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatQuantity } from "@/lib/utils/format";
import type { LowStockItem } from "@/lib/services/dashboard.service";

export function LowStockCard({ items, total }: { items: LowStockItem[]; total: number }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            Low-stock alerts
            {total > 0 && (
              <Badge variant="danger" size="sm">
                {total}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Below 10 units in stock</CardDescription>
        </div>
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Inventory <ArrowRight className="size-4" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <EmptyState
            icon={<PackageCheck className="size-6" />}
            title="Stock levels are healthy"
            message="No tracked products have fallen below 10 units."
          />
        ) : (
          <ul className="divide-y divide-[var(--border-base)]">
            {items.map((item) => {
              const outOfStock = item.quantity <= 0;
              return (
                <li key={item.productId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span
                    className={
                      outOfStock
                        ? "flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-danger dark:bg-red-950/40"
                        : "flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-danger dark:bg-red-950/40"
                    }
                  >
                    <TriangleAlert className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{item.name}</p>
                    <p className="mt-0.5 truncate text-xs text-fg-secondary">
                      {item.sku} &middot; reorder at {formatQuantity(item.reorderLevel)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant="danger" size="sm">
                      {outOfStock ? "Out of stock" : `${formatQuantity(item.quantity)} left`}
                    </Badge>
                    {item.reorderQty > 0 && (
                      <p className="mt-1 text-xs text-fg-muted">Order {formatQuantity(item.reorderQty)}</p>
                    )}
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
