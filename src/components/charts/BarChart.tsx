"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";

export interface BarChartDatum {
  label: string;
  value: number;
  /** Optional secondary figure shown in the tooltip, e.g. transaction count. */
  secondary?: string;
}

export interface BarChartProps {
  data: BarChartDatum[];
  height?: number;
  valueFormatter?: (value: number) => string;
  className?: string;
}

/**
 * Lightweight CSS bar chart — no charting dependency, scales fluidly and stays
 * legible down to phone widths.
 */
export function BarChart({ data, height = 200, valueFormatter = formatCurrency, className }: BarChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 0);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-end gap-1.5 sm:gap-3" style={{ height }}>
        {data.map((datum, index) => {
          const ratio = max > 0 ? datum.value / max : 0;
          const isActive = active === index;
          return (
            <div
              key={`${datum.label}-${index}`}
              className="group relative flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              tabIndex={0}
              role="img"
              aria-label={`${datum.label}: ${valueFormatter(datum.value)}`}
            >
              {isActive && (
                <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs shadow-[var(--shadow-panel)]">
                  <p className="font-semibold text-fg tabular">{valueFormatter(datum.value)}</p>
                  {datum.secondary && <p className="text-fg-muted">{datum.secondary}</p>}
                </div>
              )}
              <div
                className={cn(
                  "w-full rounded-t-md transition-[height,background-color] duration-300",
                  isActive ? "bg-brand-500" : "bg-brand-600/80",
                )}
                style={{ height: `${Math.max(ratio * 100, datum.value > 0 ? 4 : 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-3">
        {data.map((datum, index) => (
          <span key={`${datum.label}-label-${index}`} className="flex-1 truncate text-center text-[11px] text-fg-muted">
            {datum.label}
          </span>
        ))}
      </div>
    </div>
  );
}
