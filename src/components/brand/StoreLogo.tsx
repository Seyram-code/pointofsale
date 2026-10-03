import { cn } from "@/lib/utils/cn";
import Image from "next/image";

export interface StoreLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "size-9 rounded-xl",
  md: "size-14 rounded-2xl",
  lg: "size-16 rounded-2xl sm:size-20",
} as const;

export function StoreLogo({ size = "md", className }: StoreLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1",
        SIZES[size],
        className,
      )}
    >
      <Image
        src="/images/vidypos-logo.png"
        alt="VidyPOS"
        width={2172}
        height={724}
        className="size-full object-cover object-left"
        priority
      />
    </span>
  );
}
