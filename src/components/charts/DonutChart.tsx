"use client";

import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatPercent } from "@/lib/utils/format";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  slices: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  valueFormatter?: (value: number) => string;
  className?: string;
}

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** SVG donut built from stroke offsets so it renders without a chart library. */
export function DonutChart({
  slices,
  centerLabel,
  centerValue,
  size = 176,
  valueFormatter = formatCurrency,
  className,
}: DonutChartProps) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let offset = 0;

  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="12" className="stroke-[var(--surface-inset)]" />
          {total > 0 &&
            slices.map((slice) => {
              const fraction = slice.value / total;
              const dash = fraction * CIRCUMFERENCE;
              const element = (
                <circle
                  key={slice.label}
                  cx="50"
                  cy="50"
                  r={RADIUS}
                  fill="none"
                  strokeWidth="12"
                  strokeLinecap="butt"
                  stroke={slice.color}
                  strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                  strokeDashoffset={-offset}
                >
                  <title>{`${slice.label}: ${valueFormatter(slice.value)}`}</title>
                </circle>
              );
              offset += dash;
              return element;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-semibold text-fg tabular">{centerValue ?? valueFormatter(total)}</span>
          {centerLabel && <span className="text-[11px] text-fg-muted">{centerLabel}</span>}
        </div>
      </div>

      <ul className="w-full space-y-2.5">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-fg-secondary">{slice.label}</span>
            <span className="flex shrink-0 items-baseline gap-2 text-right">
              <span className="font-medium text-fg tabular">{valueFormatter(slice.value)}</span>
              <span className="w-10 text-right text-xs text-fg-muted tabular">
                {total > 0 ? formatPercent(slice.value / total) : "0%"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
