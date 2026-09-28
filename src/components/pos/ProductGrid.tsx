"use client";

import { cn } from "@/lib/utils/cn";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatQuantity } from "@/lib/utils/format";
import type { PosProduct } from "@/lib/services/product.service";

export interface ProductGridProps {
  products: PosProduct[];
  loading?: boolean;
  onSelect: (product: PosProduct) => void;
}

export function ProductGrid({ products, loading, onSelect }: ProductGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 12 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-card" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return <EmptyState title="No products found" message="Try a different search term or category." />;
  }

  return (
    <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {products.map((product) => {
        const outOfStock = product.trackStock && product.stock <= 0;
        const lowStock = product.trackStock && product.stock < 10;
        return (
          <button
            key={product.id}
            type="button"
            disabled={outOfStock}
            onClick={() => onSelect(product)}
            aria-label={outOfStock ? `${product.name}, out of stock` : `Add ${product.name} to cart`}
            className={cn(
              "flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-card text-left transition-colors",
              "hover:border-brand-400 hover:bg-brand-50/50 active:bg-brand-50 dark:hover:bg-brand-950/40 disabled:cursor-not-allowed disabled:hover:border-line disabled:hover:bg-card",
              outOfStock && "opacity-60",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-2 p-3">
              <span className="line-clamp-2 min-w-0 text-sm font-medium leading-snug text-fg">{product.name}</span>
              <Money value={product.unitPrice} className="font-semibold text-brand-700 dark:text-brand-300" />
              <span
                className={cn(
                  "border-t border-line pt-1 text-xs tabular",
                  outOfStock ? "font-medium text-danger" : "text-fg-muted",
                )}
              >
                {product.trackStock
                  ? outOfStock
                    ? "Qty: Out of stock"
                    : (
                      <>Qty: <span className={lowStock ? "text-danger" : undefined}>{formatQuantity(product.stock)}{product.unitAbbreviation ?? ""}</span></>
                    )
                  : "Qty: Not tracked"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
