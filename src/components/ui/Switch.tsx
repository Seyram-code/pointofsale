"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils/cn";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: string;
  description?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, label, description, id, ...props },
  ref,
) {
  const generatedId = useId();
  const switchId = id ?? generatedId;

  return (
    <label htmlFor={switchId} className={cn("flex cursor-pointer items-start gap-3", className)}>
      <span className="relative inline-flex shrink-0">
        <input ref={ref} id={switchId} type="checkbox" className="peer sr-only" {...props} />
        <span className="block h-6 w-11 rounded-full bg-line-strong transition-colors peer-checked:bg-brand-600 peer-disabled:opacity-50" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-fg">{label}</span>}
          {description && <span className="mt-0.5 block text-xs text-fg-muted">{description}</span>}
        </span>
      )}
    </label>
  );
});
