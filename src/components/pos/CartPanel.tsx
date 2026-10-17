"use client";

import { CreditCard, Eraser, PauseCircle, Percent, ShoppingCart, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { CartLine } from "@/components/pos/CartLine";
import { formatPercent } from "@/lib/utils/format";
import { subtractMoney } from "@/lib/utils/money";
import type { Cart } from "@/hooks/useCart";
import type { RestaurantOrderType } from "@/lib/validations/sale.schema";

export interface CartPanelProps {
  cart: Cart;
  isRestaurant: boolean;
  orderType: RestaurantOrderType;
  tableNumber: string;
  onOrderTypeChange: (value: RestaurantOrderType) => void;
  onTableNumberChange: (value: string) => void;
  selectedProductId: string | null;
  onSelectLine: (productId: string) => void;
  onOpenCustomer: () => void;
  onOpenDiscount: () => void;
  onHold: () => void;
  onClear: () => void;
  onCheckout: () => void;
  onCloseMobile?: () => void;
  canSelectCustomer: boolean;
  canDiscount: boolean;
  canHold: boolean;
  busy?: boolean;
}

export function CartPanel({
  cart,
  isRestaurant,
  orderType,
  tableNumber,
  onOrderTypeChange,
  onTableNumberChange,
  selectedProductId,
  onSelectLine,
  onOpenCustomer,
  onOpenDiscount,
  onHold,
  onClear,
  onCheckout,
  onCloseMobile,
  canSelectCustomer,
  canDiscount,
  canHold,
  busy,
}: CartPanelProps) {
  const { lines, totals, customer, discount } = cart;
  const empty = lines.length === 0;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-card max-sm:h-auto">
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

      <div className="flex items-center gap-2.5 border-b border-line px-3 py-2.5">
        <UserRound className="size-4 shrink-0 text-fg-muted" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-fg">{customer?.fullName ?? "Walk-in customer"}</span>
          {customer?.phone && <span className="block truncate text-xs text-fg-muted">{customer.phone}</span>}
        </span>
        {canSelectCustomer && <button type="button" onClick={onOpenCustomer} className="shrink-0 text-xs text-brand-600 dark:text-brand-400">{customer ? "Change" : "Add"}</button>}
      </div>

      {isRestaurant && (
        <div className="grid grid-cols-2 gap-2 border-b border-line px-3 py-2.5">
          <label className="grid gap-1 text-xs font-medium text-fg-secondary">
            Order type
            <select
              value={orderType}
              onChange={(event) => onOrderTypeChange(event.target.value as RestaurantOrderType)}
              className="h-10 min-w-0 rounded-lg border border-line-strong bg-card px-2 text-sm text-fg"
              aria-label="Order type"
            >
              <option value="DINE_IN">Dine in</option>
              <option value="TAKEAWAY">Takeaway</option>
              <option value="DELIVERY">Delivery</option>
            </select>
          </label>
          {orderType === "DINE_IN" && (
            <label className="grid gap-1 text-xs font-medium text-fg-secondary">
              Table number
              <input
                value={tableNumber}
                onChange={(event) => onTableNumberChange(event.target.value)}
                placeholder="e.g. 4"
                maxLength={40}
                className="h-10 min-w-0 rounded-lg border border-line-strong bg-card px-2 text-sm text-fg placeholder:text-fg-muted"
                aria-label="Table number"
              />
            </label>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto max-sm:flex-none">
        {empty ? (
          <EmptyState
            icon={<ShoppingCart className="size-6" />}
            title="Cart is empty"
            message="Scan a barcode or tap a product to begin."
            className="max-sm:py-6"
          />
        ) : (
          <ul className="divide-y divide-[var(--border-base)]">
            {lines.map((line) => (
              <CartLine
                key={line.lineId}
                line={line}
                selected={line.lineId === selectedProductId}
                onSelect={() => onSelectLine(line.lineId)}
                onAdjust={(delta) => cart.adjustQuantity(line.lineId, delta)}
                onSetQuantity={(quantity) => cart.setQuantity(line.lineId, quantity)}
                onRemove={() => cart.removeLine(line.lineId)}
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
