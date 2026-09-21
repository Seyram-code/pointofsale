import { cn } from "@/lib/utils/cn";

type BadgeVariant = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "accent";
type BadgeSize = "sm" | "md";

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "bg-muted text-fg-secondary border-line",
  brand: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950 dark:text-brand-300 dark:border-brand-800",
  success: "bg-brand-50 text-success border-brand-200 dark:bg-brand-950 dark:border-brand-800",
  warning: "bg-accent-100 text-fg border-accent-300 dark:bg-accent-900/40 dark:text-fg dark:border-accent-800",
  danger: "bg-red-50 text-danger border-red-200 dark:bg-red-950/40 dark:border-red-900",
  info: "bg-blue-50 text-info border-blue-200 dark:bg-blue-950/40 dark:border-blue-900",
  accent: "bg-accent-100 text-accent-800 border-accent-300 dark:bg-accent-900/40 dark:text-accent-200 dark:border-accent-800",
};

const SIZES: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

export function Badge({ className, variant = "neutral", size = "md", dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
