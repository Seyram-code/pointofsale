"use client";

import { CreditCard, Eraser, PauseCircle, Percent, ShoppingCart, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { CartLine } from "@/components/pos/CartLine";
import { formatPercent } from "@/lib/utils/format";
import { subtractMoney } from "@/lib/utils/money";
import type { Cart } from "@/hooks/useCart";

export interface CartPanelProps {
  cart: Cart;
  selectedProductId: string | null;
  onSelectLine: (productId: string) => void;
  onOpenCustomer: () => void;
  onOpenDiscount: () => void;
  onHold: () => void;
  onClear: () => void;
  onCheckout: () => void;
  onCloseMobile?: () => void;
  canDiscount: boolean;
  canHold: boolean;
  busy?: boolean;
}

export function CartPanel({
  cart,
  selectedProductId,
  onSelectLine,
  onOpenCustomer,
  onOpenDiscount,
  onHold,
  onClear,
  onCheckout,
  onCloseMobile,
  canDiscount,
  canHold,
  busy,
}: CartPanelProps) {
  const { lines, totals, customer, discount } = cart;
  const empty = lines.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex items-center gap-2 border-b border-line px-3 py-3">
        <ShoppingCart className="size-4 shrink-0 text-fg-muted" />
        <p className="flex-1 text-sm font-semibold text-fg">
          Current sale
          {!empty && <span className="ml-1.5 font-normal text-fg-muted tabular">({totals.unitCount})</span>}
        </p>
        {cart.resumedSaleId && <span className="text-xs text-accent-700 dark:text-accent-300">resumed</span>}
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close cart"
            className="rounded-lg p-1.5 text-fg-muted hover:bg-muted lg:hidden"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenCustomer}
        className="flex items-center gap-2.5 border-b border-line px-3 py-2.5 text-left hover:bg-muted"
      >
        <UserRound className="size-4 shrink-0 text-fg-muted" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-fg">{customer?.fullName ?? "Walk-in customer"}</span>
          {customer?.phone && <span className="block truncate text-xs text-fg-muted">{customer.phone}</span>}
        </span>
        <span className="shrink-0 text-xs text-brand-600 dark:text-brand-400">{customer ? "Change" : "Add"}</span>
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <EmptyState
            icon={<ShoppingCart className="size-6" />}
            title="Cart is empty"
            message="Scan a barcode or tap a product to begin."
          />
        ) : (
          <ul className="divide-y divide-[var(--border-base)]">
            {lines.map((line) => (
              <CartLine
                key={line.productId}
                line={line}
                selected={line.productId === selectedProductId}
                onSelect={() => onSelectLine(line.productId)}
                onAdjust={(delta) => cart.adjustQuantity(line.productId, delta)}
                onSetQuantity={(quantity) => cart.setQuantity(line.productId, quantity)}
                onRemove={() => cart.removeLine(line.productId)}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="safe-bottom shrink-0 border-t border-line p-3">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-fg-secondary">Subtotal</dt>
            <dd>
              <Money value={subtractMoney(totals.total, totals.taxAmount)} />
            </dd>
          </div>

          <div className="flex items-center justify-between">
            <dt className="flex items-center gap-1.5 text-fg-secondary">
              Discount
              {discount && (
                <span className="text-xs text-fg-muted">
                  ({discount.type === "PERCENTAGE" ? formatPercent(discount.value / 100) : "fixed"})
                </span>
              )}
            </dt>
            <dd className={totals.discountAmount > 0 ? "text-danger" : undefined}>
              {totals.discountAmount > 0 ? <Money value={-totals.discountAmount} signed /> : <Money value={0} />}
            </dd>
          </div>

          <div className="flex justify-between">
            <dt className="text-fg-secondary">Tax (incl.)</dt>
            <dd>
              <Money value={totals.taxAmount} />
            </dd>
          </div>

          <div className="flex items-baseline justify-between border-t border-line pt-2">
            <dt className="font-semibold text-fg">Total to pay</dt>
            <dd>
              <Money value={totals.total} size="lg" />
            </dd>
          </div>
        </dl>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={empty || !canDiscount}
            onClick={onOpenDiscount}
            leftIcon={<Percent className="size-4" />}
          >
            Discount
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={empty || !canHold || busy}
            onClick={onHold}
            leftIcon={<PauseCircle className="size-4" />}
          >
            Hold
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={empty}
            onClick={onClear}
            leftIcon={<Eraser className="size-4" />}
          >
            Clear
          </Button>
        </div>

        <Button
          size="xl"
          fullWidth
          className="mt-2"
          disabled={empty || busy}
          onClick={onCheckout}
          leftIcon={<CreditCard className="size-5" />}
        >
          Checkout
        </Button>
      </div>
    </div>
  );
}
