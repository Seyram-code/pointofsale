"use client";

import { Banknote, CreditCard, Smartphone, Wallet } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PaymentMethod } from "@/lib/payments/types";

const ICONS = {
  CASH: Banknote,
  MOMO: Smartphone,
  CARD_TERMINAL: Wallet,
  CARD: CreditCard,
} as const;

const HINTS: Record<PaymentMethod, string> = {
  CASH: "Notes & coins",
  MOMO: "MTN · Telecel · AT",
  CARD_TERMINAL: "Ghana POS terminal",
  CARD: "Card / payment link",
};

export interface PaymentMethodOption {
  method: PaymentMethod;
  label: string;
}

export interface PaymentMethodSelectorProps {
  options: PaymentMethodOption[];
  value: PaymentMethod;
  disabled?: boolean;
  onChange: (method: PaymentMethod) => void;
}

export function PaymentMethodSelector({ options, value, disabled, onChange }: PaymentMethodSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const Icon = ICONS[option.method];
        const active = value === option.method;
        return (
          <button
            key={option.method}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(option.method)}
            className={cn(
              "flex h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border px-2 text-center transition-colors",
              "disabled:opacity-50",
              active
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-line bg-card text-fg-secondary hover:bg-muted",
            )}
          >
            <Icon className="size-5" />
            <span className="text-sm font-medium leading-none">{option.label}</span>
            <span className={cn("text-[10px] leading-none", active ? "text-white/70" : "text-fg-muted")}>
              {HINTS[option.method]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
