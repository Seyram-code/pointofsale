import { cn } from "@/lib/utils/cn";

export interface StoreLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "size-9 rounded-xl",
  md: "size-14 rounded-2xl",
  lg: "size-16 rounded-2xl sm:size-20",
} as const;

/**
 * Supermarket brand mark: a shopping trolley over the store awning.
 * Inline SVG so it renders instantly and inherits the brand colours.
 */
export function StoreLogo({ size = "md", className }: StoreLogoProps) {
  return (
    <span
      role="img"
      aria-label="Supermarket logo"
      className={cn(
        "inline-flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[var(--shadow-panel)]",
        SIZES[size],
        className,
      )}
    >
      <svg viewBox="0 0 32 32" fill="none" className="size-[62%]" aria-hidden>
        <path
          d="M4 8.5 6 4h20l2 4.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 8.5h24c0 2.2-1.8 4-4 4s-4-1.8-4-4c0 2.2-1.8 4-4 4s-4-1.8-4-4c0 2.2-1.8 4-4 4s-4-1.8-4-4Z"
          fill="currentColor"
          fillOpacity="0.35"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M8 16h2.2l2 8.2h10.3l1.8-6.2H11"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="14" cy="27" r="1.6" fill="currentColor" />
        <circle cx="21.5" cy="27" r="1.6" fill="currentColor" />
      </svg>
    </span>
  );
}
