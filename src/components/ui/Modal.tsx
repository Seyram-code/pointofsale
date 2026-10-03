"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

const SIZES: Record<ModalSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  full: "sm:max-w-[95vw] sm:h-[92vh]",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
}

/** Renders as a bottom sheet on phones and a centred dialog from `sm` upwards. */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  footer,
  closeOnBackdrop = true,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="print-hide-backdrop absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "print-panel relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-card shadow-[var(--shadow-panel)]",
          "rounded-t-2xl sm:rounded-2xl",
          SIZES[size],
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" aria-hidden />
        {(title || description) && (
          <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              {title && <h2 className="truncate text-base font-semibold text-fg">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="-mr-1 shrink-0 rounded-lg p-2 text-fg-muted hover:bg-muted hover:text-fg"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="print-panel-body flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && (
          <div className="no-print safe-bottom flex flex-col-reverse gap-3 border-t border-line px-5 py-5 pb-6 sm:flex-row sm:justify-end sm:gap-6 sm:px-8 sm:py-5 sm:pb-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
