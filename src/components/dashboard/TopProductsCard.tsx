import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Money } from "@/components/ui/Money";
import { formatQuantity } from "@/lib/utils/format";
import type { TopProduct } from "@/lib/services/dashboard.service";

export function TopProductsCard({ products }: { products: TopProduct[] }) {
  const max = Math.max(...products.map((product) => product.revenue), 0);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Top-selling products</CardTitle>
          <CardDescription>Last 30 days by revenue</CardDescription>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Products <ArrowRight className="size-4" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {products.length === 0 ? (
          <EmptyState
            icon={<Trophy className="size-6" />}
            title="No sales data yet"
            message="Your best sellers will be ranked here once products start moving."
          />
        ) : (
          <ol className="divide-y divide-[var(--border-base)]">
            {products.map((product, index) => (
              <li key={product.productId} className="px-4 py-3 sm:px-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-fg-secondary tabular">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{product.name}</p>
                    <p className="mt-0.5 truncate text-xs text-fg-muted">
                      {product.sku} &middot; {formatQuantity(product.quantitySold)} sold
                    </p>
                  </div>
                  <Money value={product.revenue} className="shrink-0 font-semibold" />
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-inset">
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${max > 0 ? Math.max((product.revenue / max) * 100, 3) : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
