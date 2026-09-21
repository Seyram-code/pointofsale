import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils/cn";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: string;
  description?: string;
  containerClassName?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, containerClassName, label, description, id, ...props },
  ref,
) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;

  return (
    <label
      htmlFor={checkboxId}
      className={cn("flex cursor-pointer select-none items-start gap-2.5", containerClassName)}
    >
      <input
        ref={ref}
        id={checkboxId}
        type="checkbox"
        className={cn(
          "mt-0.5 size-[18px] shrink-0 cursor-pointer appearance-none rounded-[5px] border border-line-strong bg-card",
          "transition-colors checked:border-brand-600 checked:bg-brand-600 disabled:opacity-50",
          "checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M3 8.5l3.5 3.5L13 5%22/></svg>')] checked:bg-center checked:bg-no-repeat",
          className,
        )}
        {...props}
      />
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm text-fg">{label}</span>}
          {description && <span className="mt-0.5 block text-xs text-fg-muted">{description}</span>}
        </span>
      )}
    </label>
  );
});
