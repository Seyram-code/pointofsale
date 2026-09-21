import { cn } from "@/lib/utils/cn";
import { publicEnv } from "@/lib/config/env";

export interface MoneyProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number | string;
  /** Renders negatives in the danger colour — used for refunds and variances. */
  signed?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl font-semibold",
  xl: "text-3xl font-bold",
} as const;

export function Money({ value, signed, size = "md", className, ...props }: MoneyProps) {
  const amount = typeof value === "number" ? value : Number(value) || 0;
  const formatted = new Intl.NumberFormat(publicEnv.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  return (
    <span
      className={cn("tabular whitespace-nowrap", SIZES[size], signed && amount < 0 && "text-danger", className)}
      {...props}
    >
      {amount < 0 ? "-" : ""}
      {publicEnv.currencySymbol}
      {formatted}
    </span>
  );
}
