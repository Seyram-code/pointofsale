import { PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, message, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-fg-muted">
        {icon ?? <PackageOpen className="size-6" />}
      </div>
      <p className="text-sm font-semibold text-fg">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-fg-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
