import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Card } from "@/components/ui/Card";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
  trend?: { value: number; label?: string };
  tone?: "brand" | "accent" | "success" | "danger" | "neutral";
  className?: string;
}

const TONES = {
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300",
  accent: "bg-accent-100 text-accent-800 dark:bg-accent-900/40 dark:text-accent-200",
  success: "bg-brand-50 text-success dark:bg-brand-950",
  danger: "bg-red-50 text-danger dark:bg-red-950/40",
  neutral: "bg-muted text-fg-secondary",
} as const;

export function StatCard({ label, value, icon, hint, trend, tone = "brand", className }: StatCardProps) {
  const positive = (trend?.value ?? 0) >= 0;

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-xs font-medium uppercase leading-tight tracking-wide text-fg-muted">
          {label}
        </p>
        {icon && (
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10", TONES[tone])}>
            {icon}
          </div>
        )}
      </div>

      <p className="mt-2 truncate text-lg font-semibold text-fg tabular sm:text-xl lg:text-2xl">{value}</p>

      {(hint || trend) && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs">
          {trend && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", positive ? "text-success" : "text-danger")}>
              {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(trend.value).toFixed(1)}%
            </span>
          )}
          {(trend?.label || hint) && <span className="truncate text-fg-muted">{trend?.label ?? hint}</span>}
        </div>
      )}
    </Card>
  );
}
