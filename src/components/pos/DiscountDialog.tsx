"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Money } from "@/components/ui/Money";
import { cn } from "@/lib/utils/cn";
import type { CartDiscount } from "@/hooks/useCart";

export interface DiscountDialogProps {
  open: boolean;
  subtotal: number;
  current: CartDiscount | null;
  onClose: () => void;
  onApply: (discount: CartDiscount | null) => void;
}

const QUICK_PERCENTAGES = [5, 10, 15, 20];

export function DiscountDialog({ open, subtotal, current, onClose, onApply }: DiscountDialogProps) {
  const [type, setType] = useState<CartDiscount["type"]>(current?.type ?? "PERCENTAGE");
  const [value, setValue] = useState(String(current?.value ?? ""));

  useEffect(() => {
    if (open) {
      setType(current?.type ?? "PERCENTAGE");
      setValue(current?.value ? String(current.value) : "");
    }
  }, [open, current]);

  const numeric = Number(value) || 0;
  const amount = type === "PERCENTAGE" ? (subtotal * Math.min(numeric, 100)) / 100 : Math.min(numeric, subtotal);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Apply discount"
      size="sm"
      footer={
        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:gap-4">
          <Button
            variant="outline"
            className="min-w-0 w-full sm:w-auto"
            onClick={() => {
              onApply(null);
              onClose();
            }}
          >
            Remove discount
          </Button>
          <Button
            className="min-w-0 w-full sm:w-auto"
            disabled={numeric <= 0}
            onClick={() => {
              onApply({ type, value: numeric });
              onClose();
            }}
          >
            Apply
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {(["PERCENTAGE", "FIXED_AMOUNT"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setType(option)}
            className={cn(
              "h-11 rounded-lg border text-sm font-medium transition-colors",
              type === option
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-line bg-card text-fg-secondary hover:bg-muted",
            )}
          >
            {option === "PERCENTAGE" ? "Percentage (%)" : "Fixed amount"}
          </button>
        ))}
      </div>

      <Input
        autoFocus
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        containerClassName="mt-4"
        label={type === "PERCENTAGE" ? "Percentage off" : "Amount off"}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />

      {type === "PERCENTAGE" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_PERCENTAGES.map((percentage) => (
            <button
              key={percentage}
              type="button"
              onClick={() => setValue(String(percentage))}
              className="h-9 rounded-lg border border-line px-3 text-sm text-fg-secondary hover:bg-muted"
            >
              {percentage}%
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
        <span className="text-fg-secondary">Discount amount</span>
        <Money value={amount} className="font-semibold" />
      </div>
    </Modal>
  );
}
