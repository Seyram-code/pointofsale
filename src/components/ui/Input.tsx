"use client";

import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, containerClassName, label, hint, error, leftIcon, rightSlot, id, type = "text", ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword && revealed ? "text" : type;

  return (
    <div className={cn("w-full", containerClassName)}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-fg-secondary">
          {label}
          {props.required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted">{leftIcon}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          type={resolvedType}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? `${inputId}-help` : undefined}
          className={cn(
            "h-11 w-full rounded-lg border border-line bg-card px-3 text-fg transition-colors",
            "placeholder:text-fg-muted disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
            leftIcon && "pl-10",
            (rightSlot || isPassword) && "pr-11",
            error && "border-danger",
            className,
          )}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-fg-muted hover:text-fg"
          >
            {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        ) : (
          rightSlot && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted">{rightSlot}</span>
        )}
      </div>
      {(error || hint) && (
        <p id={`${inputId}-help`} className={cn("mt-1.5 text-xs", error ? "text-danger" : "text-fg-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
