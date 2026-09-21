"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { Money } from "@/components/ui/Money";
import { cn } from "@/lib/utils/cn";
import { formatQuantity } from "@/lib/utils/format";
import type { CartLine as CartLineType } from "@/hooks/useCart";

export interface CartLineProps {
  line: CartLineType;
  selected?: boolean;
  onSelect: () => void;
  onAdjust: (delta: number) => void;
  onSetQuantity: (quantity: number) => void;
  onRemove: () => void;
}

export function CartLine({ line, selected, onSelect, onAdjust, onSetQuantity, onRemove }: CartLineProps) {
  const overStock = line.trackStock && line.quantity > line.stock;

  return (
    <li
      onClick={onSelect}
      className={cn(
        "px-3 py-2.5 transition-colors",
        selected ? "bg-brand-50 dark:bg-brand-950/50" : "hover:bg-muted/60",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{line.name}</p>
          <p className="mt-0.5 truncate text-xs text-fg-muted">
            <Money value={line.unitPrice} className="text-xs" />
            {line.unitAbbreviation ? ` / ${line.unitAbbreviation}` : ""}
            {line.unitPrice !== line.originalPrice && " · price overridden"}
          </p>
          {overStock && <p className="mt-0.5 text-xs font-medium text-danger">Only {formatQuantity(line.stock)} in stock</p>}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Money value={line.unitPrice * line.quantity} className="font-semibold" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`Decrease ${line.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onAdjust(-1);
              }}
              className="flex size-8 items-center justify-center rounded-lg border border-line text-fg-secondary hover:bg-muted active:bg-inset"
            >
              <Minus className="size-3.5" />
            </button>

            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={line.quantity}
              aria-label={`Quantity for ${line.name}`}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onSetQuantity(Number(event.target.value))}
              className="h-8 w-14 rounded-lg border border-line bg-card text-center text-sm text-fg tabular"
            />

            <button
              type="button"
              aria-label={`Increase ${line.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onAdjust(1);
              }}
              className="flex size-8 items-center justify-center rounded-lg border border-line text-fg-secondary hover:bg-muted active:bg-inset"
            >
              <Plus className="size-3.5" />
            </button>

            <button
              type="button"
              aria-label={`Remove ${line.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
              className="flex size-8 items-center justify-center rounded-lg text-fg-muted hover:bg-red-50 hover:text-danger dark:hover:bg-red-950/40"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
