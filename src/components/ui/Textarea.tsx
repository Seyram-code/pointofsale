import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils/cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, containerClassName, label, hint, error, id, rows = 3, ...props },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <div className={cn("w-full", containerClassName)}>
      {label && (
        <label htmlFor={textareaId} className="mb-1.5 block text-sm font-medium text-fg-secondary">
          {label}
          {props.required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={cn(
          "w-full resize-y rounded-lg border border-line bg-card px-3 py-2.5 text-fg transition-colors",
          "placeholder:text-fg-muted disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
          error && "border-danger",
          className,
        )}
        {...props}
      />
      {(error || hint) && (
        <p className={cn("mt-1.5 text-xs", error ? "text-danger" : "text-fg-muted")}>{error ?? hint}</p>
      )}
    </div>
  );
});
