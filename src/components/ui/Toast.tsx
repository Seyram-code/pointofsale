"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (input: Omit<Toast, "id"> | string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="size-5 text-success" />,
  error: <XCircle className="size-5 text-danger" />,
  warning: <AlertTriangle className="size-5 text-warning" />,
  info: <Info className="size-5 text-info" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: Omit<Toast, "id"> | string) => {
      const entry: Toast = {
        id: crypto.randomUUID(),
        ...(typeof input === "string" ? { title: input, variant: "info" as const } : input),
      };
      setToasts((current) => [...current, entry]);
      setTimeout(() => dismiss(entry.id), 5000);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, variant: "success" }),
      error: (title, description) => toast({ title, description, variant: "error" }),
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className="no-print safe-top pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end">
            {toasts.map((entry) => (
              <div
                key={entry.id}
                role="status"
                className={cn(
                  "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line",
                  "bg-card p-3.5 shadow-[var(--shadow-panel)]",
                )}
              >
                <span className="mt-0.5 shrink-0">{ICONS[entry.variant]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{entry.title}</p>
                  {entry.description && <p className="mt-0.5 text-sm text-fg-muted">{entry.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(entry.id)}
                  aria-label="Dismiss notification"
                  className="shrink-0 rounded-md p-1 text-fg-muted hover:bg-muted hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}
